// admin/src/types/index.ts

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
}

// 定义后端返回的标准结构
export interface ApiResponse<T> {
    code: number;
    data: T;
    msg: string;
}