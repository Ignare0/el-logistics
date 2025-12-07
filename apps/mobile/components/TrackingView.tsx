'use client';

import React, { useState } from 'react';
import { Order, OrderStatus, PositionUpdatePayload } from '@el/types';
import dynamic from 'next/dynamic';
import { TrackingHeader } from './TrackingHeader';
import { TrackingTimeline } from './TrackingTimeline';

const MapContainer = dynamic(
    () => import('./MapContainer'),
    {
        ssr: false, // 关键：禁止服务端渲染此组件
        loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" /> // 加载时的占位符
    }
);

interface Props {
    initialOrder: Order; // 服务器传来的初始数据
}

export default function TrackingView({ initialOrder }: Props) {
    // ✅ 核心：使用 state 来管理订单数据，这样数据变了页面才会刷新
    const [order, setOrder] = useState<Order>(initialOrder);

    // 处理 Socket 传来的更新
    const handleOrderUpdate = React.useCallback(
        (data: PositionUpdatePayload) => {
            setOrder(prev => {
                // 深拷贝一份新数据
                const newOrder = { ...prev };

                // 1. 更新实时坐标
                newOrder.logistics.currentLat = data.lat;
                newOrder.logistics.currentLng = data.lng;

                // 2. 如果状态变了 (例如 pending -> shipping)
                if (data.status === 'shipping' && newOrder.status === OrderStatus.PENDING) {
                    newOrder.status = OrderStatus.SHIPPING;
                }
                if (data.status === 'delivered') {
                    newOrder.status = OrderStatus.DELIVERED;
                }

                // 3. 更新时间线 (重要！让列表动起来)
                // 只有当有 statusText 且它是关键节点时才添加
                // 为了防止每毫秒都添加，我们可以简单判断一下，或者完全信任后端的 flag
                if (data.statusText && (data.status === 'arrived_node' || data.status === 'delivered' || data.status === 'shipping')) {
                    const lastEvent = newOrder.timeline[0];

                    // 防止重复添加相同文案
                    if (!lastEvent || lastEvent.description !== data.statusText) {
                        newOrder.timeline = [
                            {
                                status: data.status,
                                description: data.statusText,
                                timestamp: new Date().toISOString(), // 或者 data.timestamp
                                location: ''
                            },
                            ...newOrder.timeline
                        ];
                    }
                }

                return newOrder;
            });
        },[]
    )

    const startPoint: [number, number] = [initialOrder.logistics.startLng, initialOrder.logistics.startLat];
    const endPoint: [number, number] = [initialOrder.logistics.endLng, initialOrder.logistics.endLat];

    return (
        <div className="relative w-full h-[100dvh] overflow-hidden bg-gray-100 font-sans">
            {/* 底层：地图 */}
            <div className="absolute inset-0 z-0">
                <MapContainer
                    startPoint={startPoint}
                    endPoint={endPoint}
                    orderId={order.id}
                    onOrderUpdate={handleOrderUpdate} // 👈 把回调传进去
                />
            </div>

            {/* 顶层：Header (传入 state 中的 order) */}
            <div className="absolute top-0 left-0 w-full z-10 pt-safe-top">
                <TrackingHeader order={order} />
            </div>

            {/* 底层：Timeline (传入 state 中的 order) */}
            <div className="absolute bottom-0 left-0 w-full z-20">
                <TrackingTimeline order={order} />
            </div>
        </div>
    );
}