// server/src/services/logisticsService.test.ts

import { planLogisticsRoute } from './logisticsService';
import { NODES } from '../mock/nodes';

// 描述测试套件
describe('Logistics Routing Service (物流寻路算法)', () => {

    // 1. 测试跨省长距离运输 (Happy Path)
    it('应正确规划 [上海仓 -> 长春买家] 的跨省路径 (走空运)', () => {
        const startId = 'WH_SH_QINGPU';
        const endId = 'ADDR_CC_FAW';

        const route = planLogisticsRoute(startId, endId);

        // 断言：路径不应为空
        expect(route).toBeDefined();
        expect(route.length).toBeGreaterThan(0);

        // 断言：起点和终点必须正确
        expect(route[0].id).toBe(startId);
        expect(route[route.length - 1].id).toBe(endId);

        // 断言：中间必须经过核心枢纽 (Hubs)
        // 应该经过上海虹桥机场 (Hub)
        const hasShanghaiHub = route.some(node => node.id === 'HUB_SH_HONGQIAO');
        expect(hasShanghaiHub).toBe(true);

        // 应该经过长春龙嘉机场 (Hub)
        const hasChangchunHub = route.some(node => node.id === 'HUB_CC_LONGJIA');
        expect(hasChangchunHub).toBe(true);

        // 打印路径方便调试
        console.log('跨省路径:', route.map(n => n.name).join(' -> '));
    });

    // 2. 测试同城/同区域运输 (Short Distance)
    it('应正确规划 [广州仓 -> 广州买家] 的同城路径 (不经过机场)', () => {
        const startId = 'WH_GZ_BAIYUN';
        const endId = 'ADDR_GZ_TIANHE';

        const route = planLogisticsRoute(startId, endId);

        // 断言：路径存在
        expect(route.length).toBeGreaterThan(0);

        // 断言：应该经过 "广州穗运分拨中心" (公共父节点)
        const hasCenter = route.some(node => node.id === 'CENTER_GZ_SUIYUN');
        expect(hasCenter).toBe(true);

        // 断言：不应该经过北京/上海的节点
        const hasBeijing = route.some(node => node.city === 'Beijing');
        expect(hasBeijing).toBe(false);

        console.log('同城路径:', route.map(n => n.name).join(' -> '));
    });

    // 3. 测试异常情况 (Edge Case)
    it('当输入不存在的节点 ID 时，应抛出错误', () => {
        const invalidId = 'INVALID_NODE_ID';

        // 测试抛错需要用 wrapper 函数包裹
        expect(() => {
            planLogisticsRoute(invalidId, 'WH_SH_QINGPU');
        }).toThrow('节点不存在');
    });

});