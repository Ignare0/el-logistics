// server/src/domain/Node.ts

/**
 * 定义节点的类型
 * HUB: 核心枢纽 (机场/大型转运中心) - 走飞机或干线车
 * CENTER: 城市分拨中心 - 走厢式货车
 * STATION: 末端网点 (营业部/驿站) - 走三轮车
 * WAREHOUSE: 商家仓库 - 起点
 * ADDRESS: 用户收货地址 - 终点
 */
export type NodeType = 'HUB' | 'CENTER' | 'STATION' | 'WAREHOUSE' | 'ADDRESS';

/**
 * 物流节点接口
 * 规定了一个节点必须有的字段
 */
export interface LogisticsNode {
    id: string;        // 唯一标识 (如 'HUB_BJ_SHUNYI')
    name: string;      // 显示名称 (如 '北京顺义集散中心')
    type: NodeType;    // 节点类型 (决定了图标和逻辑)

    // 地理坐标 (高德地图用)
    location: {
        lat: number;   // 纬度
        lng: number;   // 经度
    };

    city?: string;     // 所属城市 (可选，用于辅助分组)
    regionCode?: string; // 行政区划代码 (可选，备用)
}