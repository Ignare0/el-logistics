import axios, { isAxiosError } from 'axios';


const AMAP_KEY = process.env.AMAP_KEY;

// 获取骑行路径 (用于末端派送)
export const fetchRidingRoute = async (
    startLat: number, startLng: number,
    endLat: number, endLng: number
): Promise<[number, number][]> => {
    const url = `https://restapi.amap.com/v4/direction/bicycling?origin=${startLng},${startLat}&destination=${endLng},${endLat}&key=${AMAP_KEY}`;

    try {
        const res = await axios.get(url);
        // ✅ 增加对高德返回的 data.errcode 的判断
        if (res.data && res.data.errcode === 0 && res.data.data?.paths?.length > 0) {
            const path = res.data.data.paths[0];
            const routePoints: [number, number][] = [];

            path.steps.forEach((step: any) => {
                const polyline = step.polyline;
                const points = polyline.split(';').map((p: string) => {
                    const [lng, lat] = p.split(',');
                    return [parseFloat(lng), parseFloat(lat)];
                });
                routePoints.push(...points);
            });
            return routePoints;
        } else {
            // ✅ 如果高德返回了成功状态码，但没有路径数据，也视为一种失败
            console.warn(`高德骑行API未返回有效路径，原因: ${res.data.errtext || '未知'}. URL: ${url}`);
        }
    } catch (e) {
        // ✅ 优化错误处理逻辑
        if (isAxiosError(e)) {
            // 如果是 Axios 错误，我们可以打印更具体的状态码
            console.warn(`高德骑行API调用失败，状态码: ${e.response?.status || 'N/A'}。URL: ${url}`);
        } else {
            // 其他未知错误
            console.error('高德骑行API调用时发生未知错误', e);
        }
    }

    // 降级：如果骑行失败，使用模拟的城市道路路径 (直角拐弯)
    console.log('🛵 骑行路径获取失败，降级为模拟城市路径。');
    return generateManhattanRoute(startLat, startLng, endLat, endLng);
};

// 辅助函数：生成曼哈顿路径 (模拟城市街道的直角拐弯)
const generateManhattanRoute = (lat1: number, lng1: number, lat2: number, lng2: number): [number, number][] => {
    const points: [number, number][] = [];
    points.push([lng1, lat1]); // 起点

    // 简单的 L 型路径：先走经度，再走纬度 (或者随机决定先走哪个)
    // 为了更逼真，我们随机选一个中间拐点
    // 方案：起点 -> (lng2, lat1) -> 终点
    // 或者：起点 -> (lng1, lat2) -> 终点
    
    // 随机决定先横着走还是先竖着走
    if (Math.random() > 0.5) {
        points.push([lng2, lat1]); // 拐点1: 同纬度，目标经度
    } else {
        points.push([lng1, lat2]); // 拐点2: 同经度，目标纬度
    }

    points.push([lng2, lat2]); // 终点
    
    // 插值：为了让小车移动平滑，我们需要在长直线上多插几个点
    return interpolatePoints(points);
};

// 简单的线性插值，让路径点更密集
const interpolatePoints = (keyPoints: [number, number][]): [number, number][] => {
    const result: [number, number][] = [];
    for (let i = 0; i < keyPoints.length - 1; i++) {
        const p1 = keyPoints[i];
        const p2 = keyPoints[i + 1];
        result.push(p1);

        // 计算距离
        const dist = Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
        // 如果距离太长，插值 (每 0.001 经纬度插一个点，约100米)
        const steps = Math.ceil(dist / 0.001);
        
        if (steps > 1) {
            const dLng = (p2[0] - p1[0]) / steps;
            const dLat = (p2[1] - p1[1]) / steps;
            for (let j = 1; j < steps; j++) {
                result.push([p1[0] + dLng * j, p1[1] + dLat * j]);
            }
        }
    }
    result.push(keyPoints[keyPoints.length - 1]);
    return result;
};

export const fetchDrivingRoute = async (
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number
): Promise<Array<[number, number]>> => {

    // 高德 Web服务 API 地址 (路径规划 - 驾车)
    const url = `https://restapi.amap.com/v3/direction/driving`;

    try {
        console.log('🗺️ 正在请求高德路径规划 API...');

        const response = await axios.get(url, {
            params: {
                key: AMAP_KEY,
                origin: `${startLng},${startLat}`, // 高德要求经度在前
                destination: `${endLng},${endLat}`,
                extensions: 'base', // 不需要详细路况，base 够用了
                strategy: 0, // 0: 速度优先
            }
        });

        const data = response.data;

        if (data.status !== '1') {
            throw new Error(`高德 API 错误: ${data.info}`);

        }

        if (!data.route || !data.route.paths || data.route.paths.length === 0) {
            throw new Error('未找到路径');

        }

        // --- 核心逻辑：解析 Polyline ---
        // 高德返回的数据结构很深：route -> paths[0] -> steps -> polyline
        // polyline 是一串字符串："116.4,39.9;116.5,39.9..."
        const steps = data.route.paths[0].steps;
        const fullPath: Array<[number, number]> = [];

        steps.forEach((step: any) => {
            const polyline = step.polyline; // "116.481,39.990;116.481,39.989"
            const points = polyline.split(';');

            points.forEach((pointStr: string) => {
                const [lng, lat] = pointStr.split(',');
                if (lng && lat) {
                    // 转成数字存进去
                    fullPath.push([parseFloat(lng), parseFloat(lat)]);
                }
            });
        });

        console.log(`🗺️ 路径规划成功！全程包含 ${fullPath.length} 个坐标点`);
        return fullPath;

    } catch (error) {
        console.error('获取路线失败:', error);
        // 降级：如果驾车规划失败，也使用模拟的城市道路路径
        console.log('🚗 驾车路径获取失败，降级为模拟城市路径。');
        return generateManhattanRoute(startLat, startLng, endLat, endLng);
    }
};