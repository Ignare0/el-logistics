import {Server} from "socket.io";
import {Order} from "../types/order";
import {clearInterval} from "node:timers";
import { fetchDrivingRoute } from './amapService';

const activeTimers = new Map<string,NodeJS.Timeout>();
//计算2点之间的角度
const calculateAngle=(startLat: number,startLng:number,endLat:number,endLng:number)=>{
    const dy = endLat - startLat;
    const dx = endLng - startLng;
    let theta = Math.atan2(dy, dx);
    let degree= theta*(180/Math.PI);
    //Math.atan2 0度指向东，高德地图0度指向北边
    return (degree-90+360)%360;
};

export const startSimulation = async (io: Server, order: Order) => {
    if(!order.logistics) return;
    const {id} = order;
    const {startLat, startLng,endLat,endLng} = order.logistics;

    if(activeTimers.has(id)) {
        clearInterval(activeTimers.get(id));
        activeTimers.delete(id);
    }
    console.log(`⏳ 正在获取真实路径数据...`);

    // 1. 调用高德 API 获取真实轨迹点
    const routePoints = await fetchDrivingRoute(startLat, startLng, endLat, endLng);

    if (routePoints.length === 0) {
        console.error('❌ 无法获取路径，无法启动模拟');
        return;
    }

    console.log(`🚀 订单 ${id} 开始真实轨迹模拟 (共 ${routePoints.length} 个点)`);

    let currentIndex = 0;

    // 2. 策略：为了让演示快一点，我们设置步长
    // 如果点太多(>1000)，每次跳 5 个点走；否则每次走 1 个点
    const stepSize = routePoints.length > 1000 ? 5 : 1;
    // 推送频率：200ms 推一次 (让车动得更丝滑)
    const intervalTime = 200;

    const timer = setInterval(() => {
        // 取当前点
        const [lng, lat] = routePoints[currentIndex];

        // 计算角度 (取当前点和下一个点的角度，更精准)
        let angle = 0;
        if (currentIndex + stepSize < routePoints.length) {
            const [nextLng, nextLat] = routePoints[currentIndex + stepSize];
            // 注意：这里传参顺序要小心，我的函数定义是 (startLat, startLng...)
            angle = calculateAngle(lat, lng, nextLat, nextLng);
        }

        const payload = {
            orderId: id,
            lat: lat,
            lng: lng,
            angle: angle,
            status: 'shipping'
        };

        io.emit('position_update', payload);

        // 前进
        currentIndex += stepSize;

        // 到达终点
        if (currentIndex >= routePoints.length) {
            console.log(`✅ 订单 ${id} 已送达`);
            // 发送最后一条到达消息
            io.emit('position_update', { ...payload, status: 'delivered' });

            clearInterval(timer);
            activeTimers.delete(id);
        }

    }, intervalTime); // 200ms 刷新率

    activeTimers.set(id, timer);
};