import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Card, Row, Col, Statistic, List, Tag, Badge, Typography } from 'antd';
import ReactECharts from 'echarts-for-react';
import { Order, OrderStatus, PositionUpdatePayload } from '@el/types';
import { fetchOrders } from '../services/orderService';
import { 
    ClockCircleOutlined, 
    UserOutlined, 
    ThunderboltOutlined,
    WarningOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import { io, Socket } from 'socket.io-client';
import { useMerchant } from '../contexts/MerchantContext';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const socketRef = useRef<Socket | null>(null);
    const { currentMerchant } = useMerchant();
    type ExtraEvent = { type: 'success' | 'info' | 'warning', text: string, id: string };
    const [extraEvents, setExtraEvents] = useState<ExtraEvent[]>([]);
    const returningSetRef = useRef<Set<number>>(new Set());
    
    // 持久化：加载/保存事件到 localStorage，保证切换页面后仍能看到返程/回站动态
    const STORAGE_KEY = 'dashboard_events';
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed: ExtraEvent[] = JSON.parse(raw);
                setExtraEvents(parsed.slice(0, 50));
            }
        } catch {}
    }, []);
    const persistEvents = (events: ExtraEvent[]) => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, 50))); } catch {}
    };
    
    const loadData = async () => {
        if (!currentMerchant) return;
        const res = await fetchOrders({ merchantId: currentMerchant.id });
        if (res.code === 200) {
            setOrders(res.data);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentMerchant]);

    useEffect(() => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
        socketRef.current = io(apiUrl);

        socketRef.current.on('connect', () => {
            console.log('✅ Dashboard Connected to Socket');
        });

        socketRef.current.on('position_update', (data: PositionUpdatePayload) => {
            // Optimistic update for map smoothness could go here, 
            // but for now we rely on loadData() for full sync or update local state
            
            // If we want smooth movement without full reload:
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

                    return {
                        ...o,
                        ...updates
                    };
                }
                return o;
            }));

            if (data.status === 'delivered') {
                loadData();
            }

            if (data.status === 'rider_idle' && typeof (data as any).riderIndex !== 'undefined') {
                const idx = Number((data as any).riderIndex);
                const text = `批次完成：骑手 ${idx + 1} 已回站`;
                const ev: ExtraEvent = { type: 'success', text, id: `rider_idle_${idx}_${Date.now()}` };
                setExtraEvents((prev: ExtraEvent[]) => {
                    const filtered = prev.filter(p => p.text !== text);
                    const next = [ev, ...filtered].slice(0, 50);
                    persistEvents(next);
                    return next;
                });
                // 结束返程，允许后续返程提示再次出现
                returningSetRef.current.delete(idx);

                // 无订单ID事件：清空所有订单返程标志，避免饼图/负荷残留
                if (!data.orderId) {
                    setOrders(prev => prev.map(o => ({ ...o, isReturning: false })));
                }
            }

            if (data.status === 'returning' && typeof (data as any).riderIndex !== 'undefined') {
                const idx = Number((data as any).riderIndex);
                if (!returningSetRef.current.has(idx)) {
                    returningSetRef.current.add(idx);
                    const text = `返程开始：骑手 ${idx + 1} 正在返回站点`;
                    const ev: ExtraEvent = { type: 'info', text, id: `returning_${idx}_${Date.now()}` };
                    setExtraEvents((prev: ExtraEvent[]) => {
                        const filtered = prev.filter(p => p.text !== text);
                        const next = [ev, ...filtered].slice(0, 50);
                        persistEvents(next);
                        return next;
                    });
                }
            }
        });

        socketRef.current.on('order_updated', (payload: any) => {
            if (payload && payload.orderId && payload.status === OrderStatus.COMPLETED) {
                const text = `订单 ${payload.orderId} 已签收`;
                const ev: ExtraEvent = { type: 'success', text, id: `completed_${payload.orderId}_${Date.now()}` };
                setExtraEvents((prev: ExtraEvent[]) => {
                    const filtered = prev.filter(p => p.text !== text);
                    const next = [ev, ...filtered].slice(0, 50);
                    persistEvents(next);
                    return next;
                });
                // 本地乐观更新
                setOrders(prev => prev.map(o => o.id === payload.orderId ? { ...o, status: OrderStatus.COMPLETED } : o));
            }
            loadData();
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [currentMerchant]);

    // --- Data Processing ---
    
    // 1. Dynamic Rider Status
    // Infer busy riders from shipping orders
    const shippingOrders = orders.filter(o => o.status === OrderStatus.SHIPPING);
    const busyRidersCount = shippingOrders.length; 
    
    // Returning riders
    const returningOrders = orders.filter(o => o.isReturning);
    const returningRidersCount = returningOrders.length;

    // Mock total pool size (e.g. 10 base + any extras)
    const totalRidersCap = 10;
    const totalRiders = Math.min(totalRidersCap, busyRidersCount + returningRidersCount + 2);
    const idleRiders = Math.max(0, totalRiders - busyRidersCount - returningRidersCount);
    
    // 2. Core Metrics
    const pendingOrders = orders.filter(o => o.status === OrderStatus.PENDING).length;
    // Calculate max wait time (minutes) for pending orders
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 60000); // 每分钟触发一次重算
        return () => clearInterval(id);
    }, []);
    const maxWaitTime = useMemo(() => {
        const pending = orders.filter(o => o.status === OrderStatus.PENDING);
        if (pending.length === 0) return 0;
        const oldest = pending.reduce((prev, curr) => (prev.createdAt < curr.createdAt ? prev : curr));
        return Math.floor((Date.now() - new Date(oldest.createdAt).getTime()) / 60000);
    }, [orders, tick]);

    // 3. Capacity Load
    const activeLoadCount = busyRidersCount + returningRidersCount;
    const capacityLoad = Math.min(100, Math.round((activeLoadCount / totalRiders) * 100));

    // 4. Fulfillment Rate
    const completedCount = orders.filter(o => o.status === OrderStatus.COMPLETED || o.status === OrderStatus.DELIVERED).length;
    const totalCount = orders.length || 1;
    const fulfillmentRate = Math.round((completedCount / totalCount) * 100);

    // 5. 订单动态（剔除骑手事件，仅显示订单相关）
    const orderDynamics = useMemo(() => {
        const list = [];
        // 顾客催单
        orders.filter(o => o.isUrged).forEach(o => list.push({ type: 'urge', text: `顾客 ${o.customer.name} 点击了催单`, id: o.id }));
        // 积压提醒
        if (maxWaitTime > 30) list.push({ type: 'timeout', text: `积压严重！最长等待已超 ${maxWaitTime} 分钟`, id: 'alert' });

        // 已送达
        const deliveredEvents = orders
            .filter(o => o.status === OrderStatus.DELIVERED)
            .map(o => {
                const evt = (o.timeline || []).find(e => e.status === 'delivered');
                const ts = evt?.timestamp || o.createdAt;
                return { id: o.id, text: `订单 ${o.id} 已准时送达`, ts };
            })
            .sort((a, b) => (new Date(b.ts).getTime() - new Date(a.ts).getTime()))
            .slice(0, 10)
            .map(e => ({ type: 'success', text: e.text, id: e.id }));

        // 已签收
        const completedEvents = orders
            .filter(o => o.status === OrderStatus.COMPLETED)
            .map(o => {
                const evt = (o.timeline || []).find(e => e.status === 'completed');
                const ts = evt?.timestamp || o.createdAt;
                return { id: o.id, text: `订单 ${o.id} 已签收`, ts };
            })
            .sort((a, b) => (new Date(b.ts).getTime() - new Date(a.ts).getTime()))
            .slice(0, 10)
            .map(e => ({ type: 'success', text: e.text, id: `completed_${e.id}` }));

        // 过滤本地持久化事件：仅保留以“订单”开头的文本（剔除“返程开始/批次完成”等骑手事件）
        const orderExtraEvents = extraEvents.filter(ev => ev.text.startsWith('订单'));

        return [...deliveredEvents, ...completedEvents, ...orderExtraEvents, ...list].slice(0, 6);
    }, [orders, maxWaitTime, extraEvents]);

    // --- Chart Options ---

    // Gauge: Capacity
    const gaugeColor = capacityLoad > 80 ? '#cf1322' : (capacityLoad > 50 ? '#faad14' : '#3f8600');
    const gaugeOption = {
        series: [{
            type: 'gauge',
            startAngle: 180,
            endAngle: 0,
            min: 0,
            max: 100,
            splitNumber: 5,
            itemStyle: { color: gaugeColor },
            progress: { show: true, width: 10 },
            pointer: { show: false },
            axisLine: { lineStyle: { width: 10 } },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            title: { show: false },
            detail: { fontSize: 20, offsetCenter: [0, '0%'], valueAnimation: true, formatter: '{value}%' },
            data: [{ value: capacityLoad }]
        }]
    };

    // Pie: Rider Status
    const riderPieOption = {
        tooltip: { trigger: 'item' },
        legend: { top: '5%', left: 'center' },
        series: [{
            name: '骑手状态',
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
            label: { show: false, position: 'center' },
            emphasis: { label: { show: true, fontSize: 20, fontWeight: 'bold' } },
            labelLine: { show: false },
            data: [
                { value: idleRiders, name: '空闲', itemStyle: { color: '#52c41a' } },
                { value: busyRidersCount, name: '忙碌', itemStyle: { color: '#faad14' } },
                { value: returningRidersCount, name: '返回', itemStyle: { color: '#1890ff' } },
                { value: 0, name: '离线', itemStyle: { color: '#d9d9d9' } }
            ]
        }]
    };

    

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="mb-6 flex justify-between items-center">
                <Title level={3} style={{ margin: 0 }}>🚚 智能调度指挥中心</Title>
                <Tag color="processing" icon={<ThunderboltOutlined />}>System Online</Tag>
            </div>

            {/* Top Row: Core Metrics */}
            <Row gutter={16} className="mb-6">
                <Col span={5}>
                    <Card bordered={false} hoverable>
                        <Statistic title="待调度订单" value={pendingOrders} valueStyle={{ color: pendingOrders > 5 ? '#cf1322' : '#3f8600' }} prefix={<ClockCircleOutlined />} />
                    </Card>
                </Col>
                <Col span={5}>
                    <Card bordered={false} hoverable>
                        <Statistic title="积压时长 (Max)" value={maxWaitTime} suffix="min" valueStyle={{ color: maxWaitTime > 30 ? '#cf1322' : '#faad14' }} />
                    </Card>
                </Col>
                <Col span={5}>
                    <Card bordered={false} hoverable>
                        <Statistic title="在线骑手" value={totalRiders} prefix={<UserOutlined />} suffix={`(空闲 ${idleRiders})`} />
                    </Card>
                </Col>
                <Col span={5}>
                    <Card bordered={false} hoverable bodyStyle={{ padding: '10px 24px' }}>
                         <div className="text-gray-500 mb-1">运力负荷</div>
                         <div style={{ height: 100, marginTop: -20 }}>
                            <ReactECharts option={gaugeOption} style={{ height: '100%', width: '100%' }} />
                         </div>
                    </Card>
                </Col>
                <Col span={4}>
                    <Card bordered={false} hoverable>
                        <Statistic title="今日履约率" value={fulfillmentRate} suffix="%" valueStyle={{ color: '#3f8600' }} prefix={<CheckCircleOutlined />} />
                    </Card>
                </Col>
            </Row>

            {/* Middle Row: Status & Logs */}
            <Row gutter={16} className="mb-6">
                <Col span={12}>
                    <Card title="骑手状态分布" bordered={false} className="h-full">
                        <ReactECharts option={riderPieOption} style={{ height: '250px' }} />
                    </Card>
                </Col>
                <Col span={12}>
                    <Card title="📦 订单动态监控" bordered={false} className="h-full" bodyStyle={{ padding: '0 12px' }}>
                        <div className="h-[250px] overflow-y-auto custom-scrollbar">
                            <List
                                dataSource={orderDynamics}
                                renderItem={item => (
                                    <List.Item>
                                        <List.Item.Meta
                                            avatar={
                                                item.type === 'urge' ? <Badge status="error" text="催" /> :
                                                item.type === 'timeout' ? <WarningOutlined style={{ color: 'red' }} /> :
                                                <CheckCircleOutlined style={{ color: 'green' }} />
                                            }
                                            title={<Text className="text-xs">{item.text}</Text>}
                                        />
                                    </List.Item>
                                )}
                            />
                            {orderDynamics.length === 0 && <div className="text-center text-gray-400 py-4">暂无订单动态</div>}
                        </div>
                    </Card>
                </Col>
            </Row>

            
        </div>
    );
};

export default Dashboard;
