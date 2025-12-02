'use client';
import {useEffect, useRef} from "react";
import AMapLoader from '@amap/amap-jsapi-loader';

interface Props {
    startPoint: [number, number]; // [lng, lat] 注意高德是 [经度, 纬度]
    endPoint: [number, number];
}

export default function MapContainer({ startPoint, endPoint }: Props) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapRef = useRef<any>(null);

    useEffect(() => {
        // 1. 配置安全密钥 (高德 2.0 必须)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any)._AMapSecurityConfig = {
            securityJsCode: 'cc020d2c00a08999f26892ee1e511658', // 填你的安全密钥
        };

        // 2. 加载地图
        AMapLoader.load({
            key: 'd915d23c5e6a28d1314f232e148a4831',
            version: '2.0',
            plugins: ['AMap.Driving'], // 加载驾车规划插件
        })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .then((AMap) => {
                // 初始化地图
                const map = new AMap.Map('map-container', {
                    viewMode: '2D',
                    zoom: 11,
                    center: startPoint, // 初始中心点设为起点
                });
                mapRef.current = map;

                // 添加起点和终点标记
                new AMap.Marker({
                    position: new AMap.LngLat(startPoint[0], startPoint[1]),
                    title: '商家',
                    label: { content: '商家', offset: new AMap.Pixel(0, -20) }
                }).setMap(map);

                new AMap.Marker({
                    position: new AMap.LngLat(endPoint[0], endPoint[1]),
                    title: '客户',
                    label: { content: '客户', offset: new AMap.Pixel(0, -20) }
                }).setMap(map);

                // 自动规划路线 (画那条蓝线)
                const driving = new AMap.Driving({
                    map: map,
                    hideMarkers: true, // 隐藏默认的起终点图标，用我们要自定义的
                    showTraffic: false,
                });

                // 根据起终点规划
                driving.search(
                    new AMap.LngLat(startPoint[0], startPoint[1]),
                    new AMap.LngLat(endPoint[0], endPoint[1]),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    function (status: any, result: any) {
                        if (status === 'complete') {
                            console.log('路线规划成功');
                        } else {
                            console.error('路线规划失败：' + result);
                        }
                    }
                );
            })
            .catch((e) => {
                console.error(e);
            });

        return () => {
            // 销毁地图，防止内存泄漏
            if (mapRef.current) {
                mapRef.current.destroy();
            }
        };
    }, []);

    // 必须给 div 一个高度，否则地图看不见
    return <div id="map-container" style={{ width: '100%', height: '100vh' }} />;
}