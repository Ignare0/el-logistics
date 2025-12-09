import React, { useEffect, useRef, useState } from 'react';
import { Card, Button, message, Alert } from 'antd';
import AMapLoader from '@amap/amap-jsapi-loader';
import { Order } from '@el/types';
import { fetchOrders } from '../services/orderService';
import { useMerchant } from '../contexts/MerchantContext';

const DeliveryMap: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const mapRef = useRef<any>(null);
    const polygonRef = useRef<any>(null);
    const mouseToolRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const { currentMerchant } = useMerchant();

    useEffect(() => {
        loadMap();
        return () => {
            mapRef.current?.destroy();
        };
    }, []);

    useEffect(() => {
        loadOrders();
    }, [currentMerchant]);

    const loadOrders = async () => {
        if (!currentMerchant) return;
        const res = await fetchOrders({ merchantId: currentMerchant.id });
        if (res.code === 200) {
            setOrders(res.data);
            updateMarkers(res.data);
        }
    };

    const loadMap = () => {
        AMapLoader.load({
            key: '9ed0e07b10c4a6c7516db4f0b3f01d3f', 
            version: '2.0',
            plugins: ['AMap.MouseTool', 'AMap.PolygonEditor', 'AMap.GeometryUtil'],
        }).then((AMap) => {
            mapRef.current = new AMap.Map('delivery-map-container', {
                zoom: 5,
                center: [105.602725, 35.076636], // 中国中心
            });

            // 初始化绘图工具
            mouseToolRef.current = new AMap.MouseTool(mapRef.current);
            
            mouseToolRef.current.on('draw', (e: any) => {
                if (polygonRef.current) {
                    mapRef.current.remove(polygonRef.current);
                }
                polygonRef.current = e.obj;
                mouseToolRef.current.close();
                checkOrdersInPolygon();
            });
        }).catch((e) => {
            console.error(e);
        });
    };

    const updateMarkers = (currentOrders: Order[]) => {
        if (!mapRef.current || !window.AMap) return;
        const AMap = window.AMap;

        // 清除旧 Marker
        mapRef.current.remove(markersRef.current);
        markersRef.current = [];

        currentOrders.forEach(order => {
            // 假设使用发货地作为标记点
            const position = [order.logistics.startLng, order.logistics.startLat];
            
            const marker = new AMap.Marker({
                position: position,
                title: `订单: ${order.id}`,
                extData: { orderId: order.id }
            });
            
            marker.setMap(mapRef.current);
            markersRef.current.push(marker);
        });
    };

    const startDraw = () => {
        if (mouseToolRef.current) {
            if(polygonRef.current) mapRef.current.remove(polygonRef.current);
            mouseToolRef.current.polygon({
                strokeColor: "#FF33FF",
                strokeOpacity: 1,
                strokeWeight: 2,
                fillColor: '#1791fc',
                fillOpacity: 0.4,
                strokeStyle: "solid",
            });
            message.info('请在地图上点击绘制多边形，双击结束');
        }
    };

    const checkOrdersInPolygon = () => {
        if (!polygonRef.current || !window.AMap) return;
        const AMap = window.AMap;
        
        const path = polygonRef.current.getPath();
        let inCount = 0;

        markersRef.current.forEach(marker => {
            const position = marker.getPosition();
            const isPointInRing = AMap.GeometryUtil.isPointInRing(position, path);
            
            if (isPointInRing) {
                inCount++;
                marker.setIcon('//a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-red.png'); // 范围内高亮
            } else {
                marker.setIcon('//a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-default.png');
            }
        });
        
        message.success(`范围内共有 ${inCount} 个订单`);
    };

    return (
        <Card title={`🚚 智能配送范围管理 (当前订单数: ${orders.length})`} extra={<Button type="primary" onClick={startDraw}>绘制配送区域</Button>}>
            <Alert message="提示：点击“绘制配送区域”在地图上圈选，系统将自动识别区域内的订单。" type="info" showIcon className="mb-4" />
            <div id="delivery-map-container" style={{ width: '100%', height: '600px' }} />
        </Card>
    );
};

export default DeliveryMap;
