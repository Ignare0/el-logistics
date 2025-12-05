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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dashPolylineRef = useRef<any>(null);
    // 增加 ref 记录当前的推荐 Zoom，供重置时使用
    const currentTargetZoomRef = useRef<number>(10)

    // 在组件内部增加一个 ref 记录上一次的模式
    const lastTransportModeRef = useRef<string | null>(null);
    const socketRef=useRef<Socket| null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const passedPolylineRef = useRef<any>(null); // 存储“已走过路径”的线
    const pathRef = useRef<Array<[number, number]>>([]); // 存储路径点数据

    const [statusText, setStatusText] = useState<string>("等待物流更新...");
    const [isAutoFollow, setIsAutoFollow] = useState(true);
    // 用 ref 存一份最新的状态，供 socket 回调内部判断使用
    const isAutoFollowRef = useRef(true);

    // 辅助函数：切换跟随状态
    const toggleFollow = (state: boolean) => {
        setIsAutoFollow(state);
        isAutoFollowRef.current = state;
    };

    // Effect 1: 初始化地图 (只执行一次，依赖为空 [])
    useEffect(() => {
        // 1. 配置安全密钥 (高德 2.0 必须)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any)._AMapSecurityConfig = {
            securityJsCode: process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE, // 填你的安全密钥
        };

        // 2. 加载地图
        AMapLoader.load({
            key: process.env.NEXT_PUBLIC_AMAP_KEY||'',
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
                dashPolylineRef.current = dashPolyline;

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

                // 监听地图拖拽，如果用户手动拖动，则停止自动跟随
                map.on('dragstart', () => {
                    if (isAutoFollowRef.current) {
                        toggleFollow(false);
                    }
                });
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
                clickable: false,   // 设置为不可点击，这样就不会触发 pointer 事件
                cursor: 'default',  // 强制鼠标样式为默认箭头，不变成手指
                bubble: true,       // 允许事件穿透到地图底图（可选，方便拖拽地图）
            });
            // 初始化路径数组
            pathRef.current = [startPoint]
            // 核心逻辑 A：实时画线 (织布机效果)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            carMarkerRef.current.on('moving', (e: any) => {
                // 获取小车当前的实时位置 (动画过程中的插值)
                const currentPos = e.target.getPosition();

                // 视觉上的线 = 已经确认的历史路径 + 当前车头所在的位置
                passedPolylineRef.current.setPath([
                    ...pathRef.current,
                    [currentPos.lng, currentPos.lat]
                ]);
            });

            // 核心逻辑 B：到达后“固化”路径
            carMarkerRef.current.on('moveend', () => {
                // 只有当动画真正跑完了，才把这个点加入“历史档案”
                const finalPos = carMarkerRef.current.getPosition();
                pathRef.current.push([finalPos.lng, finalPos.lat]);
            });
        }
        socketRef.current = io('http://localhost:4000');//连接后端
        socketRef.current.on('connect',()=>{
            console.log("Socket Connected");
        });
        //监听位置更新事件
        socketRef.current.on('position_update', (data) => {
            if (data.orderId === orderId && carMarkerRef.current) {
                const nextPos: [number, number] = [data.lng, data.lat];

                const moveDuration = data.speed ? data.speed * 1.1 : 200;
                // 移动动画
                carMarkerRef.current.moveTo(nextPos, {
                    duration: moveDuration,
                    autoRotation: false,
                });

                // 记录后端推荐的 Zoom (供重置使用)
                if (data.zoom) {
                    currentTargetZoomRef.current = data.zoom;
                }
                //动态画出轨迹线

                //只应该在“运输模式改变”（比如从空运变成陆运）的那一瞬间调整 Zoom，其余时间应该允许用户自由缩放，只跟随位置，不强制重置 Zoom

                if (isAutoFollowRef.current) {
                    const currentMode = data.transport;
                    const targetZoom = data.zoom || 10;
                    const currentZoom = mapInstance.getZoom();

                    // 只有模式切换时，才大幅度缩放，否则只平移
                    if (currentMode !== lastTransportModeRef.current) {
                        console.log(`模式切换: ${lastTransportModeRef.current} -> ${currentMode}, 缩放至 ${targetZoom}`);
                        mapInstance.setZoomAndCenter(targetZoom, nextPos, false, 1000);
                        lastTransportModeRef.current = currentMode;
                    } else {
                        // 同一模式下，只平移，允许用户微调 Zoom
                        mapInstance.panTo(nextPos);
                        // 如果 Zoom 差距实在太大（比如用户不小心缩很小），也可以纠正，但这里先不做，给用户自由
                    }
                }
                // 如果有状态文字，传给父组件
                if (data.statusText) {
                    setStatusText(data.statusText);
                }

                if(data.status=='delivered'){
                    if(dashPolylineRef.current) {
                        dashPolylineRef.current.setMap(null);
                    }
                    toggleFollow(false);
                }
            }
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };

    }, [mapInstance,orderId]);// 只要地图好了，或者换了订单号，就重新运行 Socket 逻辑




    return (
        <div className="relative w-full h-full">
            {/* 状态条 */}
            <div className="absolute top-20 left-4 right-4 z-50 pointer-events-none">
                <div className="bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-lg border border-blue-100 text-center animate-fade-in">
                    <p className="text-blue-700 font-bold text-sm">
                        {statusText}
                    </p>
                </div>
            </div>

            <div id="map-container" style={{ width: '100%', height: '100vh' }} />
        </div>
    );
}