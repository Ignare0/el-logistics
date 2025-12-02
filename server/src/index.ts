// server/index.ts
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import orderRoutes from "./routes/orderRoutes";

const app = express();
const httpServer = createServer(app);

// 配置 CORS (允许前端跨域)
app.use(cors({
    origin: "*", // 生产环境要改成具体的域名
    methods: ["GET", "POST"]
}));
app.use(express.json());

//注册路由
app.use('/api/orders', orderRoutes);
//初始化 Socket.io
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
//测试前端是否连接成功
io.on('connection', (socket) => {
    console.log("有一位客户端连接了 Socket:",socket.id);
    socket.on('disconnect', () => {
        console.log("客户端断开了:", socket.id);
    })
})
// 3. 基础路由
app.get('/', (req, res) => {
    res.send('Logistics Backend is Running!');
});

// 4. 启动服务 (注意：我们用 4000 端口)
const PORT = 4000;
httpServer.listen(PORT, () => {
    console.log(`✅ 后端服务已启动: http://localhost:${PORT}`);
});