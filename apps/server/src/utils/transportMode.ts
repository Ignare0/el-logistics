// server/src/utils/transportMode.ts
import { LogisticsNode } from '../domain/Node';
import { PositionUpdatePayload } from '@el/types';


export type TransportMode = PositionUpdatePayload['transport'];

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
    // 末端派送：网点 -> 地址
    if (from.type === 'STATION' && to.type === 'ADDRESS') {
        return 'DELIVERY'; // 三轮车/电动车
    }

    // 枢纽互转：混合模式
    if (from.type === 'HUB' && to.type === 'HUB') {
        const dist = getDistance(from, to);
        // 如果距离小于 800km，走陆运（卡车）更划算
        if (dist < 800) {
            return 'TRUNK';
        }
        return 'AIR';
    }

    // 默认干线运输 (Station -> Center -> Hub)
    return 'TRUNK';
};
// 获取中文描述
export const getStatusDescription = (mode: TransportMode, fromName: string, toName: string) => {
    switch (mode) {
        case 'AIR':
            return `✈️ [空运] 航班飞往【${toName}】`;
        case 'DELIVERY':
            return `🛵 [派送] 快递员骑行前往【${toName}】，请保持电话畅通`;
        case 'TRUNK':
        default:
            return `🚛 [陆运] 干线车辆运输中，前往【${toName}】`;
    }
};

interface SegmentConfig {
    zoom: number;       // 地图缩放级别 (3-18)
    speed: number;      // 模拟速度 (ms/点，越小越快)
    stepSize: number;   // 采样步长 (跳过多少个点，越大越粗糙)
}
//视觉/精度配置
export const getSegmentConfig = (mode: TransportMode, distance: number): SegmentConfig => {
    if (mode === 'DELIVERY') {
        return { zoom: 17, speed: 200, stepSize: 1 };
    }

    // 空运：宏观
    if (mode === 'AIR') {
        return { zoom: 5, speed: 50, stepSize: 5 };
    }
    let dynamicZoom = 8;
    return {
        zoom: dynamicZoom,
        speed: 80,
        stepSize: distance > 200 ? 5 : 2
    };
};