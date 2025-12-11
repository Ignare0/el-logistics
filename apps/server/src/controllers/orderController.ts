import { Request, Response } from 'express';
import { error, success } from '../utils/response';
import { OrderStatus, TimelineEvent } from '@el/types';
import { ServerOrder } from '../types/internal';
import { startSimulation, startBatchSimulation, stopSimulation, queryEvents, getRiderPool, enqueueGlobal, updateRiderConfig } from "../utils/simulator";
import { planLogisticsRoute } from '../services/logisticsService';
import { optimizeBatchRoute, distributeOrders } from '../utils/routeOptimizer';
import { NODES } from '../mock/nodes';
import { orders } from '../mock/orders';
import { LogisticsNode } from '../domain/Node';
import { fetchRidingRoute } from '../utils/amapService';

// ... (existing code)

// --- 5. [新增] 批量发货 (末端配送) ---
export const dispatchBatchOrders = (req: Request, res: Response) => {
    const { orderIds } = req.body;
    
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json(error('请选择要发货的订单'));
    }

    const io = req.app.get('socketio');
    const selectedOrders: ServerOrder[] = [];
    const notFoundIds: string[] = [];

    // 1. 查找并验证订单
    orderIds.forEach(id => {
        const order = orders.find(o => o.id === id);
        if (order) {
            // 只有 Pending 状态的才处理
            if (order.status === OrderStatus.PENDING) {
                // 简单的类型安全检查：确保 logistics 存在且有坐标
                if (order.logistics && typeof order.logistics.endLat === 'number' && typeof order.logistics.endLng === 'number') {
                    selectedOrders.push(order);
                } else {
                    console.warn(`⚠️ 订单 ${id} 数据不完整，跳过调度`);
                    notFoundIds.push(id);
                }
            }
        } else {
            notFoundIds.push(id);
        }
    });

    if (selectedOrders.length === 0) {
        return res.status(400).json(error('没有可调度的有效订单'));
    }

    // 2. 状态更新延后到具体派送任务启动时处理（仅对立即派送的订单设置为 SHIPPING）

    // 3. 启动批量模拟（容量约束）
    // 假设起点都是三里屯配送站 (Station Node)
    const stationNode: LogisticsNode = {
        id: 'STATION_SLT',
        name: '三里屯配送站',
        type: 'STATION',
        location: { lat: 39.9373, lng: 116.4551 }
    };

    // 3.1 智能调度：分配骑手与路径规划
    console.log('🔄 正在进行多骑手智能调度 (容量约束 + K-means + TSP)...');

    const pool = getRiderPool();
    const maxRiders = pool.maxRiders || 5;
    const perRiderMax = pool.perRiderMaxOrders || 2;
    const orderBatches = distributeOrders(stationNode, selectedOrders, maxRiders);

    console.log(`✅ 调度完成（初步分组），准备应用容量约束：x${maxRiders} 骑手，每骑手最多 ${perRiderMax} 单`);

    const allRoutePoints: any[] = [];
    const overflow: ServerOrder[] = [];

    // 遍历每个批次（每位骑手）
    orderBatches.forEach((batchOrders, riderIdx) => {
        if (riderIdx >= maxRiders) {
            overflow.push(...batchOrders);
            return;
        }
        console.log(`🛵 骑手 ${riderIdx + 1} 配送顺序:`);
        batchOrders.forEach((o, index) => {
            console.log(`   ${index + 1}. ${o.customer.address} (订单号: ${o.id})`);
        });

        // 应用每骑手最大订单数
        const immediate = batchOrders.slice(0, perRiderMax);
        const queued = batchOrders.slice(perRiderMax);
        if (queued.length > 0) overflow.push(...queued);

        // 构建该骑手的路径可视化数据（只针对立即派送的）
        const batchPoints = [
            { lat: stationNode.location.lat, lng: stationNode.location.lng, type: 'station', name: stationNode.name, riderIndex: riderIdx },
            ...immediate.map((o, idx) => ({
                lat: o.logistics.endLat,
                lng: o.logistics.endLng,
                type: (o as any).priorityScore >= 80 || (o as any).isUrged || o.serviceLevel === 'EXPRESS' ? 'urgent' : 'normal',
                name: o.customer.address,
                orderId: o.id,
                sequence: idx + 1,
                riderIndex: riderIdx // 标记属于哪个骑手
            })),
            { lat: stationNode.location.lat, lng: stationNode.location.lng, type: 'station', name: stationNode.name, riderIndex: riderIdx }
        ];
        allRoutePoints.push(batchPoints);

        // 异步启动该骑手的模拟任务（立即配送部分）
        if (immediate.length > 0) {
            startBatchSimulation(io, immediate, stationNode, riderIdx);
        }
    });

    // --- 推送可视化路径给前端 ---
    // 发送的是数组的数组，前端需要支持绘制多条线
    io.emit('batch_route_planned', { routePoints: allRoutePoints }); // 注意：这里改为了 routePoints 包含多条路径数组，或者我们扁平化发送？
    // 为了兼容性，我们可以改个名字或者让前端判断。
    // 既然我们控制前端，直接改结构最清晰。
    // Payload: { routes: [ [Points...], [Points...] ] }
    io.emit('multi_route_planned', { routes: allRoutePoints });

    // 溢出订单进入全局队列，等待任一骑手空闲后派送
    if (overflow.length > 0) {
        console.log(`📥 超出容量的订单进入队列：${overflow.length} 单`);
        overflow.forEach(o => {
            (o as any).queued = true;
            (o as any).queuedRiderIndex = undefined;
            (o as any).queuedSeq = undefined;
            o.timeline.push({ status: 'queued', description: `因运力排队，等待可用骑手`, timestamp: new Date().toISOString() });
            try { io.emit('order_update', o); } catch {}
        });
        enqueueGlobal(overflow);
        // 不再提前推送排队虚线路线
    }

    res.json(success({ 
        dispatchedCount: Math.min(selectedOrders.length, maxRiders * perRiderMax),
        queuedCount: Math.max(0, selectedOrders.length - (maxRiders * perRiderMax)),
        riderCount: Math.min(orderBatches.length, maxRiders),
        notFoundIds,
        routeSequence: allRoutePoints,
        capacity: { maxRiders, perRiderMax }
    }, `成功调度 ${selectedOrders.length} 个订单；立即派送 ${Math.min(selectedOrders.length, maxRiders * perRiderMax)} 单，排队 ${Math.max(0, selectedOrders.length - (maxRiders * perRiderMax))} 单`));
};

const sortOrderTimeline = (order: ServerOrder) => {
    order.timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return order;
};

const enrichOrderWithCities = (order: ServerOrder) => {
    if (order.logistics.startNodeId) {
        order.startCity = NODES[order.logistics.startNodeId]?.city;
        order.startNodeName = NODES[order.logistics.startNodeId]?.name;
    }
    if (order.logistics.endNodeId) {
        order.endCity = NODES[order.logistics.endNodeId]?.city;
        order.endNodeName = NODES[order.logistics.endNodeId]?.name;
    }
    return order;
};
// --- 1. 获取列表 ---
export const getOrders = (req: Request, res: Response) => {
    // 支持 merchantId、customerId、phone 过滤
    const { merchantId, customerId, phone } = req.query as { merchantId?: string; customerId?: string; phone?: string };

    let filteredOrders = orders;

    if (merchantId) {
        filteredOrders = filteredOrders.filter(o => o.merchantId === merchantId);
    }

    if (customerId) {
        filteredOrders = filteredOrders.filter(o => o.customerId === customerId);
    }

    if (phone) {
        filteredOrders = filteredOrders.filter(o => o.customer?.phone === phone);
    }

    const enrichedOrders = filteredOrders.map(enrichOrderWithCities).map(sortOrderTimeline);
    res.json(success(enrichedOrders));
};

// --- 2. 获取详情 ---
export const getOrderById = (req: Request, res: Response) => {
    const { id } = req.params;
    const { phone, customerId } = req.query as { phone?: string; customerId?: string };
    const order = orders.find(o => o.id === id);

    if (!order) {
        return res.status(404).json(error('订单不存在', 404));
    }

    // 数据隔离：如果携带 phone/customerId，则必须匹配，否则视为不存在
    if (phone && order.customer?.phone !== phone) {
        return res.status(404).json(error('订单不存在', 404));
    }
    if (customerId && order.customerId !== customerId) {
        return res.status(404).json(error('订单不存在', 404));
    }

    const sortedOrder = sortOrderTimeline(JSON.parse(JSON.stringify(order)));
    res.json(success(enrichOrderWithCities(sortedOrder)));
};

// --- 3. [新增] 创建订单 ---
export const createOrder = (req: Request, res: Response) => {
    const { customer, amount, startNodeId, endNodeId, merchantId, customerId, serviceLevel } = req.body;

    if (!customer || !startNodeId || !endNodeId) {
        return res.status(400).json(error('参数不完整'));
    }

    const startNode = NODES[startNodeId];
    const endNode = NODES[endNodeId];

    if (!startNode || !endNode) {
        return res.status(400).json(error('无效的节点 ID'));
    }

    const newId = `ORDER_${Date.now().toString().slice(-6)}`; // 简易 ID 生成

    const newOrder: ServerOrder = {
        id: newId,
        merchantId,
        customerId,
        serviceLevel: serviceLevel || 'STANDARD',
        customer,
        amount: Number(amount),
        createdAt: new Date().toISOString(),
        status: OrderStatus.PENDING,
        eta: '计算中...',
        timeline: [{
            status: 'created',
            description: '商家已接单，等待发货',
            timestamp: new Date().toISOString() // ✅ 修正为 timestamp
        }],
        logistics: {
            startNodeId,
            endNodeId,
            startLat: startNode.location.lat,
            startLng: startNode.location.lng,
            endLat: endNode.location.lat,
            endLng: endNode.location.lng,
            plannedRoute: []
        }
    };

    orders.unshift(newOrder); // 加到数组最前面
    res.json(success(newOrder, '订单创建成功'));
};

// --- 4. 发货 (启动模拟) ---
export const shipOrder = (req: Request, res: Response) => {
    const { id } = req.params;
    const order = orders.find(o => o.id === id);

    if (!order) return res.status(404).json(error('订单不存在'));

    // 只有 PENDING 状态才能发货
    if (order.status !== OrderStatus.PENDING) {
        return res.status(400).json(error(`订单状态为 ${order.status}，无法重复发货`));
    }

    // 1. 路径规划
    if (order.logistics.startNodeId && order.logistics.endNodeId) {
        try {
            const route = planLogisticsRoute(
                order.logistics.startNodeId,
                order.logistics.endNodeId,
                order.serviceLevel // 传递服务等级 (EXPRESS/STANDARD)
            );
            order.logistics.plannedRoute = route;
        } catch (e) {
            console.error(e);
            return res.status(500).json(error('路径规划失败'));
        }
    } else if (order.logistics.startLat && order.logistics.endLat) {
        // Fallback for Last Mile / Ad-hoc orders
        order.logistics.plannedRoute = [
            { id: 'START', location: { lat: order.logistics.startLat, lng: order.logistics.startLng }, name: '起点', type: 'STATION' },
            { id: 'END', location: { lat: order.logistics.endLat, lng: order.logistics.endLng }, name: order.customer.address, type: 'ADDRESS' }
        ];
    }

    // 2. 计算末端规划路径点
    try {
        const routeNodes = order.logistics.plannedRoute || [];
        const start = routeNodes.length >= 2 ? routeNodes[routeNodes.length - 2].location : { lat: order.logistics.startLat, lng: order.logistics.startLng };
        const end = routeNodes.length >= 1 ? routeNodes[routeNodes.length - 1].location : { lat: order.logistics.endLat, lng: order.logistics.endLng };
        fetchRidingRoute(start.lat, start.lng, end.lat, end.lng).then(points => {
            order.logistics.plannedRoutePoints = points;
        }).catch(() => {});
    } catch {}

    // 3. 更新状态
    order.status = OrderStatus.SHIPPING;
    order.timeline.push({
        status: 'shipping',
        description: '包裹已揽收，开始运输',
        timestamp: new Date().toISOString() // ✅ 修正为 timestamp
    });

    // 4. 启动 Socket 模拟
    const io = req.app.get('socketio');
    startSimulation(io, order);

    res.json(success(order, '发货成功'));
};

// --- 5. [新增] 确认收货 ---
export const confirmReceipt = (req: Request, res: Response) => {
    const { id } = req.params;
    const order = orders.find(o => o.id === id);

    if (!order) return res.status(404).json(error('订单不存在'));

    // 必须是 已送达 或 运输中(允许提前收货) 才能确认
    if (order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.SHIPPING) {
        return res.status(400).json(error('当前状态无法确认收货'));
    }

    order.status = OrderStatus.COMPLETED;
    order.timeline.push({
        status: 'completed',
        description: '客户已确认收货，感谢您的使用',
        timestamp: new Date().toISOString() // ✅ 修正为 timestamp
    });

    const io = req.app.get('socketio');
    if (io) {
        io.emit('order_updated', {
            orderId: id,
            status: OrderStatus.COMPLETED
        });
    }

    res.json(success(order, '确认收货成功'));
};

// --- 6. [新增] 设置配送方式 ---
export const setDeliveryMethod = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { method } = req.body; // 'HOME' | 'LOCKER'

    const order = orders.find(o => o.id === id);
    if (!order) return res.status(404).json(error('订单不存在'));

    if (!['HOME', 'LOCKER'].includes(method)) {
        return res.status(400).json(error('无效的配送方式'));
    }

    // 更新配送方式
    order.deliveryMethod = method;
    order.waitingForSelection = false;
    
    // 记录事件
    order.timeline.push({
        status: 'shipping', // 保持 shipping 状态或自定义
        description: method === 'HOME' ? '用户选择【送货上门】，准备派送' : '用户选择【自提】，包裹将存入自提柜',
        timestamp: new Date().toISOString()
    });

    // 重新唤醒模拟器
    const io = req.app.get('socketio');
    
    if (method === 'LOCKER') {
        // 1. 寻找最近的自提柜
        const lockers = Object.values(NODES).filter(n => n.type === 'LOCKER');
        let nearestLocker = lockers[0];
        let minDist = Infinity;
        
        const targetLat = order.logistics.endLat;
        const targetLng = order.logistics.endLng;
        
        lockers.forEach(locker => {
            const d = (locker.location.lat - targetLat) ** 2 + (locker.location.lng - targetLng) ** 2;
            if (d < minDist) {
                minDist = d;
                nearestLocker = locker;
            }
        });

        if (nearestLocker && order.logistics.plannedRoute && order.logistics.plannedRoute.length > 0) {
            // 2. 更新路径：起点 -> 自提柜
            const startNode = order.logistics.plannedRoute[0];
            order.logistics.plannedRoute = [startNode, nearestLocker];
            try {
                const points = await fetchRidingRoute(startNode.location.lat, startNode.location.lng, nearestLocker.location.lat, nearestLocker.location.lng);
                order.logistics.plannedRoutePoints = points;
            } catch {}
            
            // 3. 继续模拟 (从起点出发前往自提柜)
            if (io) {
                io.emit('order_updated', {
                    orderId: id,
                    deliveryMethod: method
                });
                
                // 从当前位置 (index 0) 继续
                startSimulation(io, order, 0);
            }
        } else {
             // Fallback: 如果找不到柜子，直接完成
             order.status = OrderStatus.DELIVERED;
             order.timeline.push({
                status: 'delivered',
                description: '包裹已存入站点，请凭取件码取件',
                timestamp: new Date().toISOString()
            });
             if (io) {
                io.emit('order_updated', { orderId: id, status: OrderStatus.DELIVERED });
             }
        }
        
    } else {
        // method === 'HOME'
        if (io) {
            io.emit('order_updated', {
                orderId: id,
                deliveryMethod: method
            });
            
            // ✅ 关键修复：送货上门模式，从站点位置 (倒数第二个节点) 继续模拟
            const route = order.logistics.plannedRoute!;
            // 确保索引不越界
            const resumeIndex = Math.max(0, route.length - 2);
            try {
                const startLoc = route[resumeIndex].location;
                const endLoc = route[resumeIndex + 1].location;
                const points = await fetchRidingRoute(startLoc.lat, startLoc.lng, endLoc.lat, endLoc.lng);
                order.logistics.plannedRoutePoints = points;
            } catch {}
            startSimulation(io, order, resumeIndex);
        }
    }

    res.json(success(order, '配送方式设置成功'));
};

// --- 7. [新增] 客户催单 ---
export const urgeOrder = (req: Request, res: Response) => {
    const { id } = req.params;
    const order = orders.find(o => o.id === id);

    if (!order) return res.status(404).json(error('订单不存在'));

    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.EXCEPTION) {
        return res.status(400).json(error('当前状态无法催单'));
    }

    if (order.isUrged) {
        return res.status(400).json(error('您已经催过单了，请耐心等待'));
    }

    // Update state
    order.isUrged = true;
    order.priorityScore = (order.priorityScore || 0) + 20; // Boost score
    
    // Add timeline
    order.timeline.push({
        status: 'urged',
        description: '客户发起催单，正在加急处理',
        timestamp: new Date().toISOString()
    });

    // Notify via Socket
    const io = req.app.get('socketio');
    if (io) {
        // Emit full order object so frontend can replace it
        io.emit('order_update', order); 
    }

    res.json(success(order, '催单成功，已优先处理'));
};

// --- 8. [新增] 取消订单 ---
export const cancelOrder = (req: Request, res: Response) => {
    const { id } = req.params;
    const order = orders.find(o => o.id === id);

    if (!order) return res.status(404).json(error('订单不存在'));

    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.DELIVERED) {
        return res.status(400).json(error('订单已送达或已完成，无法取消'));
    }

    if (order.status === OrderStatus.CANCELLED) {
        return res.status(400).json(error('订单已取消，请勿重复操作'));
    }

    const oldStatus = order.status;
    order.status = OrderStatus.CANCELLED;
    
    order.timeline.push({
        status: 'cancelled',
        description: '用户取消订单',
        timestamp: new Date().toISOString()
    });

    // Notify via Socket
    const io = req.app.get('socketio');
    if (io) {
        // Stop any ongoing simulation
        stopSimulation(id);

        io.emit('order_update', order);
        
        // If it was shipping, we might want to emit a specific event or let the simulator handle the status change
        if (oldStatus === OrderStatus.SHIPPING) {
            console.log(`🚫 订单 ${id} 在运输途中被取消`);
        }
    }

    res.json(success(order, '订单已取消'));
};
// --- 9. [新增] 查询事件日志（轻量内存版） ---
export const getEventLogs = (req: Request, res: Response) => {
    const limit = Number(req.query.limit || 50);
    const logs = queryEvents(limit);
    res.json(success(logs));
};

// --- 10. [新增] 获取骑手池状态 ---
export const getRiders = (req: Request, res: Response) => {
    try {
        const pool = getRiderPool();
        res.json(success(pool));
    } catch (e) {
        res.status(500).json(error('获取骑手池失败'));
    }
};

// --- 11. [新增] 更新骑手池配置 ---
export const postRiderConfig = (req: Request, res: Response) => {
    try {
        const io = req.app.get('socketio');
        const { maxRiders, perRiderMaxOrders } = req.body as { maxRiders?: number; perRiderMaxOrders?: number };
        const pool = updateRiderConfig(io, { maxRiders, perRiderMaxOrders });
        res.json(success(pool, '配置已更新'));
    } catch (e) {
        res.status(500).json(error('更新配置失败'));
    }
};
