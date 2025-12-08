import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Card, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchOrders, shipOrder } from '../services/orderService';
// 👇 关键：引入共享类型和映射表
import { Order, OrderStatus, OrderStatusMap } from '@el/types';

const OrderList: React.FC = () => {
    // 显式指定 State 类型，杜绝推断错误
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null); // 记录哪个 ID 正在发货中

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetchOrders();
            // 严格判断 code === 200
            if (res.code === 200) {
                setOrders(res.data);
            } else {
                message.error(res.msg || '获取数据失败');
            }
        } catch (error) {
            // request.ts 已经统一处理了部分错误，这里可以打日志
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleShip = async (id: string) => {
        setActionLoading(id); // 开启按钮 loading
        try {
            const res = await shipOrder(id);
            if (res.code === 200) {
                message.success('发货成功！物流轨迹模拟已启动');
                // 优化：不刷新全表，直接更新本地数据（提升体验）
                setOrders(prev => prev.map(item =>
                    item.id === id ? { ...item, status: OrderStatus.SHIPPING } : item
                ));
            } else {
                message.error(res.msg);
            }
        } catch (error) {
            console.error(error);
            // error handled in interceptor
        } finally {
            setActionLoading(null);
        }
    };

    const columns: ColumnsType<Order> = [
        {
            title: '订单号',
            dataIndex: 'id',
            key: 'id',
            width: 120,
        },
        {
            title: '客户信息',
            key: 'customer',
            width: 200,
            render: (_, record) => (
                <div className="flex flex-col">
                    <span className="font-medium">{record.customer.name}</span>
                    <span className="text-gray-400 text-xs">{record.customer.phone}</span>
                    <span className="text-gray-400 text-xs truncate max-w-[150px]">{record.customer.address}</span>
                </div>
            ),
        },
        {
            title: '金额',
            dataIndex: 'amount',
            key: 'amount',
            render: (val) => `¥${val.toFixed(2)}`,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: OrderStatus) => {
                // 👇 使用共享配置，Admin 和 Mobile 颜色永远一致！
                const config = OrderStatusMap[status] || { text: status, color: 'default' };
                return <Tag color={config.color}>{config.text}</Tag>;
            },
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Button
                    type="primary"
                    size="small"
                    // 只有 PENDING 状态允许发货
                    disabled={record.status !== OrderStatus.PENDING}
                    loading={actionLoading === record.id}
                    onClick={() => handleShip(record.id)}
                >
                    {record.status === OrderStatus.PENDING ? '发货' : '已发货'}
                </Button>
            ),
        },
    ];

    return (
        <Card
            title="📦 物流控制台"
            extra={<Button onClick={loadData} loading={loading}>刷新数据</Button>}
            bordered={false}
            className="shadow-sm"
        >
            <Table
                dataSource={orders}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
            />
        </Card>
    );
};

export default OrderList;