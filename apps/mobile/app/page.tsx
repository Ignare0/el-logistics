import { getOrders } from '@/utils/api';
import HomeView from '@/components/HomeView';

// App Router 中，页面默认是服务端组件 (Server Component)
export default async function HomePage() {
  // 1. 在服务端直接获取数据
  const orders = await getOrders();

  // 2. 将数据作为 prop 传递给客户端组件
  // 这样，页面首次加载时就带有数据，无需在客户端再次请求
  return <HomeView initialOrders={orders} />;
}