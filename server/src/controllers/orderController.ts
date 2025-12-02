import { Request, Response } from 'express';
import { success } from '../utils/response';
import { Order, OrderStatus } from '../types/order';

// --- 模拟数据库 (Mock DB) ---
// 注意：每次重启服务器，数据会重置
const orders: Order[] = [
    {
        id: 'ORDER_001',
        customer: { name: '张三', phone: '13800138000', address: '北京市朝阳区大悦城' },
        amount: 299.00,
        createdAt: '2023-10-01 10:00:00',
        status: OrderStatus.PENDING, // 待发货
        logistics: {
            startLat: 39.9042, startLng: 116.4074, // 北京
            endLat: 31.2304, endLng: 121.4737      // 上海
        }
    },
    {
        id: 'ORDER_002',
        customer: { name: '李四', phone: '13900139000', address: '上海市浦东新区' },
        amount: 99.50,
        createdAt: '2023-10-01 12:30:00',
        status: OrderStatus.SHIPPING, // 运输中
        logistics: {
            startLat: 39.9042, startLng: 116.4074,
            endLat: 31.2304, endLng: 121.4737,
            currentLat: 34.0000, currentLng: 118.0000 // 假设走到中间了
        }
    }
];

// --- 控制器方法 ---

// 获取所有订单
export const getOrders = (req: Request, res: Response) => {
    // 这里未来可以加 status 筛选逻辑
    // const { status } = req.query;
    res.json(success(orders));
};

// 获取单个订单详情
export const getOrderById = (req: Request, res: Response) => {
    const { id } = req.params;
    const order = orders.find(o => o.id === id);
    if (order) {
        res.json(success(order));
    } else {
        res.status(404).json({ code: 404, msg: '订单不存在', data: null });
    }
};
/// 发货操作
export const shipOrder = (req: Request, res: Response) => {
    const { id } = req.params;
    const order = orders.find(o => o.id === id);

    if (!order) {
        return res.status(404).json({ code: 404, msg: '订单不存在', data: null });
    }

    // 只有“待发货”的才能发货
    if (order.status !== OrderStatus.PENDING) {
        return res.status(400).json({ code: 400, msg: '订单状态不正确，无法发货', data: null });
    }

    // 1. 修改状态
    order.status = OrderStatus.SHIPPING;

    // 2. TODO: 这里未来会触发“轨迹模拟” (Phase 5)
    console.log(`🚚 订单 ${id} 已发货，准备开始模拟轨迹...`);

    res.json(success(order, '发货成功'));
};