import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from 'antd'; // 引入全局提示，统一处理错误

// 从环境变量读取，如果没配则回退到 localhost
const BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api');

const request: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: 10000, // 稍微改长一点，防止模拟器响应慢超时
});

request.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // 这里预留给未来加 Token
        // const token = localStorage.getItem('token');
        // if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    (error: AxiosError) => Promise.reject(error)
);

request.interceptors.response.use(
    (response: AxiosResponse) => {
        // 直接剥离一层，返回 response.data
        // 这里其实有一个潜在风险：AxiosResponse 的 data 类型是 T
        // 我们通过拦截器改变了返回值，所以调用方不需要再 .data 了
        return response.data;
    },
    (error: AxiosError) => {
        // 统一错误处理
        if (error.response) {
            // 服务器返回了错误状态码 (4xx, 5xx)
            console.error('Request Error:', error.response.data);
            message.error(`请求失败: ${error.response.status}`);
        } else {
            // 网络错误
            message.error('网络连接异常，请检查后端服务');
        }
        return Promise.reject(error);
    }
);

export default request;
