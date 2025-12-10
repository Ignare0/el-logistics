// packages/types/index.ts
export type NodeType = 'STATION' | 'LOCKER' | 'ADDRESS';

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
    EXCEPTION = 'exception',   // 异常
    CANCELLED = 'cancelled'    // 已取消
}

// 状态对应的 UI 展示配置（颜色、文案）
export const OrderStatusMap: Record<OrderStatus, { text: string; color: string }> = {
    [OrderStatus.PENDING]: { text: '待发货', color: 'orange' },
    [OrderStatus.SHIPPING]: { text: '运输中', color: 'blue' },
    [OrderStatus.DELIVERED]: { text: '已送达', color: 'green' },
    [OrderStatus.COMPLETED]: { text: '已完成', color: 'gray' },
    [OrderStatus.EXCEPTION]: { text: '异常', color: 'red' },
    [OrderStatus.CANCELLED]: { text: '已取消', color: 'gray' }
};

export interface OrderItem {
    sku: string;
    name: string;
    quantity: number;
}

export interface Order {
    id: string;
    merchantId?: string; // 商家ID
    customerId?: string; // 用户ID
    serviceLevel?: 'EXPRESS' | 'STANDARD'; // 服务等级：特快/普快
    deliveryType?: 'LONG_HAUL' | 'LAST_MILE'; // 配送类型：干线/同城末端
    category?: 'NORMAL' | 'FRESH' | 'MEDICAL'; // 商品类别：普通/生鲜/医药
    priorityScore?: number; // 动态优先级分数
    isUrged?: boolean; // 是否被催单
    isReturning?: boolean; // 骑手是否在返程中
    promisedTime?: string; // 承诺送达时间
    
    items?: OrderItem[]; // 新增：订单商品明细

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
    startNodeName?: string; // 新增：起点名称（商家/站点）
    endNodeName?: string;   // 新增：终点名称（虽然通常是 customer.address，但也可能不同）
    deliveryMethod?: 'HOME' | 'LOCKER';
    waitingForSelection?: boolean;

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
        plannedRoute?: LogisticsNode[];
        actualRoute?: [number, number][]; // 实际行驶路径坐标点集合
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
    status: 'arrived_node' | 'shipping' | 'delivered' | 'waiting_for_selection' | 'returning' | 'rider_idle' | 'cancelled';
    statusText: string;
    transport?: 'AIR' | 'TRUNK' | 'DELIVERY';
    zoom?: number;
    speed?: number;
    resetView?: boolean;
    timestamp?: string;
}

export interface WarehouseStock {
    nodeId: string;
    inventory: Record<string, number>; // sku -> count
}

export interface Merchant {
    id: string;
    name: string;
    warehouses: WarehouseStock[]; // 商家拥有的仓库节点及库存
}

export interface User {
    id: string;
    name: string;
    phone: string;
}
