// server/src/utils/transportMode.ts
import { LogisticsNode } from '../domain/Node';

export type TransportMode = 'AIR' | 'ROAD';

export const getTransportMode = (from: LogisticsNode, to: LogisticsNode): TransportMode => {
    // 只有 核心枢纽(HUB) 到 核心枢纽(HUB) 之间才走空运
    if (from.type === 'HUB' && to.type === 'HUB') {
        return 'AIR';
    }
    return 'ROAD';
};

// 获取中文描述
export const getStatusDescription = (mode: TransportMode, fromName: string, toName: string) => {
    if (mode === 'AIR') {
        return `✈️ [空运] 航班已起飞，由【${fromName}】飞往【${toName}】`;
    }
    return `🚛 [陆运] 车辆运输中，由【${fromName}】发往【${toName}】`;
};