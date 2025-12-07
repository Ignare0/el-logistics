// apps/mobile/components/TrackingHeader.tsx
'use client';
import React from 'react';
import { Order, OrderStatusMap } from '@el/types';
import { useRouter } from 'next/navigation';

interface Props {
    order: Order;
}

export const TrackingHeader: React.FC<Props> = ({ order }) => {
    const router = useRouter();
    // 简单的城市提取逻辑 (真实项目建议后端返回 city 字段)
    const getCity = (address: string) => address.substring(0, 2);
    const startCity = "上海"; // 暂时写死演示，或从 node 名称提取
    const endCity = "长春";

    return (
        <div className="w-full flex flex-col gap-3 px-4 pt-4">
            {/* 1. 顶部透明导航栏 */}
            <div className="flex justify-between items-center text-gray-800 mb-1">
                <button
                    onClick={() => router.back()}
                    className="w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-sm"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-medium shadow-sm flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    分享
                </button>
            </div>

            {/* 2. 核心物流卡片 (顺丰样式) */}
            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] overflow-hidden">
                {/* 顶部黑条 */}
                <div className="bg-[#2B2E33] text-white px-4 py-2.5 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="bg-[#D93F32] text-white text-[10px] px-1.5 py-0.5 rounded font-bold">顺丰特快</span>
                        <span className="text-xs text-gray-300 font-mono tracking-wide">{order.id}</span>
                    </div>
                    <div className="text-[10px] text-[#EBCB8D] flex items-center gap-1">
                        电子存根 &gt;
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
                                预计 <span className="text-[#2B2E33] font-bold">{order.eta?.split(' ')[0]}</span> {order.eta?.split(' ')[1]} 前送达
                            </p>
                        </div>

                        {/* 右侧：路线图 */}
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-xl font-bold text-[#2B2E33]">{startCity}</span>
                            <div className="flex flex-col items-center w-12">
                                <span className="text-[10px] text-gray-400 mb-0.5 transform scale-90">已发货</span>
                                {/* 箭头图形 */}
                                <div className="w-full h-[2px] bg-gray-200 relative">
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 border-t border-r border-gray-300 transform rotate-45"></div>
                                </div>
                            </div>
                            <span className="text-xl font-bold text-[#2B2E33]">{endCity}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 距离提示 (悬浮在卡片下方) */}
            {order.logistics.currentLat && (
                <div className="self-center bg-white/90 backdrop-blur text-xs px-3 py-1.5 rounded-full shadow-sm text-gray-600 mt-2">
                    距离目的地约 <span className="text-[#D93F32] font-bold">1872 km</span>
                </div>
            )}
        </div>
    );
};