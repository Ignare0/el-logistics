// mobile/utils/api.ts

// 定义简单的订单接口
export interface Order {
    id: string;
    status: string;
    logistics: {
        startLat: number;
        startLng: number;
        endLat: number;
        endLng: number;
        currentLat?: number;
        currentLng?: number;
    };
}

// 专门用于 SSR 的请求函数
export const getOrderById = async (id: string): Promise<Order | null> => {
    try {
        // 注意：在 SSR 服务端请求时，必须写完整 URL (http://localhost:4000)
        // cache: 'no-store' 表示不缓存，每次都去后端拉最新状态
        const res = await fetch(`http://localhost:4000/api/orders/${id}`, {
            cache: 'no-store'
        });

        if (!res.ok) return null;

        const json = await res.json();
        return json.code === 200 ? json.data : null;
    } catch (e) {
        console.error('Fetch Error:', e);
        return null;
    }
};