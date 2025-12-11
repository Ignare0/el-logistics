import React, { useState } from 'react';
import { Layout, Menu, theme, Select, Spin } from 'antd';
import {
    DashboardOutlined,
    OrderedListOutlined,
    EnvironmentOutlined,
    ShopOutlined
} from '@ant-design/icons';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import OrderList from './pages/OrderList';
import Dashboard from './pages/Dashboard';
import DeliveryMap from './pages/DeliveryMap';
import { MerchantProvider, useMerchant } from './contexts/MerchantContext';

const { Header, Content, Sider } = Layout;

// 创建一个内部组件来使用 Context，因为 App 本身包裹在 Provider 外面
const MainLayout: React.FC = () => {
    const [collapsed, setCollapsed] = useState(false);
    const {
        token: { colorBgContainer, borderRadiusLG },
    } = theme.useToken();
    
    const navigate = useNavigate();
    const location = useLocation();
    const { currentMerchant, merchants, setMerchant, isLoading } = useMerchant();

    // 根据当前 URL 设置选中的 Menu Key
    const getSelectedKey = () => {
        const path = location.pathname;
        if (path.includes('/orders')) return 'order';
        if (path.includes('/map')) return 'map';
        return 'dashboard';
    };

    if (isLoading) {
        return (
            <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Spin size="large" tip="正在加载站点信息..." />
            </div>
        );
    }

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
                    selectedKeys={[getSelectedKey()]}
                    onClick={(e) => {
                        switch (e.key) {
                            case 'dashboard': navigate('/'); break;
                            case 'order': navigate('/orders'); break;
                            case 'map': navigate('/map'); break;
                        }
                    }}
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
                <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 style={{ margin: 0 }}>自营配送站控制台</h2>
                    
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <ShopOutlined style={{ fontSize: 18, marginRight: 8 }} />
                        <span style={{ marginRight: 8 }}>当前站点:</span>
                        <Select
                            value={currentMerchant?.id}
                            style={{ width: 200 }}
                            onChange={(value) => {
                                const m = merchants.find(m => m.id === value);
                                if (m) setMerchant(m);
                            }}
                            options={merchants.map(m => ({ label: m.name, value: m.id }))}
                        />
                    </div>
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
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/orders" element={<OrderList />} />
                            <Route path="/map" element={<DeliveryMap />} />
                            <Route
                                path="*"
                                element={
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                                        <h3>订单不存在或页面未找到</h3>
                                        <button
                                            onClick={() => navigate('/')}
                                            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}
                                        >返回主页</button>
                                    </div>
                                }
                            />
                        </Routes>
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
};

const App: React.FC = () => {
    return (
        <BrowserRouter>
            <MerchantProvider>
                <MainLayout />
            </MerchantProvider>
        </BrowserRouter>
    );
};

export default App;
