// apps/mobile/hooks/useAMap.ts
import { useEffect, useState } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';

/**
 * 专门负责加载高德地图 SDK 和初始化 Map 实例
 */
export const useAMap = (containerId: string, config: { center: [number, number]; zoom: number }) => {
    const [map, setMap] = useState<AMap.Map | null>(null);
    // ✅ 修复：使用我们定义的命名空间类型
    const [AMapNamespace, setAMapNamespace] = useState<AMap.AMapNamespace | null>(null);

    useEffect(() => {
        // ✅ 修复：Window 类型已扩展，直接赋值不再报错
        window._AMapSecurityConfig = {
            securityJsCode: process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE,
        };

        AMapLoader.load({
            key: process.env.NEXT_PUBLIC_AMAP_KEY || '',
            version: '2.0',
            plugins: ['AMap.Polyline', 'AMap.MoveAnimation'],
        })
            .then((loadedAMap) => {
                // loadedAMap 就是 AMap 命名空间对象
                setAMapNamespace(loadedAMap as AMap.AMapNamespace);

                const mapInstance = new loadedAMap.Map(containerId, {
                    viewMode: '2D',
                    zoom: config.zoom,
                    center: config.center,
                });
                setMap(mapInstance);
            })
            .catch((e) => console.error('地图加载失败', e));

        return () => {
            if (map) map.destroy();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { map, AMap: AMapNamespace };
};