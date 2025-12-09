// apps/mobile/components/MapContainer.tsx
'use client';

import React, { useEffect, useRef } from "react";
import { useAMap } from "../hooks/useAMap";
import { useLogisticsTracking } from "../hooks/useLogisticsTracking";
import { Order, OrderStatus } from "@el/types"; // ✅ 移除了 PositionUpdatePayload，因为它现在在 store 中处理


interface Props {
    startPoint: [number, number];
    endPoint: [number, number];
    orderId: string;
    order: Order;
    // onOrderUpdate?: (data: PositionUpdatePayload) => void; // ✅ 不再需要这个 prop
}

function MapContainer({startPoint, endPoint, orderId, order }: Props) {
    const { map, AMap } = useAMap('map-container', {
        center: startPoint,
        zoom: 4
    });

    const dashPolylineRef = useRef<AMap.Polyline | null>(null);
    useEffect(() => {
        if (dashPolylineRef.current) {
            if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.COMPLETED) {
                dashPolylineRef.current.hide();
            } else {
                dashPolylineRef.current.show();
            }
        }
    }, [order.status]);

    useEffect(() => {
        if (!map || !AMap) return;

        map.setMapStyle('amap://styles/fresh');

        const createTextMarker = (position: [number, number], text: string, type: 'start' | 'end') => {
            const content = `
                <div style="background: white; padding: 4px 8px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-size: 10px; font-weight: bold; color: #333; display: flex; align-items: center; gap: 4px;">
                    <div style="width: 6px; height: 6px; border-radius: 50%; background: ${type === 'start' ? '#333' : '#D93F32'};"></div>
                    ${text}
                </div>
            `;
            new AMap.Marker({
                position,
                content: content,
                offset: new AMap.Pixel(-25, -25),
                map: map
            });
        };

        createTextMarker(startPoint, `发: ${order.startCity}`, 'start');
        createTextMarker(endPoint, `收: ${order.endCity}`, 'end');

        const dashPolyline = new AMap.Polyline({
            path: [startPoint, endPoint],
            strokeColor: '#D93F32',
            strokeOpacity: 0.6,
            strokeWeight: 4,
            strokeStyle: 'dashed',
            strokeDasharray: [10, 10],
            geodesic: true,
        });

        // ✅ 初始化时如果已完成，直接隐藏虚线
        if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.COMPLETED) {
            dashPolyline.hide();
        }

        map.add(dashPolyline);
        dashPolylineRef.current = dashPolyline;
        map.setFitView([dashPolyline], false, [50, 50, 300, 50]);

    }, [map, AMap, startPoint.toString(), endPoint.toString()]); // eslint-disable-line react-hooks/exhaustive-deps

    // ✅ 追踪 Hook 不再需要传递 onUpdate 回调
    useLogisticsTracking({
        map,
        AMap,
        orderId,
        startPoint,
        initialPath: order.logistics.actualRoute // ✅ 传递历史路径以回显
    });

    return (
        <div className="relative w-full h-full">
            <div id="map-container" className="w-full h-full" />
        </div>
    );
}
export default React.memo(MapContainer);