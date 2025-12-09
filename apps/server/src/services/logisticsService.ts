// server/src/services/logisticsService.ts

import { NODES } from '../mock/nodes';
import { NETWORK_TOPOLOGY } from '../mock/relations';
import { LogisticsNode } from '../domain/Node';

/**
 * 核心寻路算法
 * 输入：起点ID, 终点ID
 * 输出：完整的节点数组 [起点, ..., 枢纽, ..., 终点]
 */
export const planLogisticsRoute = (startNodeId: string, endNodeId: string, serviceLevel: string = 'STANDARD'): LogisticsNode[] => {
    // 1. 获取起点和终点的完整节点对象
    const startNode = NODES[startNodeId];
    const endNode = NODES[endNodeId];

    if (!startNode || !endNode) {
        throw new Error(`节点不存在: ${startNodeId} 或 ${endNodeId}`);
    }

    // 2. 上行链路 (Source Chain): 从起点一直往上找，直到找不到父节点
    // 例如: [上海仓, 青浦网点, 沪西分拨, 虹桥枢纽]
    const sourceChain = traceUp(startNodeId);

    // 3. 下行链路 (Target Chain): 从终点一直往上找
    // 例如: [长春家属院, 红旗街网点, 宽城分拨, 长春机场]
    const targetChain = traceUp(endNodeId);

    // 4. 寻找公共祖先 (处理同城/同区域的情况)
    // 如果两个链有交集，说明不需要走干线，直接在中间某个分拨中心就转弯了
    let mergeIndexSource = -1;
    let mergeIndexTarget = -1;

    // 简单的双重循环找交集
    for (let i = 0; i < sourceChain.length; i++) {
        const sNode = sourceChain[i];
        const tIndex = targetChain.findIndex(t => t.id === sNode.id);
        if (tIndex !== -1) {
            mergeIndexSource = i;
            mergeIndexTarget = tIndex;
            break; // 找到最低的公共父节点（最近的转运中心）
        }
    }

    let finalRoute: LogisticsNode[] = [];

    if (mergeIndexSource !== -1) {
        // --- 情况 A: 同城/同区域 (有交集) ---
        // 路径 = 起点链的一部分 + 终点链的一部分(反转)
        // 比如: A->Center, B->Center. 路径: A -> Center -> B
        const upPart = sourceChain.slice(0, mergeIndexSource + 1); // 包含公共点
        const downPart = targetChain.slice(0, mergeIndexTarget).reverse(); // 不包含公共点，要反转
        finalRoute = [...upPart, ...downPart];
    } else {
        // --- 情况 B: 跨省/跨区 (无交集，走干线) ---
        
        let finalSourceChain = sourceChain;
        let finalTargetChain = targetChain;

        // 如果是普快 (STANDARD)，且不需要走空运，尝试截断到分拨中心 (CENTER)
        // 逻辑：如果链条顶部是 HUB (Airport)，且下面有 CENTER，则只走到 CENTER
        if (serviceLevel === 'STANDARD') {
            finalSourceChain = trimToCenter(sourceChain);
            finalTargetChain = trimToCenter(targetChain);
        }

        // 拼接: 上行链全部 + 下行链全部反转
        finalRoute = [...finalSourceChain, ...finalTargetChain.reverse()];
    }

    return finalRoute;
};

/**
 * 辅助函数：如果是普快，尝试截断到 Center 层级
 * 也就是去掉顶部的 HUB，如果顶部是 HUB 且下面有 CENTER 的话。
 */
const trimToCenter = (chain: LogisticsNode[]): LogisticsNode[] => {
    // 链条是 [Station, Center, Hub]
    // 我们想保留到 Center
    
    // 倒序查找第一个 CENTER
    const centerIndex = chain.findIndex(n => n.type === 'CENTER');
    
    // 如果找到了 CENTER，且 CENTER 不是最后一个（说明上面还有 HUB）
    // 或者就是想截断到 CENTER（不管上面有没有）
    // 其实只要保留到 CENTER 即可 (包含 CENTER)
    if (centerIndex !== -1) {
        // 比如 [Station, Center, Hub], centerIndex = 1.
        // slice(0, 2) -> [Station, Center]
        return chain.slice(0, centerIndex + 1);
    }
    
    // 如果没有 CENTER (比如直接 WH -> Hub)，那只能走 Hub
    return chain;
};


/**
 * 辅助函数：向上回溯查找父节点
 */
const traceUp = (nodeId: string): LogisticsNode[] => {
    const chain: LogisticsNode[] = [];
    let currentId: string | undefined = nodeId;

    while (currentId) {
        const node = NODES[currentId];
        if (node) {
            chain.push(node);
            // 查关系表，找爸爸
            // @ts-ignore (忽略类型检查，假设 relations 是 key-value)
            const parentId = NETWORK_TOPOLOGY[currentId];
            currentId = parentId; // 继续往上找
        } else {
            break;
        }
    }
    return chain;
};