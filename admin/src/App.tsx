import React from 'react';
import OrderList from './pages/OrderList';
import './App.css'; // 保持原有样式引用

const App: React.FC = () => {
    return (
        <div style={{ padding: '20px', background: '#f0f2f5', minHeight: '100vh' }}>
            <OrderList />
        </div>
    );
};

export default App;