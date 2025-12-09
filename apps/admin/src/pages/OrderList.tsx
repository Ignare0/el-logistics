import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Card, message, Space, Popover, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchOrders, shipOrder } from '../services/orderService';
import { Order, OrderStatus, OrderStatusMap } from '@el/types';
import CreateOrderModal from './CreateOrderModal';
import { useMerchant } from '../contexts/MerchantContext';
import { RocketOutlined, CarOutlined } from '@ant-design/icons';

const { Text } = Typography;

const OrderList: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const { currentMerchant } = useMerchant();

    const loadData = async () => {
        if (!currentMerchant) return;
        
        setLoading(true);
        try {
            const res = await fetchOrders({ merchantId: currentMerchant.id });
            if (res.code === 200) {
                const sortedData = res.data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

    const columns: ColumnsType<Order> = [
        {
            title: '订单号',
            dataIndex: 'id',
            key: 'id',
            width: 150,
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
            render: (val) => `¥${val.toFixed(2)}`,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            filters: Object.values(OrderStatus).map(status => ({
                text: OrderStatusMap[status].text,
                value: status,
            })),
            onFilter: (value, record) => record.status === value,
            render: (status: OrderStatus) => {
                const config = OrderStatusMap[status] || { text: status, color: 'default' };
                return <Tag color={config.color}>{config.text}</Tag>;
            },
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 180,
            sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
            render: (text) => new Date(text).toLocaleString(),
        },
        {
            title: '操作',
            key: 'action',
            width: 100,
            fixed: 'right',
            render: (_, record) => (
                <Button
                    type="primary"
                    size="small"
                    disabled={record.status !== OrderStatus.PENDING}
                    loading={actionLoading === record.id}
                    onClick={() => handleShip(record.id)}
                >
                    {record.status === OrderStatus.PENDING ? '发货' : '已操作'}
                </Button>
            ),
        },
    ];

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
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 970 }}
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