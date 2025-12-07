import { Order, OrderStatus, TimelineEvent } from '@el/types';
import { LogisticsNode } from '../domain/Node';

// 继承共享的 Order
export interface ServerOrder extends Order {
    logistics: Order['logistics'] & {
        // 增加这两个字段，用于记录当前实时位置
        // 这样前端刷新页面时，可以从这里读取最新位置，而不是从头开始
        currentLat?: number;
        currentLng?: number;

        // 路径规划数据
        plannedRoute?: LogisticsNode[];
    };
}

export { OrderStatus };