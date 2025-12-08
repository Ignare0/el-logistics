import { Router } from 'express';
import {
    getOrders,
    getOrderById,
    shipOrder,
    createOrder,
    confirmReceipt
} from '../controllers/orderController';

const router = Router();

// 1. 查询类
router.get('/', getOrders);             // 获取列表
router.get('/:id', getOrderById);       // 获取详情

// 2. 操作类
router.post('/', createOrder);          // 创建订单 (Admin用)
router.post('/:id/ship', shipOrder);    // 发货 (Admin用)
router.post('/:id/confirm', confirmReceipt); // 确认收货 (Mobile用)

export default router;