'use client';
import {useEffect, useRef, useState} from "react";
import AMapLoader from '@amap/amap-jsapi-loader';
import {io,Socket} from "socket.io-client";

interface Props {
    startPoint: [number, number]; // [lng, lat] 注意高德是 [经度, 纬度]
    endPoint: [number, number];
    orderId:string;
}

export default function MapContainer({ startPoint, endPoint, orderId }: Props) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [mapInstance,setMapInstance]=useState<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const carMarkerRef = useRef<any>(null);

    const socketRef=useRef<Socket| null>(null);

    // Effect 1: 初始化地图 (只执行一次，依赖为空 [])
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
            plugins: ['AMap.Driving','AMap.MoveAnimation'], // 加载驾车规划插件
        })

            .then((AMap) => {
                // 初始化地图
                const map = new AMap.Map('map-container', {
                    viewMode: '2D',
                    zoom: 11,
                    center: startPoint, // 初始中心点设为起点
                });

                // 添加起点和终点标记
                new AMap.Marker({
                    position: startPoint,
                    title: '商家',

                }).setMap(map);

                new AMap.Marker({
                    position: endPoint,
                    title: '客户',

                }).setMap(map);
                // 自动规划路线 (画那条蓝线)
                const driving = new AMap.Driving({
                    map: map,
                    hideMarkers: true,
                    showTraffic: false,
                });

                // 根据起终点规划
                driving.search(
                    new AMap.LngLat(...startPoint),
                    new AMap.LngLat(...endPoint),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    function (status: any, result: any) {
                        if (status === 'complete') {
                            console.log('路线规划成功');
                        } else {
                            console.error('路线规划失败：' + result);
                        }
                    }
                );
                setMapInstance(map);
            }).catch(e=> console.error(e));
        return () => {
            //销毁地图
            if(mapInstance) mapInstance.destroy();
        };
    }, []);

    // Effect 2: 处理 Socket 和 小车 (依赖 mapInstance 和 orderId)
    // 只有当地图加载完毕，且 orderId 存在时才运行
    useEffect(() => {
        if (!mapInstance) return; // 地图没好，什么都不做

        console.log(`正在为订单 ${orderId} 建立连接...`);

        // 初始化小车 Marker (如果还没创建)
        if (!carMarkerRef.current) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const AMap = (window as any).AMap; // 此时 AMap 肯定加载好了
            carMarkerRef.current = new AMap.Marker({
                map: mapInstance,
                position: startPoint,
                icon: new AMap.Icon({
                    size: new AMap.Size(52, 26),
                    image: '/transporter.png',
                    imageSize: new AMap.Size(52,26),
                }),
                offset: new AMap.Pixel(-26,-13),
            });
        }
        socketRef.current = io('http://localhost:4000');//连接后端
        socketRef.current.on('connect',()=>{
            console.log("Socket Connected");
        });
        //监听位置更新事件
        socketRef.current.on('position_update', (data) => {
            // 只处理当前订单的数据
            if (data.orderId === orderId && carMarkerRef.current) {
                console.log('收到新坐标:', data);

                // --- 核心动画逻辑 ---
                // moveTo(目标坐标, 速度/时间)
                // 高德 API: marker.moveTo([lng, lat], { duration: 1000 })
                // duration: 1000ms 对应后端推送间隔，实现无缝衔接
                const nextPos = [data.lng, data.lat];

                // 使用 moveTo 实现平滑移动
                carMarkerRef.current.moveTo(nextPos, {
                    duration: 200,
                    autoRotation: true, // 自动旋转车头
                });
            }
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };

    }, [mapInstance,orderId]);// 只要地图好了，或者换了订单号，就重新运行 Socket 逻辑


    return <div id="map-container" style={{ width: '100%', height: '100vh' }} />;
}