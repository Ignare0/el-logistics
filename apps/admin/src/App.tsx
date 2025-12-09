import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
    DashboardOutlined,
    OrderedListOutlined,
    EnvironmentOutlined
} from '@ant-design/icons';
import OrderList from './pages/OrderList';
import Dashboard from './pages/Dashboard';
import DeliveryMap from './pages/DeliveryMap';

const { Header, Content, Sider } = Layout;

const App: React.FC = () => {
    const [collapsed, setCollapsed] = useState(false);
    const [activeKey, setActiveKey] = useState('dashboard');
    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken();

    const renderContent = () => {
        switch (activeKey) {
            case 'dashboard':
                return <Dashboard />;
            case 'order':
                return <OrderList />;
            case 'map':
                return <DeliveryMap />;
            default:
                return <Dashboard />;
        }
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
                <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', textAlign: 'center', color: '#fff', lineHeight: '32px', fontWeight: 'bold' }}>
                    EL Logistics
                </div>
                <Menu
                    theme="dark"
                    defaultSelectedKeys={['dashboard']}
                    mode="inline"
                    selectedKeys={[activeKey]}
                    onClick={(e) => setActiveKey(e.key)}
                    items={[
                        {
                            key: 'dashboard',
                            icon: <DashboardOutlined />,
                            label: '数据看板',
                        },
                        {
                            key: 'order',
                            icon: <OrderedListOutlined />,
                            label: '订单管理',
                        },
                        {
                            key: 'map',
                            icon: <EnvironmentOutlined />,
                            label: '配送范围',
                        },
                    ]}
                />
            </Sider>
            <Layout>
                <Header style={{ padding: 0, background: colorBgContainer, display: 'flex', alignItems: 'center', paddingLeft: 16 }}>
                    <h2 style={{ margin: 0 }}>物流管理控制台</h2>
                </Header>
                <Content style={{ margin: '16px 16px' }}>
                    <div
                        style={{
                            padding: 24,
                            minHeight: 360,
                            background: colorBgContainer,
                            borderRadius: borderRadiusLG,
                        }}
                    >
                        {renderContent()}
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
};

export default App;
