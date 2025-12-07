import React from 'react';
import { Order } from '@el/types';

interface Props {
    order: Order;
}

export const TrackingTimeline: React.FC<Props> = ({ order }) => {
    // 取最新的事件
    const latestEvent = order.timeline?.[0];

    return (
        <div className="bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-5 min-h-[40vh] relative z-20 -mt-6">
            {/* 拖拽手柄 */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6"></div>

            {/* 广告条 (模拟) */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded-xl flex justify-between items-center mb-6 border border-blue-100">
                <span className="text-xs text-blue-800 font-bold">📢 超寄星期三 寄件6折起</span>
                <button className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full">领</button>
            </div>

            {/* 最新状态 (高亮) */}
            <div className="flex gap-4 mb-8">
                <div className="flex flex-col items-center">
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white z-10">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    {/* 竖线 */}
                    <div className="w-0.5 h-full bg-gray-200 -mt-2"></div>
                </div>
                <div>
                    <h3 className="font-bold text-lg text-gray-900">运输中</h3>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                        {latestEvent?.description || '等待更新...'}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">{latestEvent?.timestamp}</p>
                </div>
            </div>

            {/* 历史状态 (灰色) */}
            {order.timeline?.slice(1).map((event, index) => (
                <div key={index} className="flex gap-4 mb-6 opacity-60">
                    <div className="flex flex-col items-center min-w-[32px]">
                        <div className="w-2 h-2 bg-gray-300 rounded-full mt-2"></div>
                        <div className="w-0.5 h-full bg-gray-200 mt-1"></div>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            {event.description}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{event.timestamp}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};