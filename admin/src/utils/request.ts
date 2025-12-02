import axios, { AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';

const request = axios.create({
    baseURL: 'http://localhost:4000/api',
    timeout: 5000,
});

// 请求拦截器 (可选，加上比较规范)
request.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        return config;
    },
    (error: AxiosError) => {
        return Promise.reject(error);
    }
);

// 响应拦截器
request.interceptors.response.use(
    (response: AxiosResponse) => {
        return response.data;
    },
    (error: AxiosError) => {
        return Promise.reject(error);
    }
);

export default request;