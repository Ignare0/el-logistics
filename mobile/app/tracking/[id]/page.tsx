import { getOrderById } from '@/utils/api';
import MapContainer from '@/components/MapContainer';

interface PageProps {
    params: {
        id: string;
    };
}

// 这是一个服务端组件 (Server Component)
export default async function TrackingPage({ params }: PageProps) {
    // Await params (Next.js 15+ 必须要 await，如果是旧版可以直接用)
    const { id } = await params;

    // 1. 在服务端直接请求数据 (SSR)
    const order = await getOrderById(id);

    // 2. 处理 404
    if (!order) {
        return (
            <div className="p-10 text-center text-red-500">
                <h1>订单 {id} 不存在</h1>
            </div>
        );
    }

    // 3. 准备坐标数据 [lng, lat]
    // 注意：后端存的是 lat(纬度), lng(经度)，高德地图要 [经度, 纬度]
    const startPoint: [number, number] = [order.logistics.startLng, order.logistics.startLat];
    const endPoint: [number, number] = [order.logistics.endLng, order.logistics.endLat];

    return (
        <div className="relative w-full h-screen">
            {/* 顶部悬浮条 */}
            <div className="absolute top-0 left-0 z-10 w-full p-4 bg-white/90 backdrop-blur-sm shadow-sm">
                <h1 className="text-lg font-bold">订单追踪: {id}</h1>
                <p className="text-sm text-gray-500">状态: {order.status}</p>
            </div>

            {/* 地图组件 (客户端渲染) */}
            <MapContainer startPoint={startPoint} endPoint={endPoint} />
        </div>
    );
}