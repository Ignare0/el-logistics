// mobile/components/MapWrapper.tsx
'use client'; // 👈 标记为客户端组件

import dynamic from 'next/dynamic';
import React from 'react';

// 把 dynamic 的逻辑移到这里
const MapContainer = dynamic(
    () => import('./MapContainer'),
    {
        ssr: false, // 这里允许使用 ssr: false
        loading: () => (
            <div className="h-screen w-full flex items-center justify-center bg-gray-100 text-gray-500">
                地图资源加载中...
            </div>
        ),
    }
);

export default MapContainer;