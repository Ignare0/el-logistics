'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { Order, OrderStatus } from '@el/types';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { confirmOrderReceipt, fetcher, setDeliveryMethod } from '@/utils/api';
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
    const [showDeliveryChoice, setShowDeliveryChoice] = useState(false);

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

    // 监听 order.waitingForSelection 状态
    useEffect(() => {
        if (order?.waitingForSelection) {
            setShowDeliveryChoice(true);
        } else {
            setShowDeliveryChoice(false);
        }
    }, [order?.waitingForSelection]);

    // ✅ 确认收货的逻辑
    const handleConfirm = useCallback(async () => {
        if (!order) return;
        const updatedOrder = await confirmOrderReceipt(order.id);
        if (updatedOrder) {
            confirmAction(updatedOrder); // 调用 store action 更新状态
        }
    }, [order, confirmAction]);

    // ✅ 选择配送方式
    const handleDeliveryChoice = async (method: 'HOME' | 'STATION') => {
        if (!order) return;
        const updatedOrder = await setDeliveryMethod(order.id, method);
        if (updatedOrder) {
            // 更新本地状态，关闭弹窗
            setInitialOrder(updatedOrder);
            setShowDeliveryChoice(false);
        }
    };

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
            
            {/* 配送方式选择弹窗 */}
            {showDeliveryChoice && (
                <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm pb-safe-bottom transition-all duration-300">
                    <div className="bg-white w-full rounded-t-2xl p-6 animate-slide-up shadow-2xl">
                        <div className="text-center mb-6">
                            <h3 className="text-lg font-bold text-gray-900">📦 包裹已到达配送站</h3>
                            <p className="text-gray-500 text-sm mt-1">请选择您希望的配送方式</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => handleDeliveryChoice('HOME')}
                                className="flex flex-col items-center justify-center p-4 bg-blue-50 border-2 border-blue-100 rounded-xl active:scale-95 transition-all hover:bg-blue-100"
                            >
                                <span className="text-3xl mb-2">🏠</span>
                                <span className="font-bold text-blue-700">送货上门</span>
                                <span className="text-xs text-blue-500 mt-1">配送员送货至您的地址</span>
                            </button>
                            
                            <button 
                                onClick={() => handleDeliveryChoice('STATION')}
                                className="flex flex-col items-center justify-center p-4 bg-orange-50 border-2 border-orange-100 rounded-xl active:scale-95 transition-all hover:bg-orange-100"
                            >
                                <span className="text-3xl mb-2">🏢</span>
                                <span className="font-bold text-orange-700">站点自提</span>
                                <span className="text-xs text-orange-500 mt-1">存入最近的营业部/驿站</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="absolute bottom-0 left-0 w-full z-20">
                <TrackingTimeline order={order} onConfirm={handleConfirm} />
            </div>
        </div>
    );
}