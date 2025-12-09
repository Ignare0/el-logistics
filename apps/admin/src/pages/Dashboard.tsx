import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic } from 'antd';
import ReactECharts from 'echarts-for-react';
import { Order, OrderStatus } from '@el/types';
import { fetchOrders } from '../services/orderService';
import { ShoppingCartOutlined, CarOutlined } from '@ant-design/icons';

const Dashboard: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);

    useEffect(() => {
        fetchOrders().then(res => {
            if (res.code === 200) {
                setOrders(res.data);
            }
        });
    }, []);

    // 统计数据
    const totalAmount = orders.reduce((sum, order) => sum + order.amount, 0);
    const statusCount = {
        [OrderStatus.PENDING]: orders.filter(o => o.status === OrderStatus.PENDING).length,
        [OrderStatus.SHIPPING]: orders.filter(o => o.status === OrderStatus.SHIPPING).length,
        [OrderStatus.DELIVERED]: orders.filter(o => o.status === OrderStatus.DELIVERED).length,
        [OrderStatus.COMPLETED]: orders.filter(o => o.status === OrderStatus.COMPLETED).length,
    };

    // 图表配置
    const pieOption = {
        title: { text: '订单状态分布', left: 'center' },
        tooltip: { trigger: 'item' },
        legend: { orient: 'vertical', left: 'left' },
        series: [
            {
                name: '状态',
                type: 'pie',
                radius: '50%',
                data: [
                    { value: statusCount[OrderStatus.PENDING], name: '待发货' },
                    { value: statusCount[OrderStatus.SHIPPING], name: '运输中' },
                    { value: statusCount[OrderStatus.DELIVERED], name: '已送达' },
                    { value: statusCount[OrderStatus.COMPLETED], name: '已完成' },
                ],
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }
        ]
    };

    const barOption = {
        title: { text: '近期发货量趋势 (模拟)', left: 'center' },
        xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
        yAxis: { type: 'value' },
        series: [{ data: [120, 200, 150, 80, 70, 110, 130], type: 'bar' }]
    };

    return (
        <div className="p-4">
            <Row gutter={16} className="mb-6">
                <Col span={8}>
                    <Card>
                        <Statistic title="总销售额" value={totalAmount} precision={2} prefix="¥" />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic title="总订单数" value={orders.length} prefix={<ShoppingCartOutlined />} />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic title="运输中" value={statusCount[OrderStatus.SHIPPING]} prefix={<CarOutlined />} valueStyle={{ color: '#1890ff' }} />
                    </Card>
                </Col>
            </Row>

            <Row gutter={16}>
                <Col span={12}>
                    <Card>
                        <ReactECharts option={pieOption} />
                    </Card>
                </Col>
                <Col span={12}>
                    <Card>
                        <ReactECharts option={barOption} />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default Dashboard;
