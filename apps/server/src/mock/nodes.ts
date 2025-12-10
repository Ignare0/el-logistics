import { LogisticsNode } from '../domain/Node';

export const NODES: Record<string, LogisticsNode> = {
    // ==========================================
    // 商家配送站 (起点)
    // ==========================================
    'STATION_SLT': {
        id: 'STATION_SLT',
        name: '三里屯配送站',
        type: 'STATION',
        location: { lat: 39.9373, lng: 116.4551 },
        city: 'Beijing'
    },

    // ==========================================
    // 外卖柜节点 (自提点)
    // ==========================================
    'LOCKER_SOHO_T1': {
        id: 'LOCKER_SOHO_T1',
        name: '三里屯SOHO T1号楼外卖柜',
        type: 'LOCKER',
        location: { lat: 39.9360, lng: 116.4555 },
        city: 'Beijing'
    },
    'LOCKER_TAIKOO_N': {
        id: 'LOCKER_TAIKOO_N',
        name: '太古里北区智能取餐柜',
        type: 'LOCKER',
        location: { lat: 39.9395, lng: 116.4538 },
        city: 'Beijing'
    },
    'LOCKER_WORKERS_STADIUM': {
        id: 'LOCKER_WORKERS_STADIUM',
        name: '工体北门外卖柜',
        type: 'LOCKER',
        location: { lat: 39.9340, lng: 116.4480 },
        city: 'Beijing'
    },
    'LOCKER_UNITY_PARK': {
        id: 'LOCKER_UNITY_PARK',
        name: '团结湖公园南门柜',
        type: 'LOCKER',
        location: { lat: 39.9330, lng: 116.4635 },
        city: 'Beijing'
    },
    'LOCKER_CHAOYANG_PARK': {
        id: 'LOCKER_CHAOYANG_PARK',
        name: '朝阳公园西门柜',
        type: 'LOCKER',
        location: { lat: 39.9430, lng: 116.4760 },
        city: 'Beijing'
    },

    // ==========================================
    // 用户收货地址 (终点 - 仅作示例，实际由生成器生成)
    // ==========================================
    // 这些地址现在主要由 mock generator 动态生成，这里保留几个作为备用
    'ADDR_SLT_SOHO': {
        id: 'ADDR_SLT_SOHO',
        name: '三里屯SOHO',
        type: 'ADDRESS',
        location: { lat: 39.9373, lng: 116.4551 },
        city: 'Beijing'
    },
    'ADDR_TAIKOO_NORTH': {
        id: 'ADDR_TAIKOO_NORTH',
        name: '太古里北区',
        type: 'ADDRESS',
        location: { lat: 39.9390, lng: 116.4535 },
        city: 'Beijing'
    }
};
