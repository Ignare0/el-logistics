import request from '../utils/request';
// 引入 Monorepo 共享类型
import type { ApiResponse, Order, LogisticsNode } from '@el/types';

// ✅ 定义创建订单时发送给后端的数据结构
export interface CreateOrderPayload {
    customer: {
        name: string;
        phone: string;
        address: string;
    };
    amount: number;
    startNodeId: string;
    endNodeId: string;
    serviceLevel?: string; // 可选，默认为 STANDARD
}

// ✅ 定义节点接口返回的数据结构
export interface SelectableNodes {
    warehouses: LogisticsNode[];
    addresses: LogisticsNode[];
}
// 注意：由于我们在 request.ts 拦截器里返回了 response.data
// 这里的返回值其实就是 ApiResponse<T>
// 我们需要告诉 TypeScript，request.get 返回的是 Promise<ApiResponse<T>>
// 而不是 AxiosResponse。

export const fetchOrders = async (params?: { merchantId?: string; customerId?: string }): Promise<ApiResponse<Order[]>> => {
    // 第一个泛型：服务器原始返回的数据结构 (T)
    // 第二个泛型：经过 request.ts 拦截器剥离后，最终返回的数据结构 (R)
    return request.get<ApiResponse<Order[]>, ApiResponse<Order[]>>('/orders', { params });
};

export const shipOrder = async (orderId: string): Promise<ApiResponse<Order>> => {
    // 这里的泛型顺序是 <ResponseData, ReturnType> (Axios 泛型定义较为复杂，显式指定是最安全的)
    return request.post<ApiResponse<Order>, ApiResponse<Order>>(`/orders/${orderId}/ship`);
};
// ✅ 新增：创建订单的 API 函数
export const createOrder = async (payload: CreateOrderPayload): Promise<ApiResponse<Order>> => {
    return request.post<ApiResponse<Order>, ApiResponse<Order>>('/orders', payload);
};

// 批量发货 (智能调度)
export const dispatchBatch = async (orderIds: string[]): Promise<ApiResponse<any>> => {
    return request.post<ApiResponse<any>, ApiResponse<any>>('/orders/dispatch/batch', { orderIds });
};

// ✅ 新增：获取可选节点的 API 函数
export const fetchSelectableNodes = async (): Promise<ApiResponse<SelectableNodes>> => {
    return request.get<ApiResponse<SelectableNodes>, ApiResponse<SelectableNodes>>('/nodes/selectable');
};

// ✅ 新增：取消订单
export const cancelOrder = async (orderId: string): Promise<ApiResponse<Order>> => {
    return request.post<ApiResponse<Order>, ApiResponse<Order>>(`/orders/${orderId}/cancel`);
};

// 查询轻量事件日志
export const fetchEventLogs = async (limit: number = 50): Promise<ApiResponse<any[]>> => {
    return request.get<ApiResponse<any[]>, ApiResponse<any[]>>(`/logs/events`, { params: { limit } });
};

// 获取骑手池状态
export interface RiderPoolRes {
    code?: number;
    data: { maxRiders: number; perRiderMaxOrders: number; riders: { id: number; status: 'idle'|'busy'|'returning'|'offline'; activeOrderIds: string[] }[] };
    msg?: string;
}
export const fetchRiders = async (): Promise<RiderPoolRes> => {
    return request.get<RiderPoolRes, RiderPoolRes>(`/riders`);
};

// 更新骑手配置
export const updateRiderConfig = async (payload: { maxRiders?: number; perRiderMaxOrders?: number }): Promise<RiderPoolRes> => {
    return request.post<RiderPoolRes, RiderPoolRes>(`/riders/config`, payload);
};
