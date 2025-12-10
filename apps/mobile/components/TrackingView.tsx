'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { Order, OrderStatus } from '@el/types';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { confirmOrderReceipt, fetcher, urgeOrder, cancelOrder, getOrderById } from '@/utils/api';
import { TrackingHeader } from './TrackingHeader';
import { TrackingTimeline } from './TrackingTimeline';
import { useOrderStore, useOrderActions } from '@/stores/orderStore'; // ✅ 引入 Zustand store
import { useRouter } from 'next/navigation';

const MapContainer = dynamic(
    () => import('./MapContainer'),
    {
        ssr: false,
        loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" />
    }
);

interface Props {
    initialOrder?: Order | null;
    id?: string;
}

export default function TrackingView({ initialOrder, id }: Props) {
    const router = useRouter();
    const [phone, setPhone] = useState<string>('');

    useEffect(() => {
        const saved = typeof window !== 'undefined' ? window.localStorage.getItem('customer_phone') : '';
        if (saved) setPhone(saved);
    }, []);

    const orderId = initialOrder?.id || id!;

    // ✅ 使用 SWR 获取最新的数据，并进行自动刷新
    // fallbackData 保证了即使客户端请求失败，页面也能展示服务端传来的初始数据
    const { data: swrOrder, error, mutate } = useSWR(
        phone && orderId ? `/orders/${orderId}?phone=${encodeURIComponent(phone)}` : null,
        () => getOrderById(orderId, phone),
        {
            fallbackData: initialOrder || undefined,
            refreshInterval: 30000
        }
    );

    // ✅ 从 Zustand store 获取实时更新的数据和距离
    const order = useOrderStore((state) => state.order);
    const distance = useOrderStore((state) => state.distance);
    const { setInitialOrder, confirmReceipt: confirmAction, updateOrder: updateAction, reset } = useOrderActions();

    // ✅ 当组件卸载时重置 store，防止下一个页面看到旧数据
    useEffect(() => {
        return () => {
            reset();
        };
    }, [reset]);

    // ✅ 当 SWR 获取到数据后，用它来初始化/更新我们的 store
    useEffect(() => {
        if (swrOrder) {
            // 如果当前 store 中的订单 ID 与新数据不同，说明是切换了订单，先重置一下比较安全
             if (order && order.id !== swrOrder.id) {
                reset();
             }
            setInitialOrder(swrOrder);
        }
    }, [swrOrder, setInitialOrder, reset]); // eslint-disable-line react-hooks/exhaustive-deps

    // ✅ 确认收货的逻辑
    const handleConfirm = useCallback(async () => {
        if (!order) return;
        const updatedOrder = await confirmOrderReceipt(order.id);
        if (updatedOrder) {
            confirmAction(updatedOrder); // 调用 store action 更新状态
            mutate(updatedOrder, false); // ✅ 更新 SWR 缓存，避免被旧数据覆盖
        }
    }, [order, confirmAction, mutate]);

    // ✅ 催单逻辑
    const handleUrge = useCallback(async () => {
        if (!order) return;
        const updatedOrder = await urgeOrder(order.id);
        if (updatedOrder) {
            updateAction(updatedOrder);
            mutate(updatedOrder, false);
        }
    }, [order, updateAction, mutate]);

    const handleCancel = useCallback(async () => {
        if (!order) return;
        const ok = typeof window !== 'undefined' ? window.confirm('确定取消该订单吗？') : true;
        if (!ok) return;
        const updatedOrder = await cancelOrder(order.id);
        if (updatedOrder) {
            updateAction(updatedOrder);
            mutate(updatedOrder, false);
        }
    }, [order, updateAction, mutate]);

    // ✅ 处理 SWR 加载和错误状态
    useEffect(() => {
        if (!phone) {
            const timer = setTimeout(() => router.push('/'), 3000);
            return () => clearTimeout(timer);
        }
    }, [phone, router]);

    if (!phone) return <div className="p-10 text-center">订单不存在（未设置手机号），3 秒后返回首页</div>;
    if (error || (!swrOrder && !initialOrder)) {
        setTimeout(() => router.push('/'), 3000);
        return <div className="p-10 text-center">订单不存在，3 秒后返回首页</div>;
    }
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
                <TrackingTimeline order={order} onConfirm={handleConfirm} onUrge={handleUrge} onCancel={handleCancel} />
            </div>
        </div>
    );
}
