import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Card, message, Space, Popover, Typography, Modal } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TablePaginationConfig } from 'antd/es/table';
import type { SorterResult, FilterValue } from 'antd/es/table/interface';
import { fetchOrders, shipOrder } from '../services/orderService';
import { Order, OrderStatus, OrderStatusMap } from '@el/types';
import CreateOrderModal from './CreateOrderModal';
import { useMerchant } from '../contexts/MerchantContext';
import { RocketOutlined, CarOutlined, MedicineBoxOutlined, CoffeeOutlined, ShopOutlined, FireOutlined, SearchOutlined } from '@ant-design/icons';
import { Input } from 'antd';
import AMapLoader from '@amap/amap-jsapi-loader';
import { io, Socket } from 'socket.io-client';
import { fetchRiders } from '../services/orderService';

const { Text } = Typography;

const OrderList: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const { currentMerchant } = useMerchant();

    const STORAGE_KEY = 'order_table_state';
    const [savedFilters, setSavedFilters] = useState<Record<string, FilterValue | null>>({});
    const [savedSorter, setSavedSorter] = useState<{ field?: string; columnKey?: React.Key; order?: 'ascend' | 'descend' | null }>({});
    const [savedPagination, setSavedPagination] = useState<{ current?: number; pageSize?: number }>({});

    // 电子围栏相关
    const [fencePath, setFencePath] = useState<any[] | null>(null);
    const [amapLoaded, setAmapLoaded] = useState(false);
    const [riderPool, setRiderPool] = useState<{ maxRiders: number; perRiderMaxOrders: number; riders: { id: number; status: 'idle'|'busy'|'returning'|'offline'; activeOrderIds: string[] }[] }>({ maxRiders: 5, perRiderMaxOrders: 2, riders: [] });
    const socketRef = React.useRef<Socket | null>(null);

    useEffect(() => {
        // 加载 AMap 工具
        AMapLoader.load({
            key: '9ed0e07b10c4a6c7516db4f0b3f01d3f', 
            version: '2.0',
            plugins: ['AMap.GeometryUtil'],
        }).then(() => {
            setAmapLoaded(true);
        });

        // 读取围栏数据
        const saved = localStorage.getItem('station_fence');
        if (saved) {
            try {
                setFencePath(JSON.parse(saved));
            } catch(e) {}
        }

        // 恢复表格筛选/排序/分页
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                if (parsed?.filters) setSavedFilters(parsed.filters);
                if (parsed?.sorter) setSavedSorter(parsed.sorter);
                if (parsed?.pagination) setSavedPagination(parsed.pagination);
            } catch (e) {}
        }

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
        try {
            socketRef.current = io(apiUrl);
            socketRef.current.on('rider_status', (payload: any) => {
                if (payload && payload.riders) setRiderPool(payload);
                else if (payload && payload.data && payload.data.riders) setRiderPool(payload.data);
            });
            fetchRiders().then(res => { if (res && (res as any).data) setRiderPool((res as any).data); }).catch(() => {});
        } catch {}

        return () => {
            socketRef.current?.disconnect();
        }
    }, []);

    const isInFence = (order: Order) => {
        // 没有围栏或者工具未加载，默认视为在范围内（或不限制）
        if (!fencePath || !amapLoaded || !window.AMap) return true;
        
        if (!order.logistics || !order.logistics.endLng) return true;

        const point = [order.logistics.endLng, order.logistics.endLat];
        return window.AMap.GeometryUtil.isPointInRing(point, fencePath);
    };

    const loadData = async () => {
        if (!currentMerchant) return;
        
        setLoading(true);
        try {
            const res = await fetchOrders({ merchantId: currentMerchant.id });
            if (res.code === 200) {
                // ✅ 按优先级分数降序排列 (高分在前)
                const sortedData = res.data.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
                setOrders(sortedData);
            } else {
                message.error(res.msg || '获取数据失败');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentMerchant]); // 监听商家切换

    const handleShip = async (id: string) => {
        const idleCount = riderPool.riders.filter(r => r.status === 'idle').length;
        if (idleCount <= 0) { message.warning('当前无空闲骑手，无法操作'); return; }
        setActionLoading(id);
        try {
            const res = await shipOrder(id);
            if (res.code === 200) {
                message.success('发货成功！物流轨迹模拟已启动');
                // ✅ 修正：使用后端返回的最新数据来更新本地状态
                setOrders(prev => prev.map(item =>
                    item.id === id ? { ...item, ...res.data } : item
                ));
            } else {
                message.error(res.msg);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setActionLoading(null);
        }
    };

    

    const handleForceDispatch = (record: Order) => {
        const idleCount = riderPool.riders.filter(r => r.status === 'idle').length;
        if (idleCount <= 0) { message.warning('当前无空闲骑手，无法操作'); return; }
        Modal.confirm({
            title: '⚠️ 强制派单确认',
            content: (
                <div>
                    <p>订单：{record.customer.address}</p>
                    <p style={{ color: 'red' }}>该订单超出当前配送围栏范围，强制派送可能导致配送超时或骑手投诉。</p>
                    <p>确认要忽略限制继续派单吗？</p>
                </div>
            ),
            okText: '确认强制派单',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                await handleShip(record.id);
            }
        });
    };

    const columns: ColumnsType<Order> = [
        {
            title: '优先级',
            dataIndex: 'priorityScore',
            key: 'priorityScore',
            width: 100,
            sorter: (a, b) => (a.priorityScore || 0) - (b.priorityScore || 0),
            sortOrder: savedSorter.columnKey === 'priorityScore' ? (savedSorter.order || null) : null,
            render: (score: number, record) => {
                let color = 'green';
                if (score >= 60) {
                    color = 'red';
                } else if (score >= 30) {
                    color = 'orange';
                }
                
                return (
                <Space>
                    <Tag color={color} style={{ fontWeight: 'bold' }}>
                        {score || 0}分
                    </Tag>
                    {record.isUrged && <Tag color="red" icon={<FireOutlined />}>催单</Tag>}
                </Space>
                );
            }
        },
        
        {
            title: '类别',
            dataIndex: 'category',
            key: 'category',
            width: 100,
            filters: [
                { text: '生鲜', value: 'FRESH' },
                { text: '医药', value: 'MEDICAL' },
                { text: '普通', value: 'NORMAL' },
            ],
            onFilter: (value, record) => record.category === value,
            filteredValue: (savedFilters?.category as React.Key[] | null) || null,
            render: (val: string) => {
                const config: Record<string, any> = {
                    'FRESH': { color: 'orange', icon: <CoffeeOutlined />, text: '生鲜' },
                    'MEDICAL': { color: 'red', icon: <MedicineBoxOutlined />, text: '医药' },
                    'NORMAL': { color: 'blue', icon: <ShopOutlined />, text: '普通' },
                };
                const c = config[val] || config['NORMAL'];
                return <Tag color={c.color} icon={c.icon}>{c.text}</Tag>;
            }
        },
        {
            title: '订单号',
            dataIndex: 'id',
            key: 'id',
            width: 150,
            filteredValue: (savedFilters?.id as React.Key[] | null) || null,
            filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
                <div style={{ padding: 8 }}>
                    <Input
                        placeholder="请输入订单号"
                        value={(selectedKeys as React.Key[])[0] as string}
                        onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                        onPressEnter={() => confirm()}
                        style={{ marginBottom: 8, display: 'block' }}
                        allowClear
                    />
                    <Space>
                        <Button type="primary" size="small" onClick={() => confirm()}>搜索</Button>
                        <Button size="small" onClick={() => { clearFilters && clearFilters(); confirm(); }}>重置</Button>
                    </Space>
                </div>
            ),
            filterIcon: (filtered) => (
                <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
            ),
            onFilter: (value, record) => {
                const q = String(value || '').trim().toLowerCase();
                return q ? String(record.id || '').toLowerCase().includes(q) : true;
            },
        },
        {
            title: '服务',
            dataIndex: 'serviceLevel',
            key: 'serviceLevel',
            width: 100,
            render: (val: string) => {
                const isExpress = val === 'EXPRESS';
                return (
                    <Tag color={isExpress ? 'red' : 'blue'} icon={isExpress ? <RocketOutlined /> : <CarOutlined />}>
                        {isExpress ? '特快' : '普快'}
                    </Tag>
                );
            }
        },
        {
            title: '配送方式',
            dataIndex: 'deliveryMethod',
            key: 'deliveryMethod',
            width: 120,
            render: (val: string) => {
                if (!val) return <Text type="secondary">未分配</Text>;
                const isHome = val === 'HOME';
                return (
                    <Tag color={isHome ? 'cyan' : 'orange'}>
                        {isHome ? '🏠 送货上门' : '🏢 站点自提'}
                    </Tag>
                );
            }
        },
        {
            title: '商品明细',
            key: 'items',
            width: 200,
            render: (_, record) => {
                const items = record.items || [];
                if (items.length === 0) return <Text type="secondary">-</Text>;
                
                const content = (
                    <div>
                        {items.map((item, idx) => (
                            <div key={idx} style={{ marginBottom: 4 }}>
                                <Text strong>{item.name}</Text> x {item.quantity}
                            </div>
                        ))}
                    </div>
                );

                return (
                    <Popover content={content} title="商品清单">
                        <Space direction="vertical" size={0}>
                            {items.slice(0, 2).map((item, idx) => (
                                <div key={idx}>
                                    <Text ellipsis style={{ maxWidth: 150 }}>{item.name}</Text> <Text type="secondary">x{item.quantity}</Text>
                                </div>
                            ))}
                            {items.length > 2 && <Text type="secondary" style={{ fontSize: 12 }}>... 共 {items.length} 件</Text>}
                        </Space>
                    </Popover>
                );
            }
        },
        {
            title: '客户信息',
            key: 'customer',
            width: 200,
            filteredValue: (savedFilters?.customer as React.Key[] | null) || null,
            filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
                <div style={{ padding: 8 }}>
                    <Input
                        placeholder="姓名/电话/地址"
                        value={(selectedKeys as React.Key[])[0] as string}
                        onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                        onPressEnter={() => confirm()}
                        style={{ marginBottom: 8, display: 'block' }}
                        allowClear
                    />
                    <Space>
                        <Button type="primary" size="small" onClick={() => confirm()}>搜索</Button>
                        <Button size="small" onClick={() => { clearFilters && clearFilters(); confirm(); }}>重置</Button>
                    </Space>
                </div>
            ),
            filterIcon: (filtered) => (
                <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
            ),
            onFilter: (value, record) => {
                const q = String(value || '').trim().toLowerCase();
                if (!q) return true;
                const name = String(record.customer?.name || '').toLowerCase();
                const phone = String(record.customer?.phone || '').toLowerCase();
                const address = String(record.customer?.address || '').toLowerCase();
                return name.includes(q) || phone.includes(q) || address.includes(q);
            },
            render: (_, record) => (
                <div>
                    <div>{record.customer.name}</div>
                    <div className="text-xs text-gray-500">{record.customer.phone}</div>
                    <div className="text-xs text-gray-500 truncate" style={{ maxWidth: 180 }}>{record.customer.address}</div>
                </div>
            ),
        },
        {
            title: '金额',
            dataIndex: 'amount',
            key: 'amount',
            width: 120,
            sorter: (a, b) => a.amount - b.amount,
            sortOrder: savedSorter.columnKey === 'amount' ? (savedSorter.order || null) : null,
            render: (val) => `¥${val.toFixed(2)}`,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            filters: [
                ...Object.values(OrderStatus).map(status => ({
                    text: OrderStatusMap[status].text,
                    value: status,
                })),
                { text: '排队中', value: 'QUEUED' }
            ],
            onFilter: (value, record) => {
                if (value === 'QUEUED') return record.status === OrderStatus.PENDING && !!(record as any).queued;
                return record.status === value;
            },
            filteredValue: (savedFilters?.status as React.Key[] | null) || null,
            render: (status: OrderStatus, record) => {
                const config = OrderStatusMap[status] || { text: status, color: 'default' };
                return (
                    <Space size={4}>
                        <Tag color={config.color}>{config.text}</Tag>
                        {record.queued && status === OrderStatus.PENDING && <Tag color="geekblue">排队中</Tag>}
                    </Space>
                );
            },
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 180,
            sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
            sortOrder: savedSorter.columnKey === 'createdAt' ? (savedSorter.order || null) : null,
            render: (text) => new Date(text).toLocaleString(),
        },
        {
            title: '配送范围',
            key: 'range',
            width: 100,
            render: (_, record) => {
                if (record.status !== OrderStatus.PENDING && record.status !== OrderStatus.SHIPPING) return <Text type="secondary">-</Text>;
                if (!fencePath) return <Tag color="green">无限制</Tag>;
                
                const inFence = isInFence(record);
                return inFence ? <Tag color="green">范围内</Tag> : <Tag color="red">超区</Tag>;
            }
        },
        {
            title: '操作',
            key: 'action',
            width: 120,
            fixed: 'right',
            render: (_, record) => {
                const inFence = isInFence(record);
                const isPending = record.status === OrderStatus.PENDING && !record.queued;

                if (!isPending) {
                    return <Button size="small" disabled>已操作</Button>;
                }

                if (inFence) {
                    return (
                        <Button
                            type="primary"
                            size="small"
                            loading={actionLoading === record.id}
                            onClick={() => handleShip(record.id)}
                        >
                            发货
                        </Button>
                    );
                } else {
                    return (
                        <Button
                            type="primary"
                            danger
                            size="small"
                            loading={actionLoading === record.id}
                            onClick={() => handleForceDispatch(record)}
                        >
                            强制派单
                        </Button>
                    );
                }
            },
        },
    ];

    const handleTableChange = (
        pagination: TablePaginationConfig,
        filters: Record<string, FilterValue | null>,
        sorter: SorterResult<Order> | SorterResult<Order>[]
    ) => {
        const s = Array.isArray(sorter) ? sorter[0] : sorter;
        const nextState = {
            pagination: { current: pagination.current, pageSize: pagination.pageSize },
            filters,
            sorter: { field: s?.field as string, columnKey: s?.columnKey, order: s?.order || null }
        };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState)); } catch(e) {}
        setSavedFilters(filters);
        setSavedPagination(nextState.pagination);
        setSavedSorter(nextState.sorter);
    };

    return (
        <>
            <Card
                title="📦 物流控制台"
                extra={
                    <Space>
                        <Button type="primary" onClick={() => setIsModalVisible(true)}>
                            创建订单
                        </Button>
                        <Button onClick={loadData} loading={loading}>刷新数据</Button>
                    </Space>
                }
                bordered={false}
                className="shadow-sm"
            >
                <Table
                    dataSource={orders}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: savedPagination.pageSize || 10, current: savedPagination.current }}
                    scroll={{ x: 970 }}
                    onChange={handleTableChange}
                />
            </Card>

            <CreateOrderModal
                visible={isModalVisible}
                onClose={() => setIsModalVisible(false)}
                onSuccess={() => {
                    setIsModalVisible(false);
                    loadData();
                }}
            />
        </>
    );
};

export default OrderList;
