// server/src/services/logisticsService.test.ts

import { planLogisticsRoute } from './logisticsService';
import { NODES } from '../mock/nodes';

// 描述测试套件
describe('Logistics Routing Service (同城外卖寻路算法)', () => {

    // 1. 测试同城配送 (Station -> Locker)
    it('应正确规划 [三里屯配送站 -> 三里屯SOHO自提柜] 的路径', () => {
        const startId = 'STATION_SLT';
        const endId = 'LOCKER_SOHO_T1';

        const route = planLogisticsRoute(startId, endId);

        // 断言：路径不应为空
        expect(route).toBeDefined();
        expect(route.length).toBe(2);

        // 断言：起点和终点必须正确
        expect(route[0].id).toBe(startId);
        expect(route[1].id).toBe(endId);

        // 打印路径方便调试
        console.log('自提路径:', route.map(n => n.name).join(' -> '));
    });

    // 2. 测试同城配送 (Station -> Address)
    it('应正确规划 [三里屯配送站 -> 地址] 的路径', () => {
        const startId = 'STATION_SLT';
        const endId = 'UNKNOWN_ADDRESS_ID'; // 模拟一个不在 NODES 表里的地址ID

        // 这种情况下，planLogisticsRoute 只返回起点，终点由调用方处理或假设直达
        const route = planLogisticsRoute(startId, endId);

        // 断言：路径存在，至少包含起点
        expect(route.length).toBeGreaterThan(0);
        expect(route[0].id).toBe(startId);

        console.log('送货上门路径:', route.map(n => n.name).join(' -> '));
    });

    // 3. 测试异常情况 (Edge Case)
    it('当输入不存在的起点 ID 时，应抛出错误', () => {
        const invalidId = 'INVALID_NODE_ID';

        // 测试抛错需要用 wrapper 函数包裹
        expect(() => {
            planLogisticsRoute(invalidId, 'LOCKER_SOHO_T1');
        }).toThrow('起点不存在');
    });

});
