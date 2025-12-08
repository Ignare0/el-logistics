import request from '../utils/request';
// 引入 Monorepo 共享类型
import type { ApiResponse, Order } from '@el/types';

// 注意：由于我们在 request.ts 拦截器里返回了 response.data
// 这里的返回值其实就是 ApiResponse<T>
// 我们需要告诉 TypeScript，request.get 返回的是 Promise<ApiResponse<T>>
// 而不是 AxiosResponse。

export const fetchOrders = async (): Promise<ApiResponse<Order[]>> => {
    // 第一个泛型：服务器原始返回的数据结构 (T)
    // 第二个泛型：经过 request.ts 拦截器剥离后，最终返回的数据结构 (R)
    return request.get<ApiResponse<Order[]>, ApiResponse<Order[]>>('/orders');
};

export const shipOrder = async (orderId: string): Promise<ApiResponse<Order>> => {
    // 这里的泛型顺序是 <ResponseData, ReturnType> (Axios 泛型定义较为复杂，显式指定是最安全的)
    return request.post<ApiResponse<Order>, ApiResponse<Order>>(`/orders/${orderId}/ship`);
};