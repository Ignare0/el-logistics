// server/src/utils/simulator.ts

import { Server } from 'socket.io';
import { ServerOrder, OrderStatus } from '../types/internal';
import { PositionUpdatePayload } from '@el/types'; // 共享类型
import { getTransportMode, getStatusDescription, getSegmentConfig, TransportMode } from './transportMode';
import { fetchDrivingRoute, fetchRidingRoute } from './amapService';
import { LogisticsNode } from '../domain/Node';

// 存储全局定时器，防止冲突
const activeTimers = new Map<string, boolean>();

// 轻量内存事件日志（仅记录关键事件）
type EventLogEntry = { kind: 'position' | 'order'; status?: string; riderIndex?: number; orderId?: string; ts: string; text: string };
const EVENT_LOG_MAX = 1000;
const eventLog: EventLogEntry[] = [];
const recordEvent = (entry: EventLogEntry) => {
    eventLog.unshift(entry);
    if (eventLog.length > EVENT_LOG_MAX) eventLog.length = EVENT_LOG_MAX;
};
export const queryEvents = (limit: number = 50) => eventLog.slice(0, Math.max(0, Math.min(limit, EVENT_LOG_MAX)));

// ==========================================
// Rider Pool（站点骑手池，内存版）
// ==========================================

type RiderStatus = 'idle' | 'busy' | 'returning' | 'offline';
type Rider = { id: number; status: RiderStatus; activeOrderIds: string[] };

let STATION_MAX_RIDERS = Number(process.env.STATION_MAX_RIDERS || 5);
let RIDER_MAX_ORDERS = Number(process.env.RIDER_MAX_ORDERS || 2);

const riders: Rider[] = Array.from({ length: STATION_MAX_RIDERS }, (_, i) => ({ id: i, status: 'idle', activeOrderIds: [] }));

const setRiderBusy = (idx: number, orderIds: string[]) => {
    if (riders[idx]) { riders[idx].status = 'busy'; riders[idx].activeOrderIds = orderIds.slice(0, RIDER_MAX_ORDERS); }
};
const setRiderReturning = (idx: number) => { if (riders[idx]) { riders[idx].status = 'returning'; riders[idx].activeOrderIds = []; } };
const setRiderIdle = (idx: number) => { if (riders[idx]) { riders[idx].status = 'idle'; riders[idx].activeOrderIds = []; } };

export const getRiderPool = () => ({ maxRiders: STATION_MAX_RIDERS, perRiderMaxOrders: RIDER_MAX_ORDERS, riders: riders.map(r => ({ ...r })) });

const emitRiderStatus = (io: Server) => {
    try { io.emit('rider_status', getRiderPool()); } catch {}
};

// Rider Queues & Station mapping
// 全局等待队列（不预分配具体骑手，避免空闲骑手空等）
const globalQueue: ServerOrder[] = [];
const stationNodeForRider: Map<number, LogisticsNode> = new Map();

export const setRiderStation = (idx: number, node: LogisticsNode) => { stationNodeForRider.set(idx, node); };
export const enqueueGlobal = (items: ServerOrder[]) => { globalQueue.push(...items); };
export const dequeueGlobal = (count: number): ServerOrder[] => globalQueue.splice(0, Math.max(0, count));

const emitDebug = (io: Server, payload: any) => { try { io.emit('rider_debug', payload); } catch {} };

/**
 * 停止模拟
 */
export const stopSimulation = (orderId: string) => {
    if (activeTimers.has(orderId)) {
        console.log(`🛑 停止订单 ${orderId} 的模拟`);
        activeTimers.delete(orderId);
    }
};

// ==========================================
// 1. 辅助工具函数 (Helpers)
// ==========================================

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const calcDist = (n1: LogisticsNode, n2: LogisticsNode) => {
    const dx = n1.location.lng - n2.location.lng;
    const dy = n1.location.lat - n2.location.lat;
    return Math.sqrt(dx * dx + dy * dy) * 111;
};

// 计算空运直线插值
const calculateAirRoute = (start: LogisticsNode, end: LogisticsNode, steps: number = 50) => {
    const points: [number, number][] = [];
    const latStep = (end.location.lat - start.location.lat) / steps;
    const lngStep = (end.location.lng - start.location.lng) / steps;
    for (let i = 0; i <= steps; i++) {
        points.push([start.location.lng + lngStep * i, start.location.lat + latStep * i]);
    }
    return points;
};

// ==========================================
// 2. 核心逻辑解耦：路径获取与状态更新
// ==========================================

/**
 * 策略模式：根据运输方式获取路径点
 */
const getRoutePoints = async (mode: TransportMode, current: LogisticsNode, next: LogisticsNode) => {
    if (mode === 'DELIVERY') {
        console.log(`🛵 末端派送，调用骑行API...`);
        return await fetchRidingRoute(current.location.lat, current.location.lng, next.location.lat, next.location.lng);
    }
    if (mode === 'TRUNK') {
        return await fetchDrivingRoute(current.location.lat, current.location.lng, next.location.lat, next.location.lng);
    }
    // AIR 或默认情况
    return calculateAirRoute(current, next, 200);
};

/**
 * 状态同步：将推送的数据同步保存到内存对象中
 * @param order 内存中的订单对象引用
 * @param payload 发送给前端的数据包
 */
const updateOrderMemory = (order: ServerOrder, payload: PositionUpdatePayload) => {
    // 1. 始终更新当前位置 (用于刷新页面后的恢复)
    order.logistics.currentLat = payload.lat;
    order.logistics.currentLng = payload.lng;

    // 1.1 记录实际轨迹 (持久化路径)
    if (!order.logistics.actualRoute) {
        order.logistics.actualRoute = [];
    }
    // 防止重复点 (简单的去重)
    const lastPoint = order.logistics.actualRoute[order.logistics.actualRoute.length - 1];
    if (!lastPoint || lastPoint[0] !== payload.lng || lastPoint[1] !== payload.lat) {
        order.logistics.actualRoute.push([payload.lng, payload.lat]);
    }

    // 2. 如果是关键节点事件，记录到 Timeline
    // 注意：这里只记录 arrived_node, delivered, shipping(仅第一次) 等关键状态
    const isCriticalStatus = ['arrived_node', 'delivered', 'exception'].includes(payload.status);

    // 如果是 shipping，我们不希望每动一下都记录，只在刚开始运输时记录一次
    // 但为了简化逻辑，我们在 Controller 的 shipOrder 里已经记录了 'shipping' 开始
    // 所以这里主要记录 "到达节点" 和 "送达"

    if (isCriticalStatus) {
        const now = new Date().toISOString();
        const lastEvent = order.timeline[order.timeline.length - 1];

        // 防止重复插入完全相同的状态
        if (!lastEvent || lastEvent.status !== payload.status || lastEvent.description !== payload.statusText) {
            order.timeline.push({
                status: payload.status,
                description: payload.statusText,
                timestamp: now, // ✅ 修正：使用 timestamp
                location: `${payload.lng.toFixed(4)}, ${payload.lat.toFixed(4)}`
            });
        }
    }

    // 3. 如果已送达，更新主状态
    if (payload.status === 'delivered') {
        order.status = OrderStatus.DELIVERED;
    }
};

// ==========================================
// 3. 主流程控制 (Controller Logic)
// ==========================================

export const startSimulation = async (io: Server, order: ServerOrder, startIndex: number = 0) => {
    if (!order.logistics?.plannedRoute) {
        console.error('❌ 无法启动模拟：缺少 plannedRoute');
        return;
    }

    const { id } = order;
    const routeNodes = order.logistics.plannedRoute;

    // 防止重复启动
    if (activeTimers.get(id)) return;
    activeTimers.set(id, true);

    console.log(`🚀 订单 ${id} 开始全链路模拟，共 ${routeNodes.length} 个节点，从索引 ${startIndex} 开始`);

    try {
        // --- 循环每一段路 (Node A -> Node B) ---
        for (let i = startIndex; i < routeNodes.length - 1; i++) {
            if (!activeTimers.get(id) || order.status === OrderStatus.CANCELLED) break;

            const currentNode = routeNodes[i];
            const nextNode = routeNodes[i + 1];

            // --- 阶段 A: 到达节点 & 分拣 ---
            const arrivedPayload: PositionUpdatePayload = {
                orderId: id,
                lat: currentNode.location.lat,
                lng: currentNode.location.lng,
                status: 'arrived_node',
                statusText: `📦 已到达【${currentNode.name}】`
            };

            io.emit('position_update', arrivedPayload);
            updateOrderMemory(order, arrivedPayload); // ✅ 同步状态

            console.log(`... 在 ${currentNode.name} 分拣中`);
            await wait(2000); // 模拟分拣耗时

            // --- 新增: 检查是否需要用户选择配送方式 ---
            // 假设倒数第二个节点是配送站点，最后一个节点是用户地址
            // 当到达倒数第二个节点时，暂停并等待用户选择
            const isLastHub = i === routeNodes.length - 2;
            if (isLastHub && !order.deliveryMethod) {
                console.log(`🛑 到达配送站点【${currentNode.name}】，等待用户选择配送方式...`);
                
                order.waitingForSelection = true;
                const waitingPayload: PositionUpdatePayload = {
                    orderId: id,
                    lat: currentNode.location.lat,
                    lng: currentNode.location.lng,
                    status: 'waiting_for_selection',
                    statusText: `🛑 包裹已到达【${currentNode.name}】，请选择配送方式`
                };
                
                io.emit('position_update', waitingPayload);
                // 不需要写入 timeline，只是临时状态
                
                // 暂停循环，等待回调唤醒
                // 这里我们简单地退出循环，当用户调用 API 设置方式后，由 Controller 重新调用 startSimulation
                // 但需要注意：重新调用时应该从当前位置继续
                activeTimers.delete(id); 
                return;
            }

            // 如果已经选择了自提，并且当前就是自提柜（倒数第二个节点? 不，如果是自提，终点就是自提柜）
            // 修正逻辑：如果 deliveryMethod 是 LOCKER，且当前节点是 LOCKER 类型，则结束
            if (currentNode.type === 'LOCKER' && order.deliveryMethod === 'LOCKER') {
                 console.log(`🛑 用户选择自提，包裹存入【${currentNode.name}】`);
                 const pickupPayload: PositionUpdatePayload = {
                    orderId: id,
                    lat: currentNode.location.lat,
                    lng: currentNode.location.lng,
                    status: 'delivered',
                    statusText: `✅ 包裹已存入【${currentNode.name}】，请凭取件码取件`
                };
                io.emit('position_update', pickupPayload);
                updateOrderMemory(order, pickupPayload);
                activeTimers.delete(id);
                return;
            }
            
            // 如果选择了送货上门 (HOME)，或者还没到最后一段，继续走下面的运输逻辑


            // --- 阶段 B: 准备运输配置 ---
            const mode = getTransportMode(currentNode, nextNode);
            const distance = calcDist(currentNode, nextNode);
            const config = getSegmentConfig(mode, distance);
            const statusText = getStatusDescription(mode, currentNode.name, nextNode.name);

            console.log(`>>> 开始运输: ${currentNode.name} -> ${nextNode.name} (${mode})`);

            // --- 阶段 C: 获取路径并移动 ---
            const routePoints = await getRoutePoints(mode, currentNode, nextNode);

            // 逐点移动
            for (let j = 0; j < routePoints.length; j += config.stepSize) {
                if (!activeTimers.get(id)) break;

                const [lng, lat] = routePoints[j];
                const isFirstFrame = (j === 0);

                const shippingPayload: PositionUpdatePayload = {
                    orderId: id,
                    lat: lat,
                    lng: lng,
                    transport: mode,
                    status: 'shipping',
                    statusText: statusText,
                    zoom: config.zoom,
                    speed: config.speed,
                    resetView: isFirstFrame,
                    timestamp: new Date().toISOString()
                };

                io.emit('position_update', shippingPayload);
                updateOrderMemory(order, shippingPayload); // ✅ 只更新坐标，不写 Timeline

                await wait(config.speed);
            }
        }

        // --- 阶段 D: 最终送达 ---
        if (activeTimers.get(id) && order.status !== OrderStatus.CANCELLED) {
            const lastNode = routeNodes[routeNodes.length - 1];
            const deliveredPayload: PositionUpdatePayload = {
                orderId: id,
                lat: lastNode.location.lat,
                lng: lastNode.location.lng,
                status: 'delivered',
                statusText: `✅ 已送达，收货人：${order.customer.name}`
            };

            io.emit('position_update', deliveredPayload);
            updateOrderMemory(order, deliveredPayload); // ✅ 更新状态为 Delivered
            recordEvent({ kind: 'position', status: 'delivered', orderId: id, ts: new Date().toISOString(), text: `订单 ${id} 已送达` });

            // --- 阶段 E: 骑手返回站点 (仅限末端配送) ---
            // 如果是末端配送，且有起始站点（通常倒数第二个节点是站点）
            if (order.deliveryType === 'LAST_MILE' && routeNodes.length >= 2) {
                const stationNode = routeNodes[routeNodes.length - 2];
                console.log(`🏠 订单送达，骑手开始返回站点: ${stationNode.name}`);
                
                // 获取返回路径
                const returnRoutePoints = await getRoutePoints('DELIVERY', lastNode, stationNode);

                for (let j = 0; j < returnRoutePoints.length; j += 5) { // 稍微快一点返回
                    if (!activeTimers.get(id)) break;
                    
                    const [lng, lat] = returnRoutePoints[j];
                    
                    const returnPayload: PositionUpdatePayload = {
                        orderId: id,
                        lat, lng,
                        transport: 'DELIVERY',
                        status: 'returning', 
                        statusText: `已送达，骑手正在返回站点`,
                        speed: 100,
                        timestamp: new Date().toISOString()
                    };

                    io.emit('position_update', returnPayload);
                    order.logistics.currentLat = lat;
                    order.logistics.currentLng = lng;
                    order.isReturning = true;

                    await wait(100);
                }

                // 确保发送最后一个点
                if (returnRoutePoints.length > 0 && activeTimers.get(id)) {
                    const [lng, lat] = returnRoutePoints[returnRoutePoints.length - 1];
                    const returnPayload: PositionUpdatePayload = {
                        orderId: id,
                        lat, lng,
                        transport: 'DELIVERY',
                        status: 'returning',
                        statusText: `已送达，骑手正在返回站点`,
                        speed: 100,
                        timestamp: new Date().toISOString()
                    };
                    io.emit('position_update', returnPayload);
                    order.logistics.currentLat = lat;
                    order.logistics.currentLng = lng;
                    
                    // 停留短暂时间，让用户看到到站（减少停顿感）
                    await wait(200);
                }

                // 返回结束
                const idlePayload: PositionUpdatePayload = {
                    orderId: id,
                    lat: stationNode.location.lat,
                    lng: stationNode.location.lng,
                    status: 'rider_idle',
                    statusText: `骑手已回站`,
                    timestamp: new Date().toISOString()
                };
                io.emit('position_update', idlePayload);
                order.isReturning = false;

                console.log(`🏁 骑手已返回站点`);
            }

            console.log(`🏁 订单 ${id} 模拟结束`);
            activeTimers.delete(id);
        }

    } catch (e) {
        console.error(`❌ 模拟过程出错:`, e);
        activeTimers.delete(id);
    }
};

/**
 * 批量订单模拟 (同一骑手配送多单)
 */
export const startBatchSimulation = async (io: Server, orders: ServerOrder[], stationNode: LogisticsNode, riderIndex?: number) => {
    // 1. 简单的路径规划：Station -> Order 1 -> Order 2 ...
    // 这里不做复杂的 TSP，直接按数组顺序送
    const batchId = `BATCH_${Date.now()}`;
    console.log(`🚀 开启批量配送模拟，共 ${orders.length} 单`);

    // 标记所有订单为运输中（批量场景不依赖 activeTimers，中途取消直接跳出）
    orders.forEach(o => {
        activeTimers.set(o.id, true);
        if (o.status !== OrderStatus.SHIPPING) {
            o.status = OrderStatus.SHIPPING;
            o.timeline.push({ status: 'shipping', description: '调度中心已指派骑手，正在配送中', timestamp: new Date().toISOString() });
            try { io.emit('order_update', o); } catch {}
        }
        (o as any).queued = false;
        (o as any).queuedRiderIndex = undefined;
        (o as any).queuedSeq = undefined;
    });

    try {
        if (typeof riderIndex === 'number') {
            setRiderBusy(riderIndex, orders.map(o => o.id));
            emitRiderStatus(io);
            console.log(`🟢 骑手 ${riderIndex + 1} 接到订单: ${orders.map(o => o.id).join(', ')}`);
            emitDebug(io, { riderIndex, state: 'busy', orders: orders.map(o => o.id) });
        }
        // 在开始移动前，广播该骑手的新派送路线（彩线）供前端绘制
        try {
            const batchPoints = [
                { lat: stationNode.location.lat, lng: stationNode.location.lng, type: 'station', name: stationNode.name, riderIndex },
                ...orders.map((o, idx) => ({
                    lat: o.logistics.endLat,
                    lng: o.logistics.endLng,
                    type: (o as any).priorityScore >= 80 || (o as any).isUrged || o.serviceLevel === 'EXPRESS' ? 'urgent' : 'normal',
                    name: o.customer.address,
                    orderId: o.id,
                    sequence: idx + 1,
                    riderIndex
                })),
                { lat: stationNode.location.lat, lng: stationNode.location.lng, type: 'station', name: stationNode.name, riderIndex }
            ];
            io.emit('rider_route_planned', { riderIndex, route: batchPoints });
        } catch {}

        let currentNode = stationNode;
        if (typeof riderIndex === 'number') setRiderStation(riderIndex, stationNode);

        // 遍历每个订单作为目的地
        for (const order of orders) {
            // 0. 检查订单是否已取消 (尚未出发)
            if ((order.status as any) === 'cancelled') {
                console.log(`⚠️ 订单 ${order.id} 已取消，跳过配送`);
                activeTimers.delete(order.id);
                continue;
            }

            // 构建临时的 Target Node
            const targetNode: LogisticsNode = {
                id: `ADDR_${order.id}`,
                name: order.customer.address,
                type: 'ADDRESS',
                location: { lat: order.logistics.endLat, lng: order.logistics.endLng }
            };

            console.log(`>>> 骑手前往: ${targetNode.name}`);
            if (typeof riderIndex === 'number') emitDebug(io, { riderIndex, state: 'heading', targetOrderId: order.id });

            // 获取骑行路径
            // 注意：如果 currentNode 是临时位置（即上单半路取消），这里会规划从半路到新目的地的路径
            const routePoints = await getRoutePoints('DELIVERY', currentNode, targetNode);

            let isCancelledMidway = false;

            // 移动过程
            for (let j = 0; j < routePoints.length; j += 2) { // 步长2，稍微快点
                // 1. 检查订单是否已取消 (途中)
                if (order.status === OrderStatus.CANCELLED) {
                    console.log(`🛑 配送途中订单 ${order.id} 被取消，骑手停止前往`);
                    
                    // 更新当前节点为骑手当前位置，以便下一次循环从这里开始
                    const [currentLng, currentLat] = routePoints[j];
                    currentNode = {
                        id: `RIDER_LOC_${Date.now()}`,
                        name: '骑手临时位置',
                        type: 'ADDRESS',
                        location: { lat: currentLat, lng: currentLng }
                    };
                    
                    isCancelledMidway = true;
                    break; // 跳出移动循环
                }

                const [lng, lat] = routePoints[j];
                const now = new Date().toISOString();

                // **关键点**：骑手的位置要广播给**这批次的所有订单**
                // 这样用户查任意一个订单，都能看到骑手当前在哪
                const payload: PositionUpdatePayload = {
                    orderId: '', // 动态填充
                    lat, lng,
                    transport: 'DELIVERY',
                    status: 'shipping',
                    statusText: `骑手正在配送中，当前位置：${lng.toFixed(4)},${lat.toFixed(4)}`,
                    speed: 100,
                    timestamp: now
                };

                // 向所有关联订单推送位置更新
                orders.forEach(o => {
                    // 如果这个订单已经送达了、完成或取消了，就不再推移动位置
                    if (o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.COMPLETED && (o.status as any) !== 'cancelled') {
                        const p = { ...payload, orderId: o.id };
                        io.emit('position_update', p);
                        updateOrderMemory(o, p);
                    }
                });

                await wait(100); // 模拟移动速度
            }

            // 如果是中途取消，跳过送达逻辑，直接进入下一单
            if (isCancelledMidway) {
                activeTimers.delete(order.id);
                continue;
            }

            // 到达当前订单目的地
            const deliveredPayload: PositionUpdatePayload = {
                orderId: order.id,
                lat: targetNode.location.lat,
                lng: targetNode.location.lng,
                status: 'delivered',
                statusText: `✅ 您的订单已送达，请签收`
            };
            io.emit('position_update', deliveredPayload);
            updateOrderMemory(order, deliveredPayload);
            // 轻量事件日志：记录批量送达
            try {
                const nowTs = new Date().toISOString();
                recordEvent({ kind: 'position', status: 'delivered', orderId: order.id, ts: nowTs, text: `订单 ${order.id} 已送达` });
            } catch {}
            
            console.log(`✅ 订单 ${order.id} 已送达`);
            activeTimers.set(order.id, false);

            // 更新当前节点为刚送达的位置，继续送下一单
            currentNode = targetNode;
            
            // 模拟卸货/打电话
            await wait(1000);
        }

            // ==========================================
            // Step 4 (Part 2): Return to Station (Phase 4 Requirement)
            // ==========================================
            if (orders.length > 0) {
                console.log(`🏠 所有订单派送完毕，骑手返回站点: ${stationNode.name}`);
                if (typeof riderIndex === 'number') emitDebug(io, { riderIndex, state: 'returning' });
                
                const returnRoutePoints = await getRoutePoints('DELIVERY', currentNode, stationNode);

                for (let j = 0; j < returnRoutePoints.length; j += 2) {
                    const [lng, lat] = returnRoutePoints[j];
                    const now = new Date().toISOString();

                const payload: PositionUpdatePayload = {
                    orderId: '', // Returning, no specific order
                    lat, lng,
                    transport: 'DELIVERY',
                    status: 'returning',
                    statusText: `所有订单派送完毕，骑手正在返回站点`,
                    speed: 100,
                    timestamp: now,
                    riderIndex
                };

                    // Broadcast to all orders in this batch so users see the rider returning
                    orders.forEach(o => {
                         if (o.status !== OrderStatus.COMPLETED && (o.status as any) !== 'cancelled') { // 取消订单不再接收返程广播
                            const p = { ...payload, orderId: o.id };
                    io.emit('position_update', p);
                    recordEvent({ kind: 'position', status: 'returning', riderIndex, ts: now, text: `骑手 ${Number(riderIndex ?? 0) + 1} 正在返回站点` });
                }
                    });
                if (typeof riderIndex === 'number') { setRiderReturning(riderIndex); emitRiderStatus(io); }

                    await wait(100);
                }

                // 确保发送最后一个点
                if (returnRoutePoints.length > 0) {
                    const [lng, lat] = returnRoutePoints[returnRoutePoints.length - 1];
                    const now = new Date().toISOString();
                    const payload: PositionUpdatePayload = {
                        orderId: '',
                        lat, lng,
                        transport: 'DELIVERY',
                        status: 'returning',
                        statusText: `所有订单派送完毕，骑手正在返回站点`,
                        speed: 100,
                        timestamp: now,
                        riderIndex
                    };
                    orders.forEach(o => {
                        if (o.status !== OrderStatus.COMPLETED && (o.status as any) !== 'cancelled') {
                           const p = { ...payload, orderId: o.id };
                           io.emit('position_update', p);
                       }
                   });
                    recordEvent({ kind: 'position', status: 'returning', riderIndex, ts: now, text: `骑手 ${Number(riderIndex ?? 0) + 1} 正在返回站点` });
                   // 停留一会儿，让用户看到骑手到达站点
                   await wait(1000);
                }
                
                // 返回结束
                const idlePayload: PositionUpdatePayload = {
                    orderId: '',
                    lat: stationNode.location.lat,
                    lng: stationNode.location.lng,
                    status: 'rider_idle',
                    statusText: `骑手已回站`,
                    timestamp: new Date().toISOString(),
                    riderIndex
                };
                // 仅广播一次无订单ID的事件，防止重复触发
                io.emit('position_update', idlePayload);
                recordEvent({ kind: 'position', status: 'rider_idle', riderIndex, ts: idlePayload.timestamp!, text: `骑手 ${Number(riderIndex ?? 0) + 1} 已回站` });
                if (typeof riderIndex === 'number') { setRiderIdle(riderIndex); emitRiderStatus(io); console.log(`⚪ 骑手 ${riderIndex + 1} 已空闲`); emitDebug(io, { riderIndex, state: 'idle' }); }

                // 自动触发下一批（队列驱动）
                if (typeof riderIndex === 'number') {
                    const nextOrders = dequeueGlobal(RIDER_MAX_ORDERS);
                    if (nextOrders.length > 0) {
                        setRiderBusy(riderIndex, nextOrders.map(o => o.id));
                        emitRiderStatus(io);
                        const station = stationNodeForRider.get(riderIndex) || stationNode;
                        startBatchSimulation(io, nextOrders, station, riderIndex);
                    }
                }

                console.log(`🏁 骑手已安全返回站点`);
            }

            console.log(`🏁 批量配送任务结束`);

        } catch (e) {
        console.error('❌ 批量模拟出错:', e);
    }
};
export const updateRiderConfig = (io: Server, cfg: { maxRiders?: number; perRiderMaxOrders?: number }) => {
    const { maxRiders, perRiderMaxOrders } = cfg;
    if (typeof maxRiders === 'number' && maxRiders > 0) {
        STATION_MAX_RIDERS = maxRiders;
        if (riders.length < STATION_MAX_RIDERS) {
            const start = riders.length;
            for (let i = start; i < STATION_MAX_RIDERS; i++) riders.push({ id: i, status: 'idle', activeOrderIds: [] });
        } else if (riders.length > STATION_MAX_RIDERS) {
            riders.length = STATION_MAX_RIDERS;
        }
    }
    if (typeof perRiderMaxOrders === 'number' && perRiderMaxOrders > 0) RIDER_MAX_ORDERS = perRiderMaxOrders;
    emitRiderStatus(io);
    return getRiderPool();
};
