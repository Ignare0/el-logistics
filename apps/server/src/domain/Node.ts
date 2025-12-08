// server/src/domain/Node.ts

/**
 * 定义节点的类型
 * HUB: 核心枢纽 (机场/大型转运中心) - 走飞机或干线车
 * CENTER: 城市分拨中心 - 走厢式货车
 * STATION: 末端网点 (营业部/驿站) - 走三轮车
 * WAREHOUSE: 商家仓库 - 起点
 * ADDRESS: 用户收货地址 - 终点
 */
import { NodeType, LogisticsNode } from '@el/types';

export type { NodeType, LogisticsNode };