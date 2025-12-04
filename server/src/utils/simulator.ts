// server/src/utils/simulator.ts

import { Server } from 'socket.io';
import { Order } from '../types/order';
import { LogisticsNode } from '../domain/Node';
import { getTransportMode, getStatusDescription } from './transportMode';
import { fetchDrivingRoute } from './amapService';

// 存储全局定时器，防止冲突
const activeTimers = new Map<string, boolean>(); // key: orderId, value: isRunning

// 辅助函数：计算两点间的直线路径点 (用于空运模拟)
const calculateAirRoute = (start: LogisticsNode, end: LogisticsNode, steps: number = 50) => {
    const points: [number, number][] = [];
    const latStep = (end.location.lat - start.location.lat) / steps;
    const lngStep = (end.location.lng - start.location.lng) / steps;

    for (let i = 0; i <= steps; i++) {
        points.push([
            start.location.lng + lngStep * i,
            start.location.lat + latStep * i
        ]);
    }
    return points;
};

// 辅助函数：异步等待 (模拟分拣耗时)
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const startSimulation = async (io: Server, order: Order) => {
    if (!order.logistics || !order.logistics.plannedRoute) {
        console.error('❌ 无法启动模拟：缺少 plannedRoute 路由信息');
        return;
    }

    const { id } = order;
    const routeNodes = order.logistics.plannedRoute;

    // 防止重复启动
    if (activeTimers.get(id)) return;
    activeTimers.set(id, true);

    console.log(`🚀 订单 ${id} 开始全链路模拟，共 ${routeNodes.length} 个节点`);

    // --- 核心循环：一段一段地跑 ---
    // i 是当前节点，i+1 是下一个节点
    for (let i = 0; i < routeNodes.length - 1; i++) {
        // 如果被外部强行停止，则中断
        if (!activeTimers.get(id)) break;

        const currentNode = routeNodes[i];
        const nextNode = routeNodes[i + 1];

        // 1. 状态：到达当前节点，进行分拣/操作
        io.emit('position_update', {
            orderId: id,
            lat: currentNode.location.lat,
            lng: currentNode.location.lng,
            status: 'arrived_node',
            statusText: `📦 已到达【${currentNode.name}】，正在分拣/操作中...`
        });

        // 模拟分拣耗时 (为了演示，设为 2秒)
        console.log(`... 在 ${currentNode.name} 分拣中`);
        await wait(2000);

        // 2. 决策：怎么去下一个节点？
        const mode = getTransportMode(currentNode, nextNode);
        const statusText = getStatusDescription(mode, currentNode.name, nextNode.name);

        console.log(`>>> 开始运输: ${currentNode.name} -> ${nextNode.name} (${mode})`);

        // 3. 获取路径点 (GPS Points)
        let routePoints: [number, number][] = [];

        if (mode === 'ROAD') {
            // 陆运：调用高德 API 获取真实弯道路径
            // 注意：amapService 返回的是 [lng, lat] 数组
            routePoints = await fetchDrivingRoute(
                currentNode.location.lat, currentNode.location.lng,
                nextNode.location.lat, nextNode.location.lng
            );
        } else {
            // 空运：计算直线插值
            routePoints = calculateAirRoute(currentNode, nextNode);
        }

        // 4. 开始移动 (逐点推送)
        // 陆运慢一点(100ms/点)，空运快一点(50ms/点)
        const speed = mode === 'ROAD' ? 100 : 50;

        // 采样率：如果点太多，跳着走，防止演示太慢
        const stepSize = routePoints.length > 500 ? 5 : 1;

        for (let j = 0; j < routePoints.length; j += stepSize) {
            if (!activeTimers.get(id)) break;

            const [lng, lat] = routePoints[j];

            // 计算简单的车头角度 (可选)
            let angle = 0;
            if (j + stepSize < routePoints.length) {
                const [nextLng, nextLat] = routePoints[j + stepSize];
                angle = Math.atan2(nextLat - lat, nextLng - lng) * 180 / Math.PI;
            }

            io.emit('position_update', {
                orderId: id,
                lat: lat,
                lng: lng,
                angle: angle,
                transport: mode, // 告诉前端是飞机还是车
                status: 'shipping',
                statusText: statusText
            });

            await wait(speed);
        }
    }

    // 循环结束，到达最终终点
    if (activeTimers.get(id)) {
        const lastNode = routeNodes[routeNodes.length - 1];
        io.emit('position_update', {
            orderId: id,
            lat: lastNode.location.lat,
            lng: lastNode.location.lng,
            status: 'delivered',
            statusText: `✅ 已送达，收货人：${order.customer.name}`
        });
        console.log(`🏁 订单 ${id} 模拟结束`);
        activeTimers.set(id, false);
    }
};