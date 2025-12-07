// server/src/types/internal.ts

import { Order, OrderStatus, TimelineEvent } from '@el/types'; // 修改这里
import { LogisticsNode } from '../domain/Node';

export interface ServerOrder extends Order {
    logistics: Order['logistics'] & {
        currentLat?: number;
        currentLng?: number;
        plannedRoute?: LogisticsNode[];
    };

    timeline: TimelineEvent[];
}

export { OrderStatus };