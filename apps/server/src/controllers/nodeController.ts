import { Request, Response } from 'express';
import { NODES } from '../mock/nodes';
import { success } from '../utils/response';

// 这个控制器专门用于提供节点相关的数据
export const getSelectableNodes = (req: Request, res: Response) => {
    const warehouses = Object.values(NODES).filter(node => node.type === 'WAREHOUSE');
    const addresses = Object.values(NODES).filter(node => node.type === 'ADDRESS');

    res.json(success({
        warehouses, // 所有可选的发货仓库
        addresses,  // 所有可选的收货地址
    }));
};