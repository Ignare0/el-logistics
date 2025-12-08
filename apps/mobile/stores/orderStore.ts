import { create } from 'zustand';
import { Order, OrderStatus, PositionUpdatePayload } from '@el/types';
import { getDistance } from 'geolib';

interface OrderState {
    order: Order | null;
    distance: string | null;
    actions: {
        setInitialOrder: (order: Order) => void;
        updateFromSocket: (data: PositionUpdatePayload) => void;
        confirmReceipt: (updatedOrder: Order) => void;
    };
}

export const useOrderStore = create<OrderState>((set, get) => ({
    order: null,
    distance: null,
    actions: {
        // Action 1: 初始化 Store
        setInitialOrder: (order) => {

            order.timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            set({ order });
        },
        // Action 2: 处理来自 WebSocket 的更新 (核心逻辑)
        updateFromSocket: (data) => {
            const currentOrder = get().order;
            if (!currentOrder) return;

            // 深拷贝一份新数据来更新状态
            const newOrder = { ...currentOrder, logistics: { ...currentOrder.logistics }, timeline: [...currentOrder.timeline] };

            // 1. 更新实时坐标
            newOrder.logistics.currentLat = data.lat;
            newOrder.logistics.currentLng = data.lng;

            // 2. 更新主状态
            if (data.status === 'delivered') {
                newOrder.status = OrderStatus.DELIVERED;
            }

            // 3. 更新时间线
            const lastEvent = newOrder.timeline[0];
            if (!lastEvent || lastEvent.description !== data.statusText) {
                newOrder.timeline.unshift({ // 使用 unshift 在数组开头添加
                    status: data.status,
                    description: data.statusText,
                    timestamp: data.timestamp || new Date().toISOString(),
                    location: `${data.lng.toFixed(4)}, ${data.lat.toFixed(4)}`
                });
            }

            // 4. 计算距离
            const distInMeters = getDistance(
                { latitude: data.lat, longitude: data.lng },
                { latitude: newOrder.logistics.endLat, longitude: newOrder.logistics.endLng }
            );
            const newDistance = (distInMeters / 1000).toFixed(1);

            // 5. 一次性更新所有状态
            set({ order: newOrder, distance: newDistance });
        },

        // Action 3: 用户确认收货后更新状态
        confirmReceipt: (updatedOrder) => {
            set({ order: updatedOrder });
        }
    }
}));

// 导出 Action，方便在组件中调用，避免直接访问 store.actions
export const useOrderActions = () => useOrderStore((state) => state.actions);