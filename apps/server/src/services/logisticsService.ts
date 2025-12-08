// server/src/services/logisticsService.ts

import { NODES } from '../mock/nodes';
import { NETWORK_TOPOLOGY } from '../mock/relations';
import { LogisticsNode } from '../domain/Node';

/**
 * 核心寻路算法
 * 输入：起点ID, 终点ID
 * 输出：完整的节点数组 [起点, ..., 枢纽, ..., 终点]
 */
export const planLogisticsRoute = (startNodeId: string, endNodeId: string): LogisticsNode[] => {
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
        // 路径 = 起点链 -> [干线] -> 终点链(反转)
        // 假设所有顶级枢纽(Hub)之间都是通的 (简化逻辑，实际可以用 Graph 搜索)

        // 拿到两个链的顶端 (Hub)
        // const sourceHub = sourceChain[sourceChain.length - 1];
        // const targetHub = targetChain[targetChain.length - 1];

        // 拼接: 上行链全部 + 下行链全部反转
        finalRoute = [...sourceChain, ...targetChain.reverse()];
    }

    return finalRoute;
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