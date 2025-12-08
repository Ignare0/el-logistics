// server/src/utils/simulator.ts

import { Server } from 'socket.io';
import { ServerOrder, OrderStatus } from '../types/internal';
import { PositionUpdatePayload } from '@el/types'; // 共享类型
import { getTransportMode, getStatusDescription, getSegmentConfig, TransportMode } from './transportMode';
import { fetchDrivingRoute, fetchRidingRoute } from './amapService';
import { LogisticsNode } from '../domain/Node';

// 存储全局定时器，防止冲突
const activeTimers = new Map<string, boolean>();

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

export const startSimulation = async (io: Server, order: ServerOrder) => {
    if (!order.logistics?.plannedRoute) {
        console.error('❌ 无法启动模拟：缺少 plannedRoute');
        return;
    }

    const { id } = order;
    const routeNodes = order.logistics.plannedRoute;

    // 防止重复启动
    if (activeTimers.get(id)) return;
    activeTimers.set(id, true);

    console.log(`🚀 订单 ${id} 开始全链路模拟，共 ${routeNodes.length} 个节点`);

    try {
        // --- 循环每一段路 (Node A -> Node B) ---
        for (let i = 0; i < routeNodes.length - 1; i++) {
            if (!activeTimers.get(id)) break;

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
        if (activeTimers.get(id)) {
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

            console.log(`🏁 订单 ${id} 模拟结束`);
            activeTimers.set(id, false);
        }

    } catch (e) {
        console.error(`❌ 模拟过程出错:`, e);
        activeTimers.set(id, false);
    }
};