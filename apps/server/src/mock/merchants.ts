import { Merchant } from '@el/types';

export const merchants: Merchant[] = [
    {
        id: 'M_001',
        name: '京东自营',
        warehouses: [
            {
                nodeId: 'WH_SH_QINGPU',
                inventory: {
                    'sku_iphone15': 100,
                    'sku_macbook': 50,
                    'sku_water': 1000
                }
            },
            {
                nodeId: 'WH_BJ_DASHING', // 假设我们有这个节点，稍后检查 nodes.ts
                inventory: {
                    'sku_iphone15': 10,
                    'sku_macbook': 100,
                    'sku_water': 0 // 北京缺水
                }
            }
        ]
    },
    {
        id: 'M_002',
        name: '顺丰优选',
        warehouses: [
            {
                nodeId: 'WH_GZ_BAIYUN',
                inventory: {
                    'sku_litchi': 500, // 荔枝
                    'sku_tea': 200
                }
            },
            {
                nodeId: 'WH_SZ_BAOAN', // 稍后检查
                inventory: {
                    'sku_litchi': 50,
                    'sku_electronics': 1000
                }
            }
        ]
    }
];
