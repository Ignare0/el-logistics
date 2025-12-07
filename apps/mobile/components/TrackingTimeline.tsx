// apps/mobile/components/TrackingTimeline.tsx
import React from 'react';
import { Order } from '@el/types';

interface Props {
    order: Order;
}

const ActionButton = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
    <div className="flex flex-col items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-700">
            {icon}
        </div>
        <span className="text-[10px] text-gray-500">{text}</span>
    </div>
);

export const TrackingTimeline: React.FC<Props> = ({ order }) => {
    // 提取最新一条和其他
    const latestEvent = order.timeline?.[0];
    const historyEvents = order.timeline?.slice(1) || [];

    return (
        <div className="bg-[#F8F9FA] rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.05)] w-full max-h-[60vh] overflow-y-auto">

            {/* 1. 功能操作栏 (顺丰风格图标栏) */}
            <div className="grid grid-cols-5 gap-2 px-4 py-5 border-b border-gray-100 bg-white rounded-t-3xl">
                <ActionButton icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} text="非本人" />
                <ActionButton icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} text="客服中心" />
                <ActionButton icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>} text="收件方式" />
                <ActionButton icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} text="催派" />
                <ActionButton icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} text="偏好设置" />
            </div>

            {/* 2. 营销横幅 */}
            <div className="px-4 py-3 bg-white">
                <div className="bg-gradient-to-r from-[#E3F2FD] to-[#F3E5F5] rounded-xl p-3 flex justify-between items-center border border-blue-50">
                    <div className="flex items-center gap-2">
                        <span className="bg-red-500 text-white text-[10px] px-1 rounded">周三</span>
                        <span className="text-xs font-bold text-blue-800">超寄星期三 寄件6折起</span>
                    </div>
                    <button className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-medium">领</button>
                </div>
            </div>

            {/* 3. 时间轴列表 */}
            <div className="bg-white px-5 py-4 min-h-[30vh]">
                {/* 最新状态 (高亮) */}
                {latestEvent && (
                    <div className="flex gap-4 mb-6 relative">
                        {/* 左侧图标列 */}
                        <div className="flex flex-col items-center">
                            <div className="w-8 h-8 bg-[#D93F32] rounded-full flex items-center justify-center text-white z-10 shadow-md">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div className="w-0.5 h-full bg-gray-100 absolute top-8 left-4 -ml-px"></div>
                        </div>

                        {/* 右侧内容 */}
                        <div className="pt-0.5 pb-2">
                            <h3 className="font-bold text-[17px] text-[#2B2E33] mb-1">{latestEvent.status === 'shipping' ? '运输中' : latestEvent.status}</h3>
                            <p className="text-xs text-gray-500 mb-1">{latestEvent.timestamp.split('T')[0]} {latestEvent.timestamp.split('T')[1].substring(0,8)}</p>
                            <p className="text-[13px] text-gray-700 leading-relaxed font-medium">
                                {latestEvent.description}
                            </p>
                        </div>
                    </div>
                )}

                {/* 历史状态 (灰色) */}
                {historyEvents.map((event, index) => (
                    <div key={index} className="flex gap-4 mb-6 relative">
                        <div className="flex flex-col items-center">
                            <div className="w-2.5 h-2.5 bg-gray-300 rounded-full z-10 mt-1.5 ml-3"></div>
                            {/* 最后一个不显示竖线 */}
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
            </div>
        </div>
    );
};