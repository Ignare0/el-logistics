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

        if (!carMarkerRef.current) {
            // 确定初始位置：如果有历史路径，则车在最后一点；否则在起点
            const initPos = (initialPath && initialPath.length > 0) 
                ? initialPath[initialPath.length - 1] 
                : startPoint;

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
                path: initialPath || [startPoint],
                strokeColor: '#D93F32',
                strokeWeight: 6,
            });
            map.add(passedPolylineRef.current);
            
            // 如果有历史路径，调整视野以包含路径
            if (initialPath && initialPath.length > 1) {
                map.setFitView([passedPolylineRef.current]);
            }

            carMarkerRef.current.on('moving', (e: any) => {
                const currentPos = e.target.getPosition();
                if (passedPolylineRef.current) {
                    passedPolylineRef.current.setPath([...pathRef.current, [currentPos.lng, currentPos.lat]]);
                }
            });
            carMarkerRef.current.on('moveend', () => {
                const finalPos = carMarkerRef.current?.getPosition();
                if (finalPos) pathRef.current.push([finalPos.lng, finalPos.lat]);
            });

            map.on('dragstart', () => toggleFollow(false));
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';
        if (!socketRef.current) {
            socketRef.current = io(apiUrl);

            socketRef.current.on('connect', () => console.log("✅ Socket Connected"));

            socketRef.current.on('position_update', (data: PositionUpdatePayload) => {
                if (data.orderId !== orderId) return;

                if (carMarkerRef.current) {
                    const nextPos: [number, number] = [data.lng, data.lat];
                    carMarkerRef.current.moveTo(nextPos, { duration: data.speed ? data.speed * 1.1 : 200, autoRotation: false });

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
        };

    }, [map, AMap, orderId, startPoint.toString(), updateFromSocket]); // eslint-disable-line react-hooks/exhaustive-deps

    return { isAutoFollow, toggleFollow };
};