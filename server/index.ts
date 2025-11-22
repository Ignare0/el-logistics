// server/index.ts
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

// 1. 配置 CORS (允许前端跨域)
app.use(cors({
    origin: "*", // 生产环境要改成具体的域名
    methods: ["GET", "POST"]
}));

// 2. 初始化 Socket.io
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 3. 基础路由
app.get('/', (req, res) => {
    res.send('Logistics Backend is Running!');
});

// 4. 启动服务 (注意：我们用 4000 端口)
const PORT = 4000;
httpServer.listen(PORT, () => {
    console.log(`✅ 后端服务已启动: http://localhost:${PORT}`);
});