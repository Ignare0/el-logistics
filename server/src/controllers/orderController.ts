import { Request, Response } from 'express';
import {error, success} from '../utils/response';
import { Order, OrderStatus } from '../types/order';
import {startSimulation} from "../utils/simulator";
import {planLogisticsRoute} from  '../services/logisticsService';
import { NODES } from '../mock/nodes';
// --- 模拟数据库 (Mock DB) ---
// 注意：每次重启服务器，数据会重置
const orders: Order[] = [
    {
        id: 'ORDER_001',
        customer: { name: '张三', phone: '13800138000', address: '长春一汽家属院' },
        amount: 299.00,
        createdAt: '2023-10-01 10:00:00',
        status: OrderStatus.PENDING, // 待发货
        logistics: {
            startNodeId: 'WH_SH_QINGPU', // 上海青浦仓
            endNodeId: 'ADDR_CC_FAW',    // 长春一汽
            startLat: NODES['WH_SH_QINGPU'].location.lat,
            startLng: NODES['WH_SH_QINGPU'].location.lng,

            endLat: NODES['ADDR_CC_FAW'].location.lat,
            endLng: NODES['ADDR_CC_FAW'].location.lng,
        }
    },
    {
        id: 'ORDER_002',
        customer: { name: '李四', phone: '13900139000', address: '武汉大学' },
        amount: 99.50,
        createdAt: '2023-10-01 12:30:00',
        status: OrderStatus.SHIPPING,
        logistics: {
            startNodeId: 'WH_GZ_BAIYUN', // 广州仓
            endNodeId: 'ADDR_WH_UNIV',   // 武大

            startLat: NODES['WH_GZ_BAIYUN'].location.lat,
            startLng: NODES['WH_GZ_BAIYUN'].location.lng,
            endLat: NODES['ADDR_WH_UNIV'].location.lat,
            endLng: NODES['ADDR_WH_UNIV'].location.lng,
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
    // 计算真实物流路径
    if (order.logistics?.startNodeId && order.logistics?.endNodeId) {
        try {
            // 调用我们刚才测试过的服务
            const route = planLogisticsRoute(
                order.logistics.startNodeId,
                order.logistics.endNodeId
            );
            // 将计算出的路径存入订单对象，供模拟器使用
            order.logistics.plannedRoute = route;
            console.log(`✅ 路径规划成功: ${route.map(n => n.name).join(' -> ')}`);
        } catch (e) {
            console.error('路径规划失败', e);
            return res.status(500).json(error('路径规划失败，请检查节点配置'));
        }
    } else {
        return res.status(400).json(error('订单缺少起终点 NodeID'));
    }

    order.status = OrderStatus.SHIPPING;

    //启动新版模拟器
    const io = req.app.get('socketio');
    startSimulation(io, order);

    res.json(success(order, '发货成功'));
};