import { Router } from 'express';
import { getOrders, getOrderById, shipOrder } from '../controllers/orderController';

const router = Router();

// 定义路由规则
// GET /api/orders
router.get('/', getOrders);

// GET /api/orders/:id  (例如: /api/orders/ORDER_001)
router.get('/:id', getOrderById);
// POST /api/orders/:id/ship
router.post('/:id/ship', shipOrder);

export default router;