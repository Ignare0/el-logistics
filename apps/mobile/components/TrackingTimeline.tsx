// apps/mobile/components/TrackingTimeline.tsx

'use client'; // 必须标记为客户端组件，因为用了 useState

import React, { useState } from 'react';
import { Order } from '@el/types';

interface Props {
    order: Order;
}

const ActionButton = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
    <div className="flex flex-col items-center gap-2 cursor-pointer active:opacity-70 transition-opacity">
        <div className="w-10 h-10 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-700">
            {icon}
        </div>
        <span className="text-[10px] text-gray-500">{text}</span>
    </div>
);

export const TrackingTimeline: React.FC<Props> = ({ order }) => {
    // 状态：控制抽屉展开还是收起 (默认收起，为了让用户先看地图)
    const [isExpanded, setIsExpanded] = useState(false);

    const latestEvent = order.timeline?.[0];
    const historyEvents = order.timeline?.slice(1) || [];

    // 切换函数
    const toggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div
            className={`
                bg-[#F8F9FA] rounded-t-3xl shadow-[0_-5px_30px_rgba(0,0,0,0.1)] w-full 
                transition-all duration-300 ease-in-out flex flex-col
                ${isExpanded ? 'h-[75vh]' : 'h-[190px]'} 
            `}
        >
            {/* 1. 顶部触控区 (点击这里可以切换展开/收起) */}
            <div
                onClick={toggleExpand}
                className="w-full bg-white rounded-t-3xl border-b border-gray-100 cursor-pointer flex-shrink-0 relative"
            >
                {/* 拖拽手柄指示器 */}
                <div className="w-full flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1.5 bg-gray-200 rounded-full"></div>
                </div>

                {/* 功能按钮栏 */}
                <div className="grid grid-cols-5 gap-2 px-4 pb-4 pt-2">
                    <ActionButton icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} text="非本人" />
                    <ActionButton icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} text="客服中心" />
                    <ActionButton icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>} text="收件方式" />
                    <ActionButton icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} text="催派" />
                    <ActionButton icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} text="偏好设置" />
                </div>

                {/* 展开/收起 提示箭头 (绝对定位在右上角) */}
                <div className="absolute top-4 right-4 text-gray-400">
                    <svg className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                </div>
            </div>

            {/* 2. 滚动内容区 (时间轴) */}
            {/* 这里的 flex-1 和 overflow-y-auto 确保只有这部分会滚动 */}
            <div className="flex-1 overflow-y-auto bg-white px-5 py-4">

                {/* 空状态处理 */}
                {!latestEvent && (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                        <p className="text-xs">暂无物流信息</p>
                    </div>
                )}

                {/* 最新状态 (高亮) */}
                {latestEvent && (
                    <div className="flex gap-4 mb-6 relative">
                        <div className="flex flex-col items-center">
                            <div className="w-8 h-8 bg-[#D93F32] rounded-full flex items-center justify-center text-white z-10 shadow-md">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            {/* 只有当有历史记录时才显示连接线 */}
                            {historyEvents.length > 0 && (
                                <div className="w-0.5 h-full bg-gray-100 absolute top-8 left-4 -ml-px"></div>
                            )}
                        </div>

                        <div className="pt-0.5 pb-2">
                            <h3 className="font-bold text-[17px] text-[#2B2E33] mb-1">
                                {latestEvent.status === 'shipping' ? '运输中' :
                                    latestEvent.status === 'arrived_node' ? '运输中' :
                                        latestEvent.status === 'delivered' ? '已送达' : latestEvent.status}
                            </h3>
                            <p className="text-xs text-gray-500 mb-1">{latestEvent.timestamp.split('T')[0]} {latestEvent.timestamp.split('T')[1].substring(0,8)}</p>
                            <p className="text-[13px] text-gray-700 leading-relaxed font-medium">
                                {latestEvent.description}
                            </p>
                        </div>
                    </div>
                )}

                {/* 历史状态 (灰色) - 只有展开时才容易看到，但其实它们一直都在 */}
                {historyEvents.map((event, index) => (
                    <div key={index} className="flex gap-4 mb-6 relative">
                        <div className="flex flex-col items-center">
                            <div className="w-2.5 h-2.5 bg-gray-300 rounded-full z-10 mt-1.5 ml-3"></div>
                            {index !== historyEvents.length - 1 && (
                                <div className="w-0.5 h-full bg-gray-100 absolute top-4 left-4 -ml-px"></div>
                            )}
                        </div>
                        <div className="pl-1">
                            <p className="text-xs text-gray-400 mb-0.5">{event.timestamp.split('T')[0]} {event.timestamp.split('T')[1].substring(0,8)}</p>
                            <p className="text-[13px] text-gray-500 leading-relaxed">
                                {event.description}
                            </p>
                        </div>
                    </div>
                ))}

                {/* 底部留白，防止被手机 Home 条遮挡 */}
                <div className="h-10"></div>
            </div>
        </div>
    );
};