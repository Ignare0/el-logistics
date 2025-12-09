import { ServerOrder } from '../types/internal';
import { OrderStatus } from '@el/types';
import { NODES } from './nodes';

// 初始 Mock 数据，集中存放
export const orders: ServerOrder[] = [
    {
        id: 'ORDER_001',
        merchantId: 'M_001',
        customerId: 'U_001',
        serviceLevel: 'STANDARD',
        items: [
            { sku: 'sku_water', name: '农夫山泉 550ml', quantity: 24 }
        ],
        customer: { name: '张三', phone: '13800138000', address: '长春一汽家属院' },
        amount: 299.00,
        createdAt: '2023-10-01 10:00:00',
        status: OrderStatus.PENDING,
        eta: '2025-12-04 15:00',
        timeline: [
            {
                status: 'created',
                description: '订单已提交，等待商家揽收',
                timestamp: new Date().toISOString(),
                location: '上海市'
            }
        ],
        logistics: {
            startNodeId: 'WH_SH_QINGPU',
            endNodeId: 'ADDR_CC_FAW',
            startLat: NODES['WH_SH_QINGPU'].location.lat,
            startLng: NODES['WH_SH_QINGPU'].location.lng,
            endLat: NODES['ADDR_CC_FAW'].location.lat,
            endLng: NODES['ADDR_CC_FAW'].location.lng,
            plannedRoute: [],
        }
    },
    {
        id: 'ORDER_002',
        merchantId: 'M_002',
        customerId: 'U_002',
        serviceLevel: 'EXPRESS',
        items: [
            { sku: 'sku_litchi', name: '妃子笑荔枝 5kg', quantity: 1 }
        ],
        customer: { name: '李四', phone: '13900139000', address: '武汉大学' },
        amount: 99.50,
        createdAt: '2023-10-01 12:30:00',
        status: OrderStatus.SHIPPING,
        eta: '2025-12-04 15:00',
        timeline: [],
        logistics: {
            startNodeId: 'WH_GZ_BAIYUN',
            endNodeId: 'ADDR_WH_UNIV',
            startLat: NODES['WH_GZ_BAIYUN'].location.lat,
            startLng: NODES['WH_GZ_BAIYUN'].location.lng,
            endLat: NODES['ADDR_WH_UNIV'].location.lat,
            endLng: NODES['ADDR_WH_UNIV'].location.lng,
            plannedRoute: []
        }
    },
    // 新增：北京发广州（特快）
    {
        id: 'ORDER_003',
        merchantId: 'M_001',
        customerId: 'U_003', // 假设新用户
        serviceLevel: 'EXPRESS',
        items: [
            { sku: 'sku_macbook', name: 'MacBook Pro 14', quantity: 1 }
        ],
        customer: { name: '王五', phone: '13700137000', address: '广州天河IFC' },
        amount: 14999.00,
        createdAt: '2023-10-02 09:00:00',
        status: OrderStatus.PENDING,
        eta: '计算中...',
        timeline: [],
        logistics: {
            startNodeId: 'WH_BJ_DASHING',
            endNodeId: 'ADDR_GZ_TIANHE',
            startLat: NODES['WH_BJ_DASHING'].location.lat,
            startLng: NODES['WH_BJ_DASHING'].location.lng,
            endLat: NODES['ADDR_GZ_TIANHE'].location.lat,
            endLng: NODES['ADDR_GZ_TIANHE'].location.lng,
            plannedRoute: []
        }
    }
];
