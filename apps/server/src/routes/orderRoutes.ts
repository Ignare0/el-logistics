import { Router } from 'express';
import {
    getOrders,
    getOrderById,
    shipOrder,
    createOrder,
    confirmReceipt,
    setDeliveryMethod,
    dispatchBatchOrders,
    urgeOrder,
    cancelOrder
} from '../controllers/orderController';

const router = Router();

// 1. 查询类
router.get('/', getOrders);             // 获取列表
router.get('/:id', getOrderById);       // 获取详情

// 2. 操作类
router.post('/', createOrder);          // 创建订单 (Admin用)
router.post('/:id/ship', shipOrder);    // 单个发货
router.post('/dispatch/batch', dispatchBatchOrders); // 批量发货 (末端)
router.post('/:id/confirm', confirmReceipt); // 确认收货 (Mobile用)
router.post('/:id/delivery-method', setDeliveryMethod); // 设置配送方式 (Mobile用)
router.post('/:id/urge', urgeOrder);    // 催单 (Mobile用)
router.post('/:id/cancel', cancelOrder); // 取消订单

export default router;