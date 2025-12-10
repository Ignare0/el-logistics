import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { PositionUpdatePayload } from '@el/types';
import { useOrderActions } from '@/stores/orderStore'; // ✅ 引入 store actions

interface TrackingOptions {
    map: AMap.Map | null;
    AMap: AMap.AMapNamespace | null;
    orderId: string;
    startPoint: [number, number];
    initialPath?: [number, number][]; // 初始路径（用于回显历史轨迹）
}

export const useLogisticsTracking = ({ map, AMap, orderId, startPoint, initialPath }: TrackingOptions) => {
    const socketRef = useRef<Socket | null>(null);
    const carMarkerRef = useRef<AMap.Marker | null>(null);
    const passedPolylineRef = useRef<AMap.Polyline | null>(null);
    const pathRef = useRef<Array<[number, number]>>(initialPath || [startPoint]);
    const shouldTrackRouteRef = useRef(true); // ✅ 控制是否继续绘制轨迹

    // ✅ 直接从 store 获取更新函数
    const { updateFromSocket } = useOrderActions();

    const [isAutoFollow, setIsAutoFollow] = useState(true);
    const isAutoFollowRef = useRef(true);

    const toggleFollow = (state: boolean) => {
        setIsAutoFollow(state);
        isAutoFollowRef.current = state;
    };

    useEffect(() => {
        if (!map || !AMap) return;

        // Reset tracking state on new order/init
        shouldTrackRouteRef.current = true;

        if (!carMarkerRef.current) {
            // ✅ 修复：每次初始化（或重新初始化）时重置路径，防止残留上一单的路径
            pathRef.current = (initialPath && initialPath.length > 0) ? initialPath : [startPoint];

            // 确定初始位置：如果有历史路径，则车在最后一点；否则在起点
            const initPos = pathRef.current[pathRef.current.length - 1];

            carMarkerRef.current = new AMap.Marker({
                map: map,
                position: initPos,
                icon: new AMap.Icon({ size: new AMap.Size(52, 26), image: '/transporter.svg', imageSize: new AMap.Size(52, 26) }),
                offset: new AMap.Pixel(-26, -13),
                zIndex: 100,
                clickable: false,
                cursor: 'default'
            });

            passedPolylineRef.current = new AMap.Polyline({
                path: (initialPath && initialPath.length > 0) ? initialPath : [startPoint],
                strokeColor: '#D93F32',
                strokeWeight: 6,
            });
            map.add(passedPolylineRef.current);
            
            // 如果有历史路径，调整视野以包含路径
            if (initialPath && initialPath.length > 1) {
                map.setFitView([passedPolylineRef.current]);
            }
            
            // ✅ 监听 marker 移动，实现“货物牵引路线”效果
            carMarkerRef.current.on('moving', (e: any) => {
                // 如果不再追踪（如已送达），停止更新轨迹
                if (!shouldTrackRouteRef.current || !passedPolylineRef.current) return;
                
                const currentPos = e.target.getPosition();
                // 实时更新路径：历史路径 + 当前移动点
                passedPolylineRef.current.setPath([...pathRef.current, [currentPos.lng, currentPos.lat]]);
            });

            carMarkerRef.current.on('moveend', () => {
                if (!shouldTrackRouteRef.current || !passedPolylineRef.current || !carMarkerRef.current) return;
                
                const currentPos = carMarkerRef.current.getPosition();
                // 移动结束，将当前点固定到历史路径中
                pathRef.current.push([currentPos.lng, currentPos.lat]);
                passedPolylineRef.current.setPath(pathRef.current);
            });

            map.on('dragstart', () => toggleFollow(false));
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';
        if (!socketRef.current) {
            socketRef.current = io(apiUrl);

            socketRef.current.on('connect', () => console.log("✅ Socket Connected"));

            socketRef.current.on('position_update', (data: PositionUpdatePayload) => {
                if (data.orderId !== orderId) return;

                // ✅ 状态检查：如果是返程、送达或取消，停止绘制轨迹
                if (data.status === 'returning' || data.status === 'delivered' || data.status === 'cancelled') {
                    shouldTrackRouteRef.current = false;
                }

                if (carMarkerRef.current) {
                    const nextPos: [number, number] = [data.lng, data.lat];
                    // 平滑移动
                    carMarkerRef.current.moveTo(nextPos, { duration: data.speed ? data.speed * 1.1 : 200, autoRotation: false });

                    // ❌ 移除手动 setPath，交由 moving 事件处理，实现“牵引”效果

                    if (data.resetView) {
                        toggleFollow(true);
                        map.setZoomAndCenter(data.zoom || 10, nextPos, false, 1000);
                    } else if (isAutoFollowRef.current) {
                        map.panTo(nextPos);
                    }
                }

                // ✅ 直接调用 store action 来更新全局状态
                updateFromSocket(data);
            });
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            // ✅ Cleanup: 卸载组件时清除地图覆盖物，防止切换订单时残留
            if (map) {
                try {
                    if (carMarkerRef.current) {
                        map.remove(carMarkerRef.current);
                        carMarkerRef.current = null;
                    }
                    if (passedPolylineRef.current) {
                        map.remove(passedPolylineRef.current);
                        passedPolylineRef.current = null;
                    }
                } catch (e) {
                    console.warn('Map remove overlay failed (map likely destroyed)', e);
                }
            }
        };

    }, [map, AMap, orderId, startPoint.toString(), updateFromSocket]); // eslint-disable-line react-hooks/exhaustive-deps

    return { isAutoFollow, toggleFollow };
};