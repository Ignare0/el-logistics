import { getOrderById } from '@/utils/api';
import MapWrapper from '@/components/MapWrapper';

interface PageProps {
    params: {
        id: string;
    };
}
export default async function TrackingPage({ params }: PageProps) {
    const { id } = await params;

    // 1. 服务端获取数据 (保持 SSR 优势)
    const order = await getOrderById(id);

    if (!order) {
        return (
            <div className="p-10 text-center text-red-500 mt-20">
                <h1 className="text-xl font-bold">订单不存在</h1>
                <p className="text-gray-500">单号: {id}</p>
            </div>
        );
    }

    // 2. 准备坐标
    const startPoint: [number, number] = [order.logistics.startLng, order.logistics.startLat];
    const endPoint: [number, number] = [order.logistics.endLng, order.logistics.endLat];

    return (
        <div className="relative w-full h-screen">
            {/* 顶部悬浮条 (服务端直接渲染) */}
            <div className="absolute top-0 left-0 z-10 w-full p-4 bg-white/90 backdrop-blur-sm shadow-sm border-b border-gray-200">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-lg font-bold text-gray-800">订单追踪</h1>
                        <p className="text-xs text-gray-500">单号: {id}</p>
                    </div>
                    <div className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-medium">
                        {order.status === 'shipping' ? '运输中' : order.status}
                    </div>
                </div>
            </div>

            {/* 地图区域 (由 MapWrapper 负责在客户端加载) */}
            <MapWrapper
                startPoint={startPoint}
                endPoint={endPoint}
                orderId={id}
            />
        </div>
    );
}
