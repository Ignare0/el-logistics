// packages/types/index.ts

export enum OrderStatus {
    PENDING = 'pending',
    SHIPPING = 'shipping',
    DELIVERED = 'delivered',
    EXCEPTION = 'exception'
}

export const OrderStatusMap: Record<OrderStatus, { text: string; color: string }> = {
    [OrderStatus.PENDING]: { text: '待发货', color: 'orange' },
    [OrderStatus.SHIPPING]: { text: '运输中', color: 'blue' },
    [OrderStatus.DELIVERED]: { text: '已送达', color: 'green' },
    [OrderStatus.EXCEPTION]: { text: '异常', color: 'red' }
};

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


    logistics: {
        startNodeId?: string;
        endNodeId?: string;

        startLat: number;
        startLng: number;
        endLat: number;
        endLng: number;

        currentLat?: number;
        currentLng?: number;
    };
}

export interface ApiResponse<T> {
    code: number;
    msg: string;
    data: T;
}

export interface PositionUpdatePayload {
    orderId: string;
    lat: number;
    lng: number;
    status: 'arrived_node' | 'shipping' | 'delivered';
    statusText: string;
    transport?: 'AIR' | 'TRUNK' | 'DELIVERY';
    zoom?: number;
    speed?: number;
    resetView?: boolean;
}