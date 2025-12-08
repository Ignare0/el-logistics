import { ApiResponse } from '@el/types';

// 强制使用泛型 T，杜绝 any
export const success = <T>(data: T, msg: string = 'success'): ApiResponse<T> => {
    return {
        code: 200,
        data,
        msg
    };
};

export const error = (msg: string = 'error', code: number = 500): ApiResponse<null> => {
    return {
        code,
        data: null,
        msg
    };
};