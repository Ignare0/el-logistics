// apps/mobile/hooks/useLogisticsTracking.ts
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { PositionUpdatePayload } from '@el/types';

interface TrackingOptions {
    map: AMap.Map | null;
    AMap: AMap.AMapNamespace | null;
    orderId: string;
    startPoint: [number, number];
    onUpdate?: (data: PositionUpdatePayload) => void;
}

export const useLogisticsTracking = ({ map, AMap, orderId, startPoint, onUpdate }: TrackingOptions) => {
    const socketRef = useRef<Socket | null>(null);
    const carMarkerRef = useRef<AMap.Marker | null>(null);
    const passedPolylineRef = useRef<AMap.Polyline | null>(null);
    const pathRef = useRef<Array<[number, number]>>([startPoint]);

    // ✅ 修复 1: 使用 ref 来保存回调，防止它触发 useEffect 重启
    const onUpdateRef = useRef(onUpdate);

    // ✅ 修复 2: 每次组件渲染时，更新 ref 的值为最新的回调函数
    useEffect(() => {
        onUpdateRef.current = onUpdate;
    }, [onUpdate]);

    const [isAutoFollow, setIsAutoFollow] = useState(true);
    const isAutoFollowRef = useRef(true);

    const toggleFollow = (state: boolean) => {
        setIsAutoFollow(state);
        isAutoFollowRef.current = state;
    };

    // ✅ 核心 useEffect
    useEffect(() => {
        if (!map || !AMap) return;

        // 初始化 Marker (代码保持不变)
        if (!carMarkerRef.current) {
            carMarkerRef.current = new AMap.Marker({
                map: map,
                position: startPoint,
                icon: new AMap.Icon({
                    size: new AMap.Size(52, 26),
                    image: '/transporter.svg',
                    imageSize: new AMap.Size(52, 26),
                }),
                offset: new AMap.Pixel(-26, -13),
                zIndex: 100,
                clickable: false,
                cursor: 'default'
            });

            passedPolylineRef.current = new AMap.Polyline({
                path: [startPoint],
                strokeColor: '#D93F32',
                strokeWeight: 6,
            });
            map.add(passedPolylineRef.current);

            carMarkerRef.current.on('moving', (e: any) => {
                const currentPos = e.target.getPosition();
                if (passedPolylineRef.current) {
                    passedPolylineRef.current.setPath([
                        ...pathRef.current,
                        [currentPos.lng, currentPos.lat]
                    ]);
                }
            });
            carMarkerRef.current.on('moveend', () => {
                const finalPos = carMarkerRef.current?.getPosition();
                if (finalPos) pathRef.current.push([finalPos.lng, finalPos.lat]);
            });

            map.on('dragstart', () => toggleFollow(false));
        }

        // Socket 连接
        const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';
        // 避免重复连接
        if (!socketRef.current) {
            socketRef.current = io(apiUrl);

            socketRef.current.on('connect', () => {
                console.log("✅ Socket Connected");
            });

            socketRef.current.on('position_update', (data: PositionUpdatePayload) => {
                if (data.orderId !== orderId) return;

                // 1. 移动小车
                if (carMarkerRef.current) {
                    const nextPos: [number, number] = [data.lng, data.lat];
                    carMarkerRef.current.moveTo(nextPos, {
                        duration: data.speed ? data.speed * 1.1 : 200,
                        autoRotation: false,
                    });

                    if (data.resetView) {
                        toggleFollow(true);
                        map.setZoomAndCenter(data.zoom || 10, nextPos, false, 1000);
                    } else if (isAutoFollowRef.current) {
                        map.panTo(nextPos);
                    }
                }

                // 2. ✅ 修复 3: 调用 ref.current，而不是直接调用 props 中的 onUpdate
                // 这样 useEffect 就不需要依赖 onUpdate 了
                if (onUpdateRef.current) {
                    onUpdateRef.current(data);
                }
            });
        }

        return () => {
            // 组件卸载时才断开，或者 orderId 变了才断开
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };


    }, [map, AMap, orderId,startPoint.toString()]);

    return {
        isAutoFollow,
        toggleFollow
    };
};