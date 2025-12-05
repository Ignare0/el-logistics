import axios from 'axios';


const AMAP_KEY = '9ed0e07b10c4a6c7516db4f0b3f01d3f';

// 获取骑行路径 (用于末端派送)
export const fetchRidingRoute = async (
    startLat: number, startLng: number,
    endLat: number, endLng: number
): Promise<[number, number][]> => {
    const url = `https://restapi.amap.com/v4/direction/bicycling?origin=${startLng},${startLat}&destination=${endLng},${endLat}&key=${AMAP_KEY}`;

    try {
        const res = await axios.get(url);
        if (res.data.errcode === 0 && res.data.data.paths.length > 0) {
            const path = res.data.data.paths[0];
            const routePoints: [number, number][] = [];

            // 解析 steps
            path.steps.forEach((step: any) => {
                const polyline = step.polyline; // "116.4,39.9;116.5,39.9"
                const points = polyline.split(';').map((p: string) => {
                    const [lng, lat] = p.split(',');
                    return [parseFloat(lng), parseFloat(lat)];
                });
                routePoints.push(...points);
            });
            return routePoints;
        }
    } catch (e) {
        console.error('高德骑行API调用失败', e);
    }
    // 降级：如果骑行失败，回退到直线
    return [[startLng, startLat], [endLng, endLat]];
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
        return [];
    }
};