// server/src/utils/transportMode.ts
import { LogisticsNode } from '../domain/Node';

export type TransportMode = 'AIR' | 'TRUNK'|'DELIVERY';

// 辅助函数：计算两点距离 (Haversine Formula) - 单位：千米
const getDistance = (n1: LogisticsNode, n2: LogisticsNode) => {
    const R = 6371; // 地球半径
    const dLat = (n2.location.lat - n1.location.lat) * Math.PI / 180;
    const dLng = (n2.location.lng - n1.location.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(n1.location.lat * Math.PI / 180) * Math.cos(n2.location.lat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export const getTransportMode = (from: LogisticsNode, to: LogisticsNode): TransportMode => {
    // 只有 核心枢纽(HUB) 到 核心枢纽(HUB) 之间才走空运
    if (from.type === 'HUB' && to.type === 'HUB') {
        return 'AIR';
    }
    if (from.type === 'STATION' && to.type === 'ADDRESS') {
        return 'DELIVERY';
    }
    return 'TRUNK';
};

// 获取中文描述
export const getStatusDescription = (mode: TransportMode, fromName: string, toName: string) => {
    if (mode === 'AIR') {
        return `✈️ [空运] 航班已起飞，由【${fromName}】飞往【${toName}】`;
    }
    return `🚛 [陆运] 车辆运输中，由【${fromName}】发往【${toName}】`;
};

interface SegmentConfig {
    zoom: number;       // 地图缩放级别 (3-18)
    speed: number;      // 模拟速度 (ms/点，越小越快)
    stepSize: number;   // 采样步长 (跳过多少个点，越大越粗糙)
}

export const getSegmentConfig = (from: LogisticsNode, to: LogisticsNode): SegmentConfig => {
    // 1. 末端派送：特写
    if (to.type === 'ADDRESS') {
        return { zoom: 17, speed: 200, stepSize: 1 };
    }

    // 2. 空运：宏观
    if (from.type === 'HUB' && to.type === 'HUB') {
        return { zoom: 5, speed: 50, stepSize: 10 };
    }

    // 3. 干线/接驳：根据距离动态计算 Zoom！
    const distance = getDistance(from, to);
    let dynamicZoom = 10;

    if (distance > 1000) dynamicZoom = 5;      // >1000km: 看全国
    else if (distance > 500) dynamicZoom = 6;  // >500km:  看大区
    else if (distance > 200) dynamicZoom = 7;  // >200km:  看省份
    else if (distance > 50) dynamicZoom = 9;   // >50km:   看城市群
    else dynamicZoom = 12;                     // <50km:   看同城

    return {
        zoom: dynamicZoom,
        speed: 80,
        stepSize: 1 // 陆运保持细节
    };
};