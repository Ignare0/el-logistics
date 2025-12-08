// packages/types/index.ts
export type NodeType = 'HUB' | 'CENTER' | 'STATION' | 'WAREHOUSE' | 'ADDRESS';

// ✅ 2. 把 LogisticsNode 接口定义移到这里并导出
export interface LogisticsNode {
    id: string;        // 唯一标识
    name: string;      // 显示名称
    type: NodeType;    // 节点类型

    location: {
        lat: number;   // 纬度
        lng: number;   // 经度
    };

    city?: string;     // 所属城市
    regionCode?: string; // 行政区划代码
}
export interface TimelineEvent {
    status: string;         // 例如 "shipping", "arrived_node"
    description: string;    // 例如 "已到达【上海转运中心】"
    timestamp: string;      // ISO 时间字符串
    location?: string;      // 可选，记录地点
}

export enum OrderStatus {
    PENDING = 'pending',       // 待发货
    SHIPPING = 'shipping',     // 运输中
    DELIVERED = 'delivered',   // 已送达（车到了）
    COMPLETED = 'completed',   // 已完成（用户确认收货）
    EXCEPTION = 'exception'    // 异常
}

// 状态对应的 UI 展示配置（颜色、文案）
export const OrderStatusMap: Record<OrderStatus, { text: string; color: string }> = {
    [OrderStatus.PENDING]: { text: '待发货', color: 'orange' },
    [OrderStatus.SHIPPING]: { text: '运输中', color: 'blue' },
    [OrderStatus.DELIVERED]: { text: '已送达', color: 'green' },
    [OrderStatus.COMPLETED]: { text: '已完成', color: 'gray' }, // 新增
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
    eta?: string;
    startCity?: string;
    endCity?: string;

    // 这里的类型必须和上面定义的一致
    timeline: TimelineEvent[];

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

// Socket 推送的数据结构
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
    timestamp?: string; // 最好加上这个，方便前端展示
}