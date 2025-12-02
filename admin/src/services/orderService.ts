// admin/src/services/orderService.ts
import request from '../utils/request';
import type { ApiResponse, Order } from '../types';

// 获取订单列表
export const fetchOrders = async (): Promise<ApiResponse<Order[]>> => {
    // 实际请求的是 http://localhost:4000/api/orders
    return request.get('/orders');
};

//发货请求
export const shipOrder = async (orderId: string): Promise<ApiResponse<Order>> => {
    return request.post(`/orders/${orderId}/ship`);
}