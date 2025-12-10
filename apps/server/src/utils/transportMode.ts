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
    // 同城外卖场景：全部为配送模式
    return 'DELIVERY';
};
// 获取中文描述
export const getStatusDescription = (mode: TransportMode, fromName: string, toName: string) => {
    switch (mode) {
        case 'DELIVERY':
            return `🛵 [配送] 骑手正在前往【${toName}】，请保持电话畅通`;
        default:
            return `🛵 [配送] 正在配送中`;
    }
};

interface SegmentConfig {
    zoom: number;       // 地图缩放级别 (3-18)
    speed: number;      // 模拟速度 (ms/点，越小越快)
    stepSize: number;   // 采样步长 (跳过多少个点，越大越粗糙)
}
//视觉/精度配置
export const getSegmentConfig = (mode: TransportMode, distance: number): SegmentConfig => {
    // 统一为高精度、慢速（相对飞机）
    return { zoom: 16, speed: 200, stepSize: 1 };
};