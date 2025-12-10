import { ServerOrder } from '../types/internal';
import { OrderStatus } from '@el/types';
import { NODES } from './nodes';

// 初始 Mock 数据，集中存放
// 仅保留空数组，后续由 orderGenerator 自动生成同城外卖订单
export const orders: ServerOrder[] = [];
