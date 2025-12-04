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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const passedPolylineRef = useRef<any>(null); // 存储“已走过路径”的线
    const pathRef = useRef<Array<[number, number]>>([]); // 存储路径点数据

    const [statusText, setStatusText] = useState<string>("等待物流更新...");

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
            plugins: ['AMap.Polyline','AMap.MoveAnimation'],
        })

            .then((AMap) => {
                // 初始化地图
                const map = new AMap.Map('map-container', {
                    viewMode: '2D',
                    zoom: 5,
                    center: startPoint, // 初始中心点设为起点
                });

                // 添加起点和终点标记
                new AMap.Marker({
                    position: startPoint,
                    title: '发货地'

                }).setMap(map);

                new AMap.Marker({
                    position: endPoint,
                    title: '收货地'

                }).setMap(map);
                // 一条“预估路径”
                const dashPolyline= new AMap.Polyline({
                    path:[startPoint, endPoint],
                    isOutline: false,
                    strokeColor: '#808080',
                    strokeOpacity: 0.5,
                    strokeWeight: 2,
                    strokeStyle: 'dashed', // 虚线
                    strokeDasharray: [10, 10], // 虚线间隔
                    geodesic: true,//弧线
                });
                map.add(dashPolyline);

                //初始化“已经走过的路径”
                const passedPolyline = new AMap.Polyline({
                    path:[startPoint],
                    strokeColor:'#28F',
                    strokeWeight: 6,

                });
                map.add(passedPolyline);
                passedPolylineRef.current=passedPolyline;


                //地图自适应显示起始和终点
                map.setFitView([dashPolyline]);

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

        // 初始化小车 (初始在起点)
        if (!carMarkerRef.current) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const AMap = (window as any).AMap;
            carMarkerRef.current = new AMap.Marker({
                map: mapInstance,
                position: startPoint,
                icon: new AMap.Icon({
                    size: new AMap.Size(52, 26),
                    image: '/transporter.svg',
                    imageSize: new AMap.Size(52, 26),
                }),
                offset: new AMap.Pixel(-26, -13),
                zIndex: 100, // 让车在最上层
            });
            // 初始化路径数组
            pathRef.current = [startPoint];
        }
        socketRef.current = io('http://localhost:4000');//连接后端
        socketRef.current.on('connect',()=>{
            console.log("Socket Connected");
        });
        //监听位置更新事件
        socketRef.current.on('position_update', (data) => {
            if (data.orderId === orderId && carMarkerRef.current) {
                const nextPos: [number, number] = [data.lng, data.lat];

                // 1. 小车移动动画
                carMarkerRef.current.moveTo(nextPos, {
                    duration: 0,
                    autoRotation: false,
                });

                // 2. 核心逻辑：动态画出轨迹线
                // 将新坐标加入路径数组
                pathRef.current.push(nextPos);
                // 更新地图上的线
                passedPolylineRef.current.setPath(pathRef.current);

                // (可选) 视角跟随：如果希望地图一直跟着车走
                mapInstance.setCenter(nextPos);
                // 如果有状态文字，传给父组件
                if (data.statusText) {
                    setStatusText(data.statusText);
                }
            }
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };

    }, [mapInstance,orderId]);// 只要地图好了，或者换了订单号，就重新运行 Socket 逻辑


    return (
        <div className="relative w-full h-full">
            {/* 悬浮状态条：绝对定位显示在地图上方 */}
            <div className="absolute top-20 left-4 right-4 z-50 pointer-events-none">
                <div className="bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-lg border border-blue-100 text-center animate-fade-in">
                    <p className="text-blue-700 font-bold text-sm">
                        {statusText}
                    </p>
                </div>
            </div>

            {/* 地图容器 */}
            <div id="map-container" style={{ width: '100%', height: '100vh' }} />
        </div>
    );
}