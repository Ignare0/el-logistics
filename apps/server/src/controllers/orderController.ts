import { Request, Response } from 'express';
import { error, success } from '../utils/response';
import { OrderStatus, TimelineEvent } from '@el/types';
import { ServerOrder } from '../types/internal';
import { startSimulation } from "../utils/simulator";
import { planLogisticsRoute } from '../services/logisticsService';
import { NODES } from '../mock/nodes';
import { orders } from '../mock/orders';
const sortOrderTimeline = (order: ServerOrder) => {
    order.timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return order;
};
const enrichOrderWithCities = (order: ServerOrder) => {
    if (order.logistics.startNodeId) {
        order.startCity = NODES[order.logistics.startNodeId]?.city;
    }
    if (order.logistics.endNodeId) {
        order.endCity = NODES[order.logistics.endNodeId]?.city;
    }
    return order;
};
// --- 1. 获取列表 ---
export const getOrders = (req: Request, res: Response) => {
    // 真实场景可以用 req.query.status 筛选
    const enrichedOrders = orders.map(enrichOrderWithCities);
    res.json(success(enrichedOrders));
};

// --- 2. 获取详情 ---
export const getOrderById = (req: Request, res: Response) => {
    const { id } = req.params;
    const order = orders.find(o => o.id === id);
    if (order) {
        const sortedOrder = sortOrderTimeline(JSON.parse(JSON.stringify(order)));
        res.json(success(enrichOrderWithCities(order)));
    } else {
        res.status(404).json(error('订单不存在', 404));
    }
};

// --- 3. [新增] 创建订单 ---
export const createOrder = (req: Request, res: Response) => {
    const { customer, amount, startNodeId, endNodeId } = req.body;

    if (!customer || !startNodeId || !endNodeId) {
        return res.status(400).json(error('参数不完整'));
    }

    const startNode = NODES[startNodeId];
    const endNode = NODES[endNodeId];

    if (!startNode || !endNode) {
        return res.status(400).json(error('无效的节点 ID'));
    }

    const newId = `ORDER_${Date.now().toString().slice(-6)}`; // 简易 ID 生成

    const newOrder: ServerOrder = {
        id: newId,
        customer,
        amount: Number(amount),
        createdAt: new Date().toISOString(),
        status: OrderStatus.PENDING,
        eta: '计算中...',
        timeline: [{
            status: 'created',
            description: '商家已接单，等待发货',
            timestamp: new Date().toISOString() // ✅ 修正为 timestamp
        }],
        logistics: {
            startNodeId,
            endNodeId,
            startLat: startNode.location.lat,
            startLng: startNode.location.lng,
            endLat: endNode.location.lat,
            endLng: endNode.location.lng,
            plannedRoute: []
        }
    };

    orders.unshift(newOrder); // 加到数组最前面
    res.json(success(newOrder, '订单创建成功'));
};

// --- 4. 发货 (启动模拟) ---
export const shipOrder = (req: Request, res: Response) => {
    const { id } = req.params;
    const order = orders.find(o => o.id === id);

    if (!order) return res.status(404).json(error('订单不存在'));

    // 只有 PENDING 状态才能发货
    if (order.status !== OrderStatus.PENDING) {
        return res.status(400).json(error(`订单状态为 ${order.status}，无法重复发货`));
    }

    // 1. 路径规划
    if (order.logistics.startNodeId && order.logistics.endNodeId) {
        try {
            const route = planLogisticsRoute(
                order.logistics.startNodeId,
                order.logistics.endNodeId
            );
            order.logistics.plannedRoute = route;
        } catch (e) {
            console.error(e);
            return res.status(500).json(error('路径规划失败'));
        }
    }

    // 2. 更新状态
    order.status = OrderStatus.SHIPPING;
    order.timeline.push({
        status: 'shipping',
        description: '包裹已揽收，开始运输',
        timestamp: new Date().toISOString() // ✅ 修正为 timestamp
    });

    // 3. 启动 Socket 模拟
    const io = req.app.get('socketio');
    startSimulation(io, order);

    res.json(success(order, '发货成功'));
};

// --- 5. [新增] 确认收货 ---
export const confirmReceipt = (req: Request, res: Response) => {
    const { id } = req.params;
    const order = orders.find(o => o.id === id);

    if (!order) return res.status(404).json(error('订单不存在'));

    // 必须是 已送达 或 运输中(允许提前收货) 才能确认
    if (order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.SHIPPING) {
        return res.status(400).json(error('当前状态无法确认收货'));
    }

    order.status = OrderStatus.COMPLETED;
    order.timeline.push({
        status: 'completed',
        description: '客户已确认收货，感谢您的使用',
        timestamp: new Date().toISOString() // ✅ 修正为 timestamp
    });

    const io = req.app.get('socketio');
    if (io) {
        io.emit('order_updated', {
            orderId: id,
            status: OrderStatus.COMPLETED
        });
    }

    res.json(success(order, '确认收货成功'));
};