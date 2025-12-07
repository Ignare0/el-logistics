import { Order, OrderStatus } from '@el/types';
import { LogisticsNode } from '../domain/Node';

// 继承共享的 Order
export interface ServerOrder extends Order {
    // 这里使用了 TypeScript 的交叉类型
    logistics: Order['logistics'] & {
        // 标记为可选 (?)，这样 mock 数据里不写这个字段也不会报错
        plannedRoute?: LogisticsNode[];
        currentNodeIndex?: number;
    };
}

export { OrderStatus };