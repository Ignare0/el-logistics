'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Order, OrderStatus, OrderStatusMap } from '@el/types';
import Link from 'next/link';

interface Props {
    initialOrders: Order[];
}

// 运单卡片组件
const OrderCard = ({ order }: { order: Order }) => (
    <Link href={`/tracking/${order.id}`} className="block bg-white rounded-2xl shadow-md p-5 active:opacity-80 transition-opacity">
        <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-mono text-gray-500">顺丰标快 {order.id}</span>

        </div>
        <div className="flex justify-between items-center">
            <div className="text-center">
                <p className="text-sm text-gray-500">{order.startCity}</p>
                <h2 className="text-2xl font-bold text-gray-800">{order.customer.name.substring(0, 1)}师傅</h2>
            </div>

            <div className="text-center">
                <h3 className={`text-xl font-bold ${order.status === OrderStatus.COMPLETED ? 'text-green-600' : 'text-gray-800'}`}>
                    {OrderStatusMap[order.status]?.text || order.status}
                </h3>
                <div className="w-20 h-0.5 bg-red-500 mt-1"></div>
            </div>

            <div className="text-center">
                <p className="text-sm text-gray-500">{order.endCity}</p>
                <h2 className="text-2xl font-bold text-gray-800">
                    {order.customer.address.length > 5 ? order.customer.address.substring(0, 5) + '...' : order.customer.address}
                </h2>
            </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
                {order.status === OrderStatus.COMPLETED ? '已签收' : '最新状态'}: {order.timeline[order.timeline.length-1]?.description || '暂无信息'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
                签收时间: {new Date(order.createdAt).toLocaleString()}
            </p>
        </div>
    </Link>
);


export default function HomeView({ initialOrders }: Props) {
    const [orderId, setOrderId] = useState('');
    const router = useRouter();

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (orderId.trim()) {
            router.push(`/tracking/${orderId.trim()}`);
        }
    };

    return (
        <div className="w-full min-h-screen bg-gray-50 font-sans p-4">

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
                <h2 className="text-xl font-bold text-gray-800 mb-3">近期快递</h2>
                {initialOrders.length > 0 ? (
                    <div className="space-y-4">
                        {/* 我们只显示最近的一个订单，以匹配UI */}
                        <OrderCard order={initialOrders[0]} />
                    </div>
                ) : (
                    <div className="text-center py-10 bg-white rounded-2xl shadow-md">
                        <p className="text-gray-500">暂无快递信息</p>
                    </div>
                )}
            </main>
        </div>
    );
}