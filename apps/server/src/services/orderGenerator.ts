
import { ServerOrder, OrderStatus } from '../types/internal';
import { orders } from '../mock/orders';
import { Server } from 'socket.io';

// 配送站位置 (以北京三里屯SOHO为中心)
// 116.4551, 39.9373
const STATION_LOCATION = {
    lng: 116.4551,
    lat: 39.9373,
    name: '三里屯配送站'
};

// 模拟的收货地址池 (围绕三里屯 3-5km 范围)
const ADDRESS_POOL = [
    { name: '三里屯SOHO', lng: 116.4551, lat: 39.9373 },
    { name: '太古里北区', lng: 116.4535, lat: 39.9390 },
    { name: '工人体育场', lng: 116.4470, lat: 39.9330 },
    { name: '团结湖公园', lng: 116.4630, lat: 39.9350 },
    { name: '朝阳公园', lng: 116.4780, lat: 39.9450 },
    { name: '世贸天阶', lng: 116.4530, lat: 39.9170 },
    { name: '国贸三期', lng: 116.4600, lat: 39.9100 },
    { name: '金地中心', lng: 116.4720, lat: 39.9120 },
    { name: '呼家楼', lng: 116.4620, lat: 39.9250 },
    { name: '东直门来福士', lng: 116.4350, lat: 39.9400 },
    { name: '亮马桥外交公寓', lng: 116.4650, lat: 39.9500 },
    // 故意放几个稍微远一点的，模拟“超区”
    { name: '通州万达 (超区)', lng: 116.6350, lat: 39.9050 },
    { name: '望京SOHO (超区)', lng: 116.4810, lat: 39.9980 },
];

const ITEM_POOL = [
    { sku: 'FRESH_001', name: '澳洲牛排', quantity: 1, category: 'FRESH' },
    { sku: 'DIGITAL_002', name: 'iPhone 15 Pro', quantity: 1, category: 'NORMAL' },
    { sku: 'DAILY_003', name: '维达纸巾', quantity: 10, category: 'NORMAL' },
    { sku: 'DRINK_004', name: '可口可乐', quantity: 6, category: 'NORMAL' },
    { sku: 'FOOD_005', name: '三只松鼠坚果', quantity: 2, category: 'NORMAL' },
    { sku: 'MED_001', name: '布洛芬缓释胶囊', quantity: 2, category: 'MEDICAL' }, // 新增医药
    { sku: 'FRESH_002', name: '波士顿龙虾', quantity: 1, category: 'FRESH' },
];

let isGenerating = false;
let generatorInterval: NodeJS.Timeout | null = null;

// 生成随机浮点数
const random = (min: number, max: number) => Math.random() * (max - min) + min;
// 随机打散坐标 (偏移约 100-500米)
const jitter = (val: number) => val + random(-0.005, 0.005);

/**
 * 计算订单优先级分数
 * Score = 基础分 + 等待时间分 + 催单分
 */
export const calculateScore = (order: Partial<ServerOrder>) => {
    let score = 0;
    
    // 1. 基础分
    switch (order.category) {
        case 'MEDICAL': score += 50; break;
        case 'FRESH': score += 30; break;
        default: score += 10;
    }

    // 2. 时间等待分 (每等待1分钟 +1分)
    if (order.createdAt) {
        const waitMinutes = (Date.now() - new Date(order.createdAt).getTime()) / 60000;
        score += Math.floor(waitMinutes);
    }

    // 3. 催单分
    if (order.isUrged) {
        score += 20;
    }

    return score;
};

export const startOrderGenerator = (io: Server) => {
    if (isGenerating) return;
    isGenerating = true;

    console.log('📦 开启末端订单模拟生成器...');

    let generatedCount = 0;
    generatorInterval = setInterval(() => {
        // 如果已经生成了20单，就停止
        if (generatedCount >= 20) {
            stopOrderGenerator();
            return;
        }

        // 每次生成 1-2 个订单
        const count = Math.floor(random(1, 3));
        
        for (let i = 0; i < count; i++) {
            if (generatedCount >= 20) break; // 双重检查

            const addr = ADDRESS_POOL[Math.floor(Math.random() * ADDRESS_POOL.length)];
            const item = ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
            
            const newId = `LM_ORDER_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const now = new Date();
            const promisedTime = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1小时后

            // 随机生成配送方式 (80% 送货上门, 20% 自提)
            const deliveryMethod = Math.random() > 0.2 ? 'HOME' : 'LOCKER';

            const category = item.category as 'NORMAL' | 'FRESH' | 'MEDICAL';

            const tempOrder: Partial<ServerOrder> = {
                category,
                createdAt: now.toISOString(),
                isUrged: false
            };
            const initialScore = calculateScore(tempOrder);

            const newOrder: ServerOrder = {
                id: newId,
                merchantId: 'M_001', // 假设都属于第一个商家
                customerId: 'C_RANDOM',
                serviceLevel: 'STANDARD',
                deliveryType: 'LAST_MILE',
                deliveryMethod: deliveryMethod as 'HOME' | 'LOCKER', // ✅ 自动分配配送方式
                waitingForSelection: false, // ✅ 不再需要用户选择
                promisedTime: promisedTime,
                status: OrderStatus.PENDING,
                createdAt: now.toISOString(),
                amount: Math.floor(random(50, 500)),
                category: category,
                priorityScore: initialScore,
                isUrged: false,
                customer: {
                    name: `顾客${Math.floor(random(1000, 9999))}`,
                    phone: `138${Math.floor(random(10000000, 99999999))}`,
                    address: addr.name
                },
                items: [item],
                timeline: [{
                    status: 'created',
                    description: '商家已接单，等待骑手接单',
                    timestamp: now.toISOString(),
                    location: STATION_LOCATION.name
                }],
                logistics: {
                    startLat: STATION_LOCATION.lat,
                    startLng: STATION_LOCATION.lng,
                    // 终点稍微抖动一下，模拟同小区不同楼
                    endLat: jitter(addr.lat),
                    endLng: jitter(addr.lng),
                    currentLat: STATION_LOCATION.lat,
                    currentLng: STATION_LOCATION.lng,
                    startNodeId: 'STATION_SLT',
                    actualRoute: []
                }
            };

            // 存入内存
            orders.push(newOrder);
            generatedCount++;
            
            // 推送给前端 (让地图实时更新)
            io.emit('new_order', newOrder);
            console.log(`+ 新增订单 ${newOrder.id} -> ${newOrder.customer.address} (当前总数: ${generatedCount})`);
        }

    }, 500); // 每 0.5 秒
};

export const stopOrderGenerator = () => {
    if (generatorInterval) {
        clearInterval(generatorInterval);
        generatorInterval = null;
    }
    isGenerating = false;
    console.log('🛑 停止订单生成器');
};
