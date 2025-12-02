import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Card, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {fetchOrders, shipOrder} from '../services/orderService';
import { Order, OrderStatus } from '../types';

const OrderList: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);

    // 加载数据
    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetchOrders();
            if (res.code === 200) {
                setOrders(res.data);
            } else {
                message.error(res.msg);
            }
        } catch (error) {
            console.error('发货失败详情:', error);
            message.error('加载失败，请检查后端是否启动');
        } finally {
            setLoading(false);
        }
    };

    // 页面加载时触发
    useEffect(() => {
        loadData();
    }, []);

    const handleShip = async (id: string) => {
        try{
            const res =await shipOrder(id);
            if(res.code === 200){
                message.success('发货成功！');
                loadData();
            }
            else {
                message.error(res.msg);
            }
        }
        catch(error){
            console.error('发货失败详情:', error);
            message.error('网络异常，发货失败');
        }
    };
    // 表格列定义
    const columns: ColumnsType<Order> = [
        {
            title: '订单号',
            dataIndex: 'id',
            key: 'id',
        },
        {
            title: '客户信息',
            key: 'customer',
            render: (_, record) => (
                <div>
                    <div>{record.customer.name}</div>
                    <div style={{ color: '#888', fontSize: '12px' }}>{record.customer.phone}</div>
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
                const colorMap = {
                    [OrderStatus.PENDING]: 'orange',
                    [OrderStatus.SHIPPING]: 'blue',
                    [OrderStatus.DELIVERED]: 'green',
                };
                const textMap = {
                    [OrderStatus.PENDING]: '待发货',
                    [OrderStatus.SHIPPING]: '运输中',
                    [OrderStatus.DELIVERED]: '已送达',
                };
                return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
            },
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Button
                    type="primary"
                    size="small"
                    disabled={record.status !== OrderStatus.PENDING}
                    onClick={() => handleShip(record.id)}
                >
                    发货
                </Button>
            ),
        },
    ];

    return (
        <Card title="📦 订单管理仪表盘" extra={<Button onClick={loadData}>刷新</Button>}>
            <Table
                dataSource={orders}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 5 }}
            />
        </Card>
    );
};

export default OrderList;