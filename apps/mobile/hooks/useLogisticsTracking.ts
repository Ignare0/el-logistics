// apps/mobile/hooks/useLogisticsTracking.ts
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { PositionUpdatePayload } from '@el/types';

interface TrackingOptions {
    map: AMap.Map | null;
    // ✅ 修复：强类型命名空间
    AMap: AMap.AMapNamespace | null;
    orderId: string;
    startPoint: [number, number];
}

export const useLogisticsTracking = ({ map, AMap, orderId, startPoint }: TrackingOptions) => {
    const socketRef = useRef<Socket | null>(null);

    const carMarkerRef = useRef<AMap.Marker | null>(null);
    const passedPolylineRef = useRef<AMap.Polyline | null>(null);
    const pathRef = useRef<Array<[number, number]>>([startPoint]);

    const [statusText, setStatusText] = useState("等待物流更新...");
    const [isAutoFollow, setIsAutoFollow] = useState(true);
    const isAutoFollowRef = useRef(true);

    const toggleFollow = (state: boolean) => {
        setIsAutoFollow(state);
        isAutoFollowRef.current = state;
    };

    useEffect(() => {
        // 必须判空
        if (!map || !AMap) return;

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
                strokeColor: '#28F',
                strokeWeight: 6,

            });
            map.add(passedPolylineRef.current);

            // ✅ 修复：事件类型明确为 Marker 的事件
            carMarkerRef.current.on('moving', (e: AMap.AMapEvent<AMap.Marker>) => {
                // e.target 就是 Marker 实例
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

        socketRef.current = io('http://localhost:4000');

        socketRef.current.on('position_update', (data: PositionUpdatePayload) => {
            if (data.orderId !== orderId || !carMarkerRef.current) return;

            const nextPos: [number, number] = [data.lng, data.lat];
            const moveDuration = data.speed ? data.speed * 1.1 : 200;

            carMarkerRef.current.moveTo(nextPos, {
                duration: moveDuration,
                autoRotation: false,
            });

            if (data.resetView) {
                toggleFollow(true);
                map.setZoomAndCenter(data.zoom || 10, nextPos, false, 1000);
            } else if (isAutoFollowRef.current) {
                map.panTo(nextPos);
            }

            if (data.statusText) {
                setStatusText(data.statusText);
            }

            if (data.status === 'delivered') {
                toggleFollow(false);
            }
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [map, AMap, orderId, startPoint]);

    return {
        statusText,
        isAutoFollow,
        toggleFollow
    };
};