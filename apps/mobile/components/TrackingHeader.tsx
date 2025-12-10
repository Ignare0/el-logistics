// apps/mobile/components/TrackingHeader.tsx
'use client';
import React, { useState } from 'react';
import { Order, OrderStatus, OrderStatusMap } from '@el/types';
import { useRouter } from 'next/navigation';

interface Props {
    order: Order;
}

export const TrackingHeader: React.FC<Props> = ({ order }) => {
    const router = useRouter();
    const [activeTooltip, setActiveTooltip] = useState<'start' | 'end' | null>(null);

    // 简单的城市提取逻辑 (真实项目建议后端返回 city 字段)
    const getCity = (address: string) => address.substring(0, 2);
    const startCity = order.startNodeName || order.startCity || '始发';
    const endCity = order.endCity || '目的';

    // 格式化预计送达时间
    const formatEta = (order: Order) => {
        const timeStr = order.eta && order.eta !== '计算中...' ? order.eta : order.promisedTime;
        if (!timeStr) return '计算中...';
        
        try {
            const date = new Date(timeStr);
            if (isNaN(date.getTime())) return timeStr; // 如果不是有效日期，直接返回原字符串
            
            // 格式化为 "MM-DD HH:mm"
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const hour = date.getHours().toString().padStart(2, '0');
            const minute = date.getMinutes().toString().padStart(2, '0');
            return `${month}-${day} ${hour}:${minute}`;
        } catch (e) {
            return timeStr;
        }
    };

    const etaDisplay = formatEta(order);

    return (
        <div className="w-full flex flex-col gap-3 px-4 pt-4">
            {/* 1. 顶部透明导航栏 */}
            <div className="flex justify-between items-center text-gray-800 mb-1">
                <button
                    onClick={() => router.push('/')}
                    className="w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-sm"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                </button>
            </div>

            {/* 2. 核心物流卡片 (顺丰样式) */}
            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] overflow-hidden">
                {/* 顶部黑条 */}
                <div className="bg-[#2B2E33] text-white px-4 py-2.5 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="bg-[#D93F32] text-white text-[10px] px-1.5 py-0.5 rounded font-bold">普快</span>
                        <span className="text-xs text-gray-300 font-mono tracking-wide">{order.id}</span>
                    </div>
                </div>

                {/* 白色信息区 */}
                <div className="p-5">
                    <div className="flex justify-between items-start">
                        {/* 左侧：状态 */}
                        <div>
                            <h1 className="text-2xl font-extrabold text-[#2B2E33] mb-1">
                                {OrderStatusMap[order.status]?.text || '运输中'}
                            </h1>
                            <p className="text-xs text-gray-500">
                                {order.status === OrderStatus.COMPLETED ? (
                                    <>
                                        <span className="text-[#2B2E33] font-bold">
                                            {order.timeline[0]?.timestamp ? new Date(order.timeline[0].timestamp).toLocaleString() : ''}
                                        </span> 已送达
                                    </>
                                ) : (
                                    <>
                                        预计 <span className="text-[#2B2E33] font-bold">{etaDisplay}</span> 前送达
                                    </>
                                )}
                            </p>
                        </div>

                        {/* 右侧：路线图 */}
                        <div className="flex items-center gap-2 mt-2">
                            {/* 始发地 */}
                            <div 
                                className="relative"
                                onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === 'start' ? null : 'start'); }}
                                onMouseEnter={() => setActiveTooltip('start')}
                                onMouseLeave={() => setActiveTooltip(null)}
                            >
                                <span className="text-xl font-bold text-[#2B2E33] max-w-[80px] truncate block cursor-pointer hover:text-blue-600 transition-colors">
                                    {startCity}
                                </span>
                                {activeTooltip === 'start' && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-gray-800 text-white text-xs p-2 rounded shadow-lg z-50 min-w-[120px] max-w-[200px] text-center break-words">
                                        {order.startNodeName || order.startCity || '始发地'}
                                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-gray-800"></div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col items-center w-12">
                                <span className="text-[10px] text-gray-400 mb-0.5 transform scale-90">已发货</span>
                                {/* 箭头图形 */}
                                <div className="w-full h-[2px] bg-gray-200 relative">
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 border-t border-r border-gray-300 transform rotate-45"></div>
                                </div>
                            </div>

                            {/* 目的地 */}
                            <div 
                                className="relative"
                                onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === 'end' ? null : 'end'); }}
                                onMouseEnter={() => setActiveTooltip('end')}
                                onMouseLeave={() => setActiveTooltip(null)}
                            >
                                <span className="text-xl font-bold text-[#2B2E33] max-w-[80px] truncate block cursor-pointer hover:text-blue-600 transition-colors">
                                    {order.customer.address}
                                </span>
                                {activeTooltip === 'end' && (
                                    <div className="absolute top-full right-0 mt-2 bg-gray-800 text-white text-xs p-2 rounded shadow-lg z-50 min-w-[120px] max-w-[200px] text-center break-words">
                                        {order.customer.address}
                                        <div className="absolute -top-1 right-4 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-gray-800"></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};