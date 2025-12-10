import { ApiResponse, Order } from '@el/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// SWR 需要一个 fetcher 函数
export const fetcher = async <T>(url: string): Promise<T> => {
    const res = await fetch(url, { cache: 'no-store' });

    // 如果状态码不是 2xx，SWR 会将其视为错误
    if (!res.ok) {
        const error = new Error('An error occurred while fetching the data.');
        // 可以附加更多信息到 error 对象
        // error.info = await res.json();
        // error.status = res.status;
        throw error;
    }

    const json = (await res.json()) as ApiResponse<T>;
    if (json.code !== 200) {
        throw new Error(json.msg || 'API returned an error.');
    }
    return json.data;
};
export const getOrders = async (phone?: string): Promise<Order[]> => {
    try {
        const url = phone ? `${API_URL}/orders?phone=${encodeURIComponent(phone)}` : `${API_URL}/orders`;
        return await fetcher<Order[]>(url);
    } catch (e) {
        console.error('获取订单列表失败', e);
        return [];
    }
};

// 订单详情获取 (保持不变，但会被 useOrder hook 使用)
export const getOrderById = async (id: string, phone?: string): Promise<Order | null> => {
    try {
        const url = phone ? `${API_URL}/orders/${id}?phone=${encodeURIComponent(phone)}` : `${API_URL}/orders/${id}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return null;
        const json = (await res.json()) as ApiResponse<Order>;
        return json.code === 200 ? json.data : null;
    } catch (e) {
        return null;
    }
};

// 确认收货接口
export const confirmOrderReceipt = async (id: string): Promise<Order | null> => {
    try {
        const res = await fetch(`${API_URL}/orders/${id}/confirm`, {
            method: 'POST',
            cache: 'no-store'
        });
        if (!res.ok) return null;
        const json = (await res.json()) as ApiResponse<Order>;
        return json.code === 200 ? json.data : null;
    } catch (e) {
        console.error('确认收货失败', e);
        return null;
    }
};

export const setDeliveryMethod = async (id: string, method: 'HOME' | 'STATION'): Promise<Order | null> => {
    try {
        const res = await fetch(`${API_URL}/orders/${id}/delivery-method`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ method }),
            cache: 'no-store'
        });
        if (!res.ok) return null;
        const json = (await res.json()) as ApiResponse<Order>;
        return json.code === 200 ? json.data : null;
    } catch (e) {
        console.error('设置配送方式失败', e);
        return null;
    }
};

export const urgeOrder = async (id: string): Promise<Order | null> => {
    try {
        const res = await fetch(`${API_URL}/orders/${id}/urge`, {
            method: 'POST',
            cache: 'no-store'
        });
        if (!res.ok) return null;
        const json = (await res.json()) as ApiResponse<Order>;
        return json.code === 200 ? json.data : null;
    } catch (e) {
        console.error('催单失败', e);
        return null;
    }
};

export const cancelOrder = async (id: string): Promise<Order | null> => {
    try {
        const res = await fetch(`${API_URL}/orders/${id}/cancel`, {
            method: 'POST',
            cache: 'no-store'
        });
        if (!res.ok) return null;
        const json = (await res.json()) as ApiResponse<Order>;
        return json.code === 200 ? json.data : null;
    } catch (e) {
        console.error('取消订单失败', e);
        return null;
    }
};
