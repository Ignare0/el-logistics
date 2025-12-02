export enum OrderStatus {
    PENDING = 'pending',     // 待发货
    SHIPPING = 'shipping',   // 运输中
    DELIVERED = 'delivered'  // 已送达
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
        startLat: number;
        startLng: number;
        endLat: number;
        endLng: number;
        currentLat?: number;
        currentLng?: number;
    };
}