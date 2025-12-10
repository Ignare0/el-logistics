'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Order, OrderStatus, OrderStatusMap } from '@el/types';
import Link from 'next/link';
import useSWR from 'swr';
import { getOrders as fetchOrdersApi } from '@/utils/api';
import { io } from 'socket.io-client';

interface Props {
    initialOrders: Order[];
}

// 运单卡片组件
const OrderCard = ({ order }: { order: Order }) => (
        <Link href={`/tracking/${order.id}`} className="block bg-white rounded-2xl shadow-md p-5 active:opacity-80 transition-opacity">
        <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-mono text-gray-500">外卖订单 {order.id}</span>

        </div>
        <div className="flex justify-between items-center">
            <div className="text-center">
                <p className="text-sm text-gray-500">商家</p>
                <h2 className="text-2xl font-bold text-gray-800">三里屯站</h2>
            </div>

            <div className="text-center">
                <h3 className={`text-xl font-bold ${order.status === OrderStatus.COMPLETED ? 'text-green-600' : 'text-gray-800'}`}>
                    {order.status === OrderStatus.SHIPPING ? '派送中' : (OrderStatusMap[order.status]?.text || order.status)}
                </h3>
                <div className="w-20 h-0.5 bg-yellow-500 mt-1"></div>
            </div>

            <div className="text-center">
                <p className="text-sm text-gray-500">顾客</p>
                <h2 className="text-2xl font-bold text-gray-800">
                    {order.customer.name}
                </h2>
            </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mt-1">
                下单时间: {new Date(order.createdAt).toLocaleString()}
            </p>
        </div>
    </Link>
);


export default function HomeView({ initialOrders }: Props) {
    const [orderId, setOrderId] = useState('');
    const [phone, setPhone] = useState<string>('');
    const router = useRouter();

    useEffect(() => {
        const saved = typeof window !== 'undefined' ? window.localStorage.getItem('customer_phone') : '';
        if (saved) setPhone(saved);
    }, []);

    const { data: orders, mutate } = useSWR<Order[]>(
        phone ? `${process.env.NEXT_PUBLIC_API_URL}/orders?phone=${encodeURIComponent(phone)}` : null,
        () => fetchOrdersApi(phone),
        {
            fallbackData: [],
            refreshInterval: 3000,
            revalidateOnFocus: true
        }
    );

    // 监听 Socket 事件，实现真正的实时更新
    useEffect(() => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';
        const socket = io(apiUrl);
        
        const handleUpdate = () => {
            console.log('🔔 收到订单更新通知，刷新列表...');
            mutate();
        };

        socket.on('connect', () => console.log('✅ HomeView Socket Connected'));
        socket.on('order_update', handleUpdate);
        socket.on('order_updated', handleUpdate);

        return () => {
            socket.disconnect();
        };
    }, [mutate]);

    const displayOrders = orders || initialOrders || [];
    // 简单的按时间倒序排序，确保最新的在上面
    const sortedOrders = [...displayOrders].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (orderId.trim()) {
            router.push(`/tracking/${orderId.trim()}`);
        }
    };

    return (
        <div className="w-full min-h-screen bg-gray-50 font-sans p-4">

            <div className="flex gap-2 mb-4">
                <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                        const v = e.target.value.trim();
                        setPhone(v);
                        if (typeof window !== 'undefined') window.localStorage.setItem('customer_phone', v);
                    }}
                    placeholder="输入手机号以查看您的订单"
                    className="flex-1 h-10 px-3 bg-white rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-red-400 transition"
                />
            </div>

            <form onSubmit={handleSearch} className="relative mb-6">
                <input
                    type="text"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="搜索运单或服务"
                    className="w-full h-12 pl-10 pr-4 bg-white rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-red-400 transition"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
            </form>


            <main>
                <h2 className="text-xl font-bold text-gray-800 mb-3">最近外卖</h2>
                {phone && sortedOrders.length > 0 ? (
                    <div className="space-y-4">
                        {/* 显示最近的一个订单 */}
                        <OrderCard order={sortedOrders[0]} />
                    </div>
                ) : (
                    <div className="text-center py-10 text-gray-400">{phone ? '暂无订单' : '请输入手机号以查看您的订单'}</div>
                )}
            </main>
        </div>
    );
}
