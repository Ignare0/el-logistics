import React from 'react';
import { Order } from '@el/types';

interface Props {
    order: Order;
}

export const TrackingHeader: React.FC<Props> = ({ order }) => {
    return (
        <div className="absolute top-0 left-0 w-full z-10 pt-safe-top">
            {/* 顶部导航栏模拟 */}
            <div className="flex justify-between items-center px-4 py-3 bg-transparent">
    <button className="bg-white/80 p-2 rounded-full shadow-sm">
    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <button className="bg-white/80 px-3 py-1.5 rounded-full text-xs font-medium text-gray-700 shadow-sm flex items-center gap-1">
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
    分享
    </button>
    </div>

    {/* 核心卡片 */}
    <div className="mx-4 bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* 黑色标题栏 */}
        <div className="bg-[#1c1c1e] text-white px-4 py-3 flex justify-between items-center">
    <div className="flex items-center gap-2">
    <div className="bg-red-600 text-[10px] px-1.5 py-0.5 rounded">顺丰特快</div>
        <span className="text-xs text-gray-300 tracking-wider">{order.id}</span>
        </div>
        <div className="text-xs text-yellow-500 flex items-center gap-1">
        电子存根 &gt;
        </div>
        </div>

    {/* 白色内容区 */}
    <div className="p-5">
    <div className="flex justify-between items-start">
    <div>
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">运输中</h1>
        <p className="text-xs text-gray-500">
        预计 <span className="text-blue-600 font-bold">{order.eta || '计算中...'}</span> 前送达
        </p>
        </div>

    {/* 路线可视化 (北京 ---> 成都) */}
    <div className="flex items-center gap-3 mt-1">
    <span className="text-lg font-bold text-gray-800">上海</span>
        <div className="flex flex-col items-center w-16">
    <span className="text-[10px] text-gray-400 mb-1">已发货</span>
        <div className="w-full h-0.5 bg-gray-200 relative">
    <div className="absolute left-0 top-0 h-full w-1/2 bg-gray-800"></div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
        </div>
        </div>
        <span className="text-lg font-bold text-gray-800">长春</span>
        </div>
        </div>
        </div>
        </div>
        </div>
);
};