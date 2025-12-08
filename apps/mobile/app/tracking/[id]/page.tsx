import { getOrderById } from '@/utils/api';
import TrackingView from '@/components/TrackingView'; // 引入新组件

interface PageProps {
    params: {
        id: string;
    };
}

export default async function TrackingPage({ params }: PageProps) {
    const { id } = await params;
    const order = await getOrderById(id);

    if (!order) {
        return <div className="p-10 text-center">订单不存在</div>;
    }

    // 将服务端获取的数据作为 initialOrder 传给客户端组件
    return <TrackingView initialOrder={order} />;
}