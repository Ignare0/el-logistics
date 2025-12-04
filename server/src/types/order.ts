// server/src/types/order.ts

import { LogisticsNode } from '../domain/Node';

export enum OrderStatus {
    PENDING = 'pending',
    SHIPPING = 'shipping',
    DELIVERED = 'delivered'
}

export interface Order {
    id: string;
    customer: {
        name: string;
        phone: string;
        address: string;
    };
    amount: number;
    createdAt: string;
    status: OrderStatus;

    logistics?: {
        startNodeId?: string;
        endNodeId?: string;

        plannedRoute?: LogisticsNode[];

        currentNodeIndex?: number;
        // 兼容旧字段
        startLat: number;
        startLng: number;
        endLat: number;
        endLng: number;
        currentLat?: number;
        currentLng?: number;
    };
}