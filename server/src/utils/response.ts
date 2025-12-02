export interface ApiResponse<T = any> {
    code: number;
    data: T;
    msg: string;
}

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