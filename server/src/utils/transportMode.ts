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

interface SegmentConfig {
    zoom: number;       // 地图缩放级别 (3-18)
    speed: number;      // 模拟速度 (ms/点，越小越快)
    stepSize: number;   // 采样步长 (跳过多少个点，越大越粗糙)
}

export const getSegmentConfig = (from: LogisticsNode, to: LogisticsNode): SegmentConfig => {
    // : 网点 -> 用户地址
    if (to.type === 'ADDRESS') {
        return {
            zoom: 16,       // 街道级视角 (看得很清)
            speed: 200,     // 慢速移动 (200ms走一步，很丝滑)
            stepSize: 1     // 不跳点 (保留所有细节)
        };
    }

    // 2. 核心干线 (Air/Trunk): 枢纽 -> 枢纽
    if (from.type === 'HUB' && to.type === 'HUB') {
        return {
            zoom: 5,        // 国家级视角 (看半个中国)
            speed: 50,      // 极速 (50ms走一步)
            stepSize: 10    // 大跨步 (忽略细节，只看进度)
        };
    }

    // 3. 城市接驳 (City Transfer): 网点 <-> 分拨 <-> 枢纽
    return {
        zoom: 11,       // 城市级视角
        speed: 100,     // 中速
        stepSize: 3     // 中等精度
    };
};