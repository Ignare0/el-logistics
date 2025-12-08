'use client';

import React, { useEffect, useCallback } from 'react';
import { Order, OrderStatus } from '@el/types';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { confirmOrderReceipt, fetcher } from '@/utils/api';
import { TrackingHeader } from './TrackingHeader';
import { TrackingTimeline } from './TrackingTimeline';
import { useOrderStore, useOrderActions } from '@/stores/orderStore'; // ✅ 引入 Zustand store

const MapContainer = dynamic(
    () => import('./MapContainer'),
    {
        ssr: false,
        loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" />
    }
);

interface Props {
    initialOrder: Order; // 服务器首次渲染时的数据
}

export default function TrackingView({ initialOrder }: Props) {
    const { id } = initialOrder;

    // ✅ 使用 SWR 获取最新的数据，并进行自动刷新
    // fallbackData 保证了即使客户端请求失败，页面也能展示服务端传来的初始数据
    const { data: swrOrder, error } = useSWR(`/orders/${id}`, () => fetcher<Order>(`${process.env.NEXT_PUBLIC_API_URL}/orders/${id}`), {
        fallbackData: initialOrder,
        refreshInterval: 30000 // 每 30 秒自动刷新一次数据
    });

    // ✅ 从 Zustand store 获取实时更新的数据和距离
    const order = useOrderStore((state) => state.order);
    const distance = useOrderStore((state) => state.distance);
    const { setInitialOrder, confirmReceipt: confirmAction } = useOrderActions();

    // ✅ 当 SWR 获取到数据后，用它来初始化/更新我们的 store
    useEffect(() => {
        if (swrOrder) {
            setInitialOrder(swrOrder);
        }
    }, [swrOrder, setInitialOrder]);

    // ✅ 确认收货的逻辑
    const handleConfirm = useCallback(async () => {
        if (!order) return;
        const updatedOrder = await confirmOrderReceipt(order.id);
        if (updatedOrder) {
            confirmAction(updatedOrder); // 调用 store action 更新状态
        }
    }, [order, confirmAction]);

    // ✅ 处理 SWR 加载和错误状态
    if (error) return <div className="p-10 text-center text-red-500">加载订单信息失败...</div>;
    // 如果 store 中还没有数据（初始化期间），可以显示一个加载状态
    if (!order) return <div className="p-10 text-center text-gray-500">正在准备物流信息...</div>;


    const startPoint: [number, number] = [order.logistics.startLng, order.logistics.startLat];
    const endPoint: [number, number] = [order.logistics.endLng, order.logistics.endLat];

    return (
        <div className="relative w-full h-[100dvh] overflow-hidden bg-gray-100 font-sans">
            <div className="absolute inset-0 z-0">
                <MapContainer
                    startPoint={startPoint}
                    endPoint={endPoint}
                    orderId={order.id}
                    order={order} // 👈 传递从 store 来的实时 order
                />
            </div>
            <div className="absolute top-0 left-0 w-full z-10 pt-safe-top">
                <TrackingHeader order={order} />
            </div>
            {distance && order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.COMPLETED && (
                <div className="absolute top-[160px] left-1/2 -translate-x-1/2 z-10 self-center bg-white/90 backdrop-blur text-xs px-3 py-1.5 rounded-full shadow-sm text-gray-600">
                    距离目的地约 <span className="text-red-500 font-bold">{distance} km</span>
                </div>
            )}
            <div className="absolute bottom-0 left-0 w-full z-20">
                <TrackingTimeline order={order} onConfirm={handleConfirm} />
            </div>
        </div>
    );
}