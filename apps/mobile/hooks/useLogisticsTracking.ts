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
                if (!shouldTrackRouteRef.current || !passedPolylineRef.current) return;
                const currentPos = e.target.getPosition();
                const polyPath = passedPolylineRef.current.getPath();
                const last = polyPath[polyPath.length - 1];
                const lng = currentPos.lng;
                const lat = currentPos.lat;
                if (!last || last[0] !== lng || last[1] !== lat) {
                    passedPolylineRef.current.setPath([...polyPath, [lng, lat]]);
                }
            });

            carMarkerRef.current.on('moveend', () => {
                if (!shouldTrackRouteRef.current || !passedPolylineRef.current || !carMarkerRef.current) return;
                const currentPos = carMarkerRef.current.getPosition();
                const lng = currentPos.lng;
                const lat = currentPos.lat;
                const lastFixed = pathRef.current[pathRef.current.length - 1];
                if (!lastFixed || lastFixed[0] !== lng || lastFixed[1] !== lat) {
                    pathRef.current.push([lng, lat]);
                }
                // 将临时累积的路径收敛为固定路径，避免重复
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

                // ✅ 状态检查
                const isReturning = data.status === 'returning' || data.status === 'rider_idle';
                const isTerminal = data.status === 'delivered' || data.status === 'cancelled';

                // 返程在移动端不展示：不移动、不更新
                if (isReturning) {
                    shouldTrackRouteRef.current = false;
                    return;
                }

                if (isTerminal) {
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

                // ✅ 同步到状态（忽略返程）
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
