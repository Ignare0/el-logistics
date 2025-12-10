// server/src/services/logisticsService.ts

import { NODES } from '../mock/nodes';
import { LogisticsNode } from '../domain/Node';

/**
 * 核心寻路算法 (简化版 - 仅同城末端)
 * 输入：起点ID, 终点ID
 * 输出：简单的节点数组 [起点, 终点] 或 [起点, 自提柜]
 * 
 * 注意：具体的路径轨迹（坐标点串）由 AMap API 在 Controller 或 Simulator 中计算，
 * 这里只负责确定业务上的逻辑节点。
 */
export const planLogisticsRoute = (startNodeId: string, endNodeId: string, serviceLevel: string = 'STANDARD'): LogisticsNode[] => {
    // 1. 获取起点和终点的完整节点对象
    const startNode = NODES[startNodeId];
    const endNode = NODES[endNodeId];

    if (!startNode) {
        throw new Error(`起点不存在: ${startNodeId}`);
    }

    // 终点可能是动态生成的地址，不一定在 NODES 表里
    // 如果 endNodeId 在 NODES 里，直接用；否则构造一个临时的
    // (但在 createOrder 时通常只传 ID，如果是临时地址，应该在 Controller 处理好传进来)
    // 这里我们假设如果 NODES 里找不到，就直接报错，或者由 Controller 处理
    // 实际上对于外卖场景，endNodeId 往往就是订单上的收货地址
    
    // 兼容逻辑：如果 endNodeId 是一个已知的 Locker 或 Station，直接用
    if (endNode) {
        return [startNode, endNode];
    }

    // 如果找不到 EndNode，说明可能是动态地址，这里无法处理逻辑节点
    // 但我们的 Order 结构里有 logistics.endLat/endLng
    // 所以 planLogisticsRoute 主要用于确定是否要经过中间节点（如自提柜）
    
    // 在最简单的外卖模式下：只有 起点 -> 终点
    return [startNode]; 
};
