import { ServerOrder } from '../types/internal';
import { OrderStatus } from '@el/types';
import { NODES } from './nodes';

// 初始 Mock 数据，集中存放
export const orders: ServerOrder[] = [
    {
        id: 'ORDER_001',
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
        customer: { name: '李四', phone: '13900139000', address: '武汉大学' },
        amount: 99.50,
        createdAt: '2023-10-01 12:30:00',
        status: OrderStatus.SHIPPING, // 这个订单假设已经在跑了
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
    }
];