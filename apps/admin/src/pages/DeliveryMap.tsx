import React, { useEffect, useRef, useState } from 'react';
import { Card, Button, message, Alert, Space, Badge, Modal } from 'antd';
import AMapLoader from '@amap/amap-jsapi-loader';
import { Order, OrderStatus } from '@el/types';
import { fetchOrders, dispatchBatch } from '../services/orderService';
import { useMerchant } from '../contexts/MerchantContext';
import { io, Socket } from 'socket.io-client';

// 北京三里屯配送站
const STATION_LOCATION = [116.4551, 39.9373];

const DeliveryMap: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const mapRef = useRef<any>(null);
    const polygonRef = useRef<any>(null);
    const polyEditorRef = useRef<any>(null); // ✅ 编辑器引用
    const [hasPolygon, setHasPolygon] = useState(false); 
    const mouseToolRef = useRef<any>(null);
    
    // ✅ Unified Marker Management (Replacing Array with Map for better updates)
    const markerMapRef = useRef<Map<string, any>>(new Map());
    const markersRef = useRef<any[]>([]); // ✅ Added missing markersRef for order markers
    const polylineMapRef = useRef<Map<string, any>>(new Map()); 
    const batchRouteLayerRef = useRef<any[]>([]); 

    const stationMarkerRef = useRef<any>(null);
    const socketRef = useRef<Socket | null>(null);
    
    // 强制派单 Modal
    const [forceDispatchModalVisible, setForceDispatchModalVisible] = useState(false);
    const [forceDispatchOrder, setForceDispatchOrder] = useState<Order | null>(null);

    const { currentMerchant } = useMerchant();

    const [isCtrlPressed, setIsCtrlPressed] = useState(false);

    const [isMapReady, setIsMapReady] = useState(false);

    useEffect(() => {
        loadMap();
        connectSocket();
        
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Control') setIsCtrlPressed(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control') setIsCtrlPressed(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        // Inject Pulse CSS
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.7); transform: rotate(-45deg) scale(1); }
                70% { box-shadow: 0 0 0 10px rgba(244, 67, 54, 0); transform: rotate(-45deg) scale(1.1); }
                100% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0); transform: rotate(-45deg) scale(1); }
            }
            .pulse-marker {
                animation: pulse 1.5s infinite;
                z-index: 100 !important;
            }
        `;
        document.head.appendChild(style);

        return () => {
            mapRef.current?.destroy();
            socketRef.current?.disconnect();
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            document.head.removeChild(style);
        };
    }, []);

    // 监听订单变化，重新检查围栏
    useEffect(() => {
        if (mapRef.current && polygonRef.current) {
            checkOrdersInPolygon();
        }
    }, [orders]);

    // ✅ 修复：当地图加载完成且有订单时，确保渲染 Marker
    useEffect(() => {
        if (isMapReady && orders.length > 0) {
            updateMarkers(orders);
            updateRiderMarkers(orders);
        }
    }, [isMapReady, orders]);

    const updateRiderMarkers = (currentOrders: Order[]) => {
        if (!mapRef.current || !window.AMap) return;
        const AMap = window.AMap;
        const map = mapRef.current;
        
        const activeIds = new Set<string>();

        currentOrders.forEach(order => {
            // Only care about active riders
            if (order.status !== OrderStatus.SHIPPING && !order.isReturning) return;
            if (!order.logistics?.currentLat || !order.logistics?.currentLng) return;

            activeIds.add(order.id);

            const position = [order.logistics.currentLng, order.logistics.currentLat];
            
            // Rider Marker
            let marker = markerMapRef.current.get(order.id);
            if (!marker) {
                 const content = `
                    <div style="
                        background-color: white;
                        width: 40px; height: 40px;
                        border-radius: 50%;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                        display: flex; align-items: center; justify-content: center;
                        font-size: 24px;
                        border: 2px solid #1890ff;
                        z-index: 300;
                    ">
                        🛵
                    </div>
                `;
                marker = new AMap.Marker({
                    position: position,
                    content: content,
                    offset: new AMap.Pixel(-20, -20),
                    zIndex: 300, // Higher than destination
                });
                marker.setMap(map);
                markerMapRef.current.set(order.id, marker);
            } else {
                marker.setPosition(position);
                // Simple easing could be added here if needed
            }
        });

        // Remove old rider markers
        markerMapRef.current.forEach((marker, id) => {
            if (!activeIds.has(id)) {
                marker.setMap(null);
                markerMapRef.current.delete(id);
            }
        });
    };

    useEffect(() => {
        // 当按住 Ctrl 且工具已初始化时，开启绘图
        if (mouseToolRef.current) {
            if (isCtrlPressed) {
                // 如果已经有正在画的，不要重复调用
                // 这里简单粗暴：按下 Ctrl 就开启多边形绘制
                mouseToolRef.current.polygon({
                    strokeColor: "#1791fc",
                    strokeOpacity: 1,
                    strokeWeight: 2,
                    fillColor: '#1791fc',
                    fillOpacity: 0.2,
                    strokeStyle: "solid",
                });
                message.info('已开启围栏绘制模式，请在地图上点击绘制，双击结束');
            }
            // 松开 Ctrl 不再关闭工具，允许用户继续绘制直到双击结束
        }
    }, [isCtrlPressed]);

    useEffect(() => {
        loadOrders();
    }, [currentMerchant]);

    const connectSocket = () => {
        const apiUrl = 'http://localhost:4000'; // 这里的地址应该从配置读取
        socketRef.current = io(apiUrl);
        
        socketRef.current.on('connect', () => {
            console.log('Map Socket connected');
        });

        socketRef.current.on('new_order', (newOrder: Order) => {
            // 实时接收新订单
            if (newOrder.deliveryType === 'LAST_MILE') {
                message.info(`收到新订单: ${newOrder.customer.address}`);
                setOrders(prev => {
                    // Check if already exists
                    if (prev.find(o => o.id === newOrder.id)) return prev;
                    return [...prev, newOrder];
                });
            }
        });

        // ✅ 监听订单更新 (如催单、状态变更)
        socketRef.current.on('order_update', (updatedOrder: Order) => {
            setOrders(prev => {
                const next = prev.map(o => o.id === updatedOrder.id ? updatedOrder : o);
                return next;
            });
        });

        // ✅ 监听骑手位置更新
        socketRef.current.on('position_update', (data: any) => {
            setOrders(prev => prev.map(o => {
                if (o.id === data.orderId) {
                    const updates: any = {
                        logistics: { ...o.logistics, currentLat: data.lat, currentLng: data.lng }
                    };

                    if (data.status === 'delivered') {
                        updates.status = OrderStatus.DELIVERED;
                    } else if (data.status === 'returning') {
                        updates.isReturning = true;
                    } else if (data.status === 'rider_idle') {
                        updates.isReturning = false;
                    }

                    return { ...o, ...updates };
                }
                return o;
            }));

            if (data.status === 'delivered') {
                // Refresh data to ensure consistency
                loadOrders();
            }
        });

        // ✅ 监听批量路径规划结果并绘制
        socketRef.current.on('multi_route_planned', (data: { routes: any[][] }) => {
            if (!mapRef.current || !window.AMap) return;
            const AMap = window.AMap;
            const map = mapRef.current;

            // Clear previous route
            batchRouteLayerRef.current.forEach(overlay => map.remove(overlay));
            batchRouteLayerRef.current = [];

            const routes = data.routes;
            if (!routes || routes.length === 0) return;

            console.log(`🎨 绘制 ${routes.length} 条智能调度路径`);

            const riderColors = ['#1890ff', '#722ed1', '#fa541c', '#13c2c2', '#eb2f96'];

            routes.forEach((points, riderIdx) => {
                if (!points || points.length < 2) return;
                
                const baseColor = riderColors[riderIdx % riderColors.length];

                // Draw Segments
                for (let i = 0; i < points.length - 1; i++) {
                    const current = points[i];
                    const next = points[i+1];
                    const isUrgentPath = next.type === 'urgent'; 
                    
                    const polyline = new AMap.Polyline({
                        path: [[current.lng, current.lat], [next.lng, next.lat]],
                        strokeColor: isUrgentPath ? '#cf1322' : baseColor,
                        strokeWeight: 6,
                        strokeStyle: "solid",
                        lineJoin: 'round',
                        zIndex: 200,
                        showDir: true
                    });
                    map.add(polyline);
                    batchRouteLayerRef.current.push(polyline);
                }

                // Draw Sequence Markers
                points.forEach((p: any, idx: number) => {
                    if (p.type === 'station') return; 
                    
                    const content = `
                        <div style="
                            background-color: ${p.type === 'urgent' ? '#cf1322' : baseColor};
                            color: white;
                            width: 24px; height: 24px;
                            border-radius: 50%;
                            text-align: center; line-height: 24px;
                            font-weight: bold;
                            border: 2px solid white;
                            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                            font-family: Arial;
                        ">${p.sequence}</div>
                    `;
                    
                    const marker = new AMap.Marker({
                        position: [p.lng, p.lat],
                        content: content,
                        offset: new AMap.Pixel(-12, -30),
                        zIndex: 210
                    });
                    map.add(marker);
                    batchRouteLayerRef.current.push(marker);
                });
            });

            map.setFitView(batchRouteLayerRef.current, false, [50, 50, 50, 50]);
            
            setTimeout(() => {
                 batchRouteLayerRef.current.forEach(overlay => map.remove(overlay));
                 batchRouteLayerRef.current = [];
            }, 15000);
        });
    };

    const loadOrders = async () => {
        if (!currentMerchant) return;
        const res = await fetchOrders({ merchantId: currentMerchant.id });
        if (res.code === 200) {
            // 简单过滤一下，虽然 API 可能返回所有，我们这里只关注末端配送或待调度的
            const activeOrders = res.data.filter(o => 
                o.status === OrderStatus.PENDING || 
                (o.deliveryType === 'LAST_MILE' && o.status !== OrderStatus.COMPLETED)
            );
            setOrders(activeOrders);
            // updateMarkers(activeOrders); // 移除直接调用，交由 useEffect 统一管理
        }
    };

    const loadMap = () => {
        AMapLoader.load({
            key: '9ed0e07b10c4a6c7516db4f0b3f01d3f', 
            version: '2.0',
            plugins: ['AMap.MouseTool', 'AMap.PolygonEditor', 'AMap.GeometryUtil'],
        }).then((AMap) => {
            mapRef.current = new AMap.Map('delivery-map-container', {
                zoom: 14, // 放大一点看同城
                center: STATION_LOCATION, // 以配送站为中心
                mapStyle: 'amap://styles/whitesmoke', // 清爽风格
            });

            // 1. 绘制配送站
            stationMarkerRef.current = new AMap.Marker({
                position: STATION_LOCATION,
                icon: new AMap.Icon({
                    size: new AMap.Size(40, 40),
                    image: '//a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-default.png', 
                    imageSize: new AMap.Size(40, 40),
                }),
                title: '三里屯配送站 (我在这里)',
                offset: new AMap.Pixel(-20, -40),
                label: { content: '🏠 配送站', direction: 'top' }
            });
            stationMarkerRef.current.setMap(mapRef.current);

            // ✅ 恢复电子围栏
            const savedFence = localStorage.getItem('station_fence');
            if (savedFence) {
                try {
                    const path = JSON.parse(savedFence);
                    polygonRef.current = new AMap.Polygon({
                        path: path,
                        strokeColor: "#FF33FF", 
                        strokeWeight: 6,
                        strokeOpacity: 0.2,
                        fillOpacity: 0.4,
                        fillColor: '#1791fc',
                        zIndex: 50,
                    });
                    mapRef.current.add(polygonRef.current);
                    setHasPolygon(true);
                    
                    // 启用编辑
                    polyEditorRef.current = new AMap.PolygonEditor(mapRef.current, polygonRef.current);
                    polyEditorRef.current.open();
                    polyEditorRef.current.on('adjust', () => {
                        const newPath = polygonRef.current.getPath().map((p: any) => [p.lng, p.lat]);
                        localStorage.setItem('station_fence', JSON.stringify(newPath));
                        checkOrdersInPolygon();
                    });
                } catch (e) {
                    console.error('Failed to parse saved fence', e);
                }
            }

            // 初始化绘图工具
            mouseToolRef.current = new AMap.MouseTool(mapRef.current);
            
            mouseToolRef.current.on('draw', (e: any) => {
                if (polygonRef.current) {
                    mapRef.current.remove(polygonRef.current);
                    if (polyEditorRef.current) {
                        polyEditorRef.current.close();
                        polyEditorRef.current = null;
                    }
                }
                polygonRef.current = e.obj;
                setHasPolygon(true); 
                mouseToolRef.current.close();

                // 保存并开启编辑
                const path = polygonRef.current.getPath().map((p: any) => [p.lng, p.lat]);
                localStorage.setItem('station_fence', JSON.stringify(path));

                polyEditorRef.current = new AMap.PolygonEditor(mapRef.current, polygonRef.current);
                polyEditorRef.current.open();
                polyEditorRef.current.on('adjust', () => {
                     const newPath = polygonRef.current.getPath().map((p: any) => [p.lng, p.lat]);
                     localStorage.setItem('station_fence', JSON.stringify(newPath));
                     checkOrdersInPolygon();
                });

                checkOrdersInPolygon();
            });

            // 标记地图已准备就绪
            setIsMapReady(true);
        }).catch((e) => {
            console.error('Map loading failed', e);
        });
    };

    const updateMarkers = (currentOrders: Order[]) => {
        if (!mapRef.current || !window.AMap) return;
        const AMap = window.AMap;

        // ⚠️ 防御性检查：确保 markersRef 已初始化
        if (!markersRef.current) markersRef.current = [];

        // 清除旧 Marker
        mapRef.current.remove(markersRef.current);
        markersRef.current = [];

        currentOrders.forEach(order => {
            // 使用终点 (收货地址) 作为标记点
            const position = [order.logistics.endLng, order.logistics.endLat];
            
            // 计算颜色和样式
            const score = order.priorityScore || 0;
            let bgColor = '#4CAF50'; // Green (Normal)
            let borderColor = '#fff';
            let animationClass = '';

            if (score >= 60 || order.isUrged) {
                bgColor = '#F44336'; // Red (Urgent)
                animationClass = 'pulse-marker';
            } else if (score >= 30) {
                bgColor = '#FF9800'; // Orange (Medium)
            }

            if (order.status === OrderStatus.SHIPPING) {
                 bgColor = '#2196F3'; // Blue (Shipping)
            }
            
            // 构建自定义 Marker 内容
            const content = `
                <div class="custom-marker ${animationClass}" style="
                    background-color: ${bgColor};
                    width: 30px;
                    height: 30px;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    border: 2px solid ${borderColor};
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <div style="transform: rotate(45deg); color: white; font-size: 12px; font-weight: bold;">
                        ${order.isUrged ? '🔥' : (score >= 30 ? '⚡' : '📦')}
                    </div>
                </div>
            `;
            
            const marker = new AMap.Marker({
                position: position,
                content: content,
                offset: new AMap.Pixel(-15, -30),
                title: `订单: ${order.customer.address} (分值:${score})`,
                extData: { orderId: order.id, status: order.status, score: score, isUrged: order.isUrged }
            });
            
            marker.setMap(mapRef.current);
            markersRef.current.push(marker);
        });
        
        // 如果有多边形，重新检查一下包含关系
        if (polygonRef.current) {
            checkOrdersInPolygon();
        }
    };

    const startDraw = () => {
        message.info('按住键盘 Ctrl 键，然后在地图上点击绘制围栏');
    };

    const checkOrdersInPolygon = () => {
        if (!window.AMap) return;
        const AMap = window.AMap;
        
        // 如果没有多边形，显示所有 PENDING 订单，并全部选中（允许全部发货）
        if (!polygonRef.current) {
            const allPendingIds: string[] = [];
            markersRef.current.forEach(marker => {
                const ext = marker.getExtData();
                marker.show(); // 显示所有
                marker.off('click'); // 清除事件
                
                // 恢复默认图标 (这里需要根据优先级恢复)
                // 由于我们现在使用自定义 content，所以只要不被覆盖成灰色就行
                // 暂时这里不重新 setContent，假设初始状态是对的
                // 但如果被变红过，可能需要恢复

                // 简化逻辑：只要没有围栏，所有都恢复原始显示状态（通过 updateMarkers 重新渲染太重了）
                // 我们直接修改透明度或样式？
                // 其实 updateMarkers 每次都会重建 marker，所以这里只要不做额外隐藏操作即可
                
                // 但是 checkOrdersInPolygon 会修改 icon
                // 之前的逻辑是 setIcon，现在是 content
                // 我们需要重新 setContent 吗？
                // 为了简单，我们让 updateMarkers 负责渲染，checkOrdersInPolygon 只负责 filter 和 highlight
                
                // 这里我们只负责收集 ID
                if (ext.status === OrderStatus.PENDING) {
                    allPendingIds.push(ext.orderId);
                }
            });
            setSelectedOrderIds(allPendingIds);
            return;
        }
        
        const path = polygonRef.current.getPath();
        let inIds: string[] = [];

        markersRef.current.forEach(marker => {
            const position = marker.getPosition();
            const ext = marker.getExtData();
            marker.off('click'); // 清除事件

            const isPointInRing = AMap.GeometryUtil.isPointInRing(position, path);
            
            // 获取原始颜色逻辑
            let bgColor = '#4CAF50'; 
            if (ext.score >= 60 || ext.isUrged) bgColor = '#F44336';
            else if (ext.score >= 30) bgColor = '#FF9800';
            if (ext.status === OrderStatus.SHIPPING) bgColor = '#2196F3';

            if (isPointInRing) {
                marker.show(); // 显示围栏内的
                
                // 选中状态：加个边框？或者保持原样
                // 之前的逻辑是变蓝，现在我们保持优先级颜色，但是给个高亮边框
                // 重新构建 content
                const animationClass = (ext.score >= 60 || ext.isUrged) ? 'pulse-marker' : '';
                
                const content = `
                    <div class="custom-marker ${animationClass}" style="
                        background-color: ${bgColor};
                        width: 30px;
                        height: 30px;
                        border-radius: 50% 50% 50% 0;
                        transform: rotate(-45deg);
                        border: 3px solid #1890ff; /* 选中边框 */
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">
                        <div style="transform: rotate(45deg); color: white; font-size: 12px; font-weight: bold;">
                             ${ext.isUrged ? '🔥' : (ext.score >= 30 ? '⚡' : '📦')}
                        </div>
                    </div>
                `;
                marker.setContent(content);

                if (ext.status === OrderStatus.PENDING) {
                    inIds.push(ext.orderId);
                }
            } else {
                // 超区：显示为灰色/禁止色，但保留形状
                marker.show();
                
                // 变灰
                const content = `
                    <div class="custom-marker" style="
                        background-color: #999;
                        width: 30px;
                        height: 30px;
                        border-radius: 50% 50% 50% 0;
                        transform: rotate(-45deg);
                        border: 2px solid #fff;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        opacity: 0.8;
                    ">
                        <div style="transform: rotate(45deg); color: white; font-size: 12px; font-weight: bold;">
                            🚫
                        </div>
                    </div>
                `;
                marker.setContent(content);

                // 绑定点击事件：强制发货
                if (ext.status === OrderStatus.PENDING) {
                     marker.on('click', () => {
                         const order = orders.find(o => o.id === ext.orderId);
                         if (order) {
                             setForceDispatchOrder(order);
                             setForceDispatchModalVisible(true);
                         }
                     });
                }
            }
        });
        
        setSelectedOrderIds(inIds);
        // Removed automatic message popups to prevent spamming
    };

    const clearFence = () => {
        if (polygonRef.current) {
            if (!window.AMap) return;
            const AMap = window.AMap;
            const path = polygonRef.current.getPath();

            // 检查是否有围栏内的在途订单
            let activeOrderInFence = false;
            markersRef.current.forEach(marker => {
                 const ext = marker.getExtData();
                 if (ext.status === OrderStatus.SHIPPING) {
                      if (AMap.GeometryUtil.isPointInRing(marker.getPosition(), path)) {
                          activeOrderInFence = true;
                      }
                 }
            });

            if (activeOrderInFence) {
                 message.error('围栏内有正在配送的订单，禁止清除围栏！');
                 return;
            }

            mapRef.current.remove(polygonRef.current);
            polygonRef.current = null;
            if (polyEditorRef.current) {
                polyEditorRef.current.close();
                polyEditorRef.current = null;
            }
            localStorage.removeItem('station_fence'); // ✅ 清除存储
            setHasPolygon(false); // ✅ 更新状态
            checkOrdersInPolygon(); // 重新检查，恢复显示所有
            message.info('电子围栏已清除，显示所有订单');
        }
    };

    const handleForceDispatch = async () => {
        if (!forceDispatchOrder) return;
        message.loading({ content: '正在强制派单...', key: 'force_dispatch' });
        try {
            const res = await dispatchBatch([forceDispatchOrder.id]);
            if (res.code === 200) {
                message.success({ content: '强制派单成功！', key: 'force_dispatch' });
                setForceDispatchModalVisible(false);
                setForceDispatchOrder(null);
                loadOrders(); // Refresh
            } else {
                message.error({ content: res.msg || '派单失败', key: 'force_dispatch' });
            }
        } catch (e) {
            message.error({ content: '系统错误', key: 'force_dispatch' });
        }
    };

    const handleManualCheck = () => {
        checkOrdersInPolygon();
        const count = selectedOrderIds.length;
        if (count > 0) {
            message.success(`已选中围栏内 ${count} 个订单`);
        } else {
            message.info('当前围栏内没有待发货订单');
        }
    };

    const handleBatchDispatch = async () => {
        if (selectedOrderIds.length === 0) {
             message.warning('围栏内没有待发货订单');
             return;
        }
        message.loading({ content: '正在规划最优路线并指派骑手...', key: 'dispatch' });
        
        try {
            const res = await dispatchBatch(selectedOrderIds);
            if (res.code === 200) {
                message.success({ content: `成功指派！骑手已接单，共 ${selectedOrderIds.length} 单`, key: 'dispatch' });
                // 刷新列表
                loadOrders();
                // 清空选择
                setSelectedOrderIds([]);
                // 保持围栏不清除，方便用户继续操作或查看
            } else {
                message.error({ content: res.msg || '调度失败', key: 'dispatch' });
            }
        } catch (e) {
            console.error(e);
            message.error({ content: '系统错误', key: 'dispatch' });
        }
    };

    return (
        <Card 
            title={
                <Space>
                    <span>🚚 末端配送调度台</span>
                    <Badge count={orders.filter(o => o.status === OrderStatus.PENDING).length} overflowCount={99}>
                        <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>待调度</span>
                    </Badge>
                </Space>
            } 
            extra={
                <Space>
                    <Button onClick={startDraw}>1. 绘制电子围栏</Button>
                    {hasPolygon && <Button onClick={clearFence}>清除围栏</Button>}
                    <Button onClick={handleManualCheck}>2. 刷新选中 ({selectedOrderIds.length})</Button>
                    <Button 
                        type="primary" 
                        disabled={selectedOrderIds.length === 0}
                        onClick={handleBatchDispatch}
                    >
                        3. 智能调度发货
                    </Button>
                </Space>
            }
        >
            <Alert 
                message="操作指引：系统会自动推送新订单 -> 点击“绘制电子围栏”圈选可配送区域 -> 只有围栏内的订单（蓝色）会被选中 -> 点击“智能调度”一键发货。" 
                type="info" 
                showIcon 
                className="mb-4" 
            />
            <div id="delivery-map-container" style={{ width: '100%', height: '600px' }} />

            <Modal
                title="⚠️ 强制派单确认"
                open={forceDispatchModalVisible}
                onOk={handleForceDispatch}
                onCancel={() => {
                    setForceDispatchModalVisible(false);
                    setForceDispatchOrder(null);
                }}
                okText="确认强制派单"
                okButtonProps={{ danger: true }}
                cancelText="取消"
            >
                <p>订单：{forceDispatchOrder?.customer.address}</p>
                <p style={{ color: 'red' }}>该订单超出当前配送围栏范围，强制派送可能导致配送超时或骑手投诉。</p>
                <p>确认要忽略限制继续派单吗？</p>
            </Modal>
        </Card>
    );
};

export default DeliveryMap;
