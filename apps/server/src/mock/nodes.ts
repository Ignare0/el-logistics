import { LogisticsNode } from '../domain/Node'; // 假设你定义了接口

export const NODES: Record<string, LogisticsNode> = {
    // ==========================================
    // Level 0: 商家仓库 (起点) & 用户收货地 (终点)
    // ==========================================

    // 商家仓库
    'WH_SH_QINGPU': {
        id: 'WH_SH_QINGPU',
        name: '上海青浦智能云仓', // 很多快递总部都在青浦
        type: 'WAREHOUSE',
        location: { lat: 31.1524, lng: 121.1256 },
        city: 'Shanghai'
    },
    'WH_GZ_BAIYUN': {
        id: 'WH_GZ_BAIYUN',
        name: '广州白云保税仓',
        type: 'WAREHOUSE',
        location: { lat: 23.3211, lng: 113.3512 },
        city: 'Guangzhou'
    },
    'WH_BJ_DASHING': {
        id: 'WH_BJ_DASHING',
        name: '北京大兴智能仓',
        type: 'WAREHOUSE',
        location: { lat: 39.5427, lng: 116.3621 },
        city: 'Beijing'
    },
    'WH_SZ_BAOAN': {
        id: 'WH_SZ_BAOAN',
        name: '深圳宝安前海仓',
        type: 'WAREHOUSE',
        location: { lat: 22.5533, lng: 113.8831 },
        city: 'Shenzhen'
    },

    // 用户收货地址
    'ADDR_GZ_TIANHE': {
        id: 'ADDR_GZ_TIANHE',
        name: '广州天河区珠江新城IFC', // 市内件场景
        type: 'ADDRESS',
        location: { lat: 23.1202, lng: 113.3201 },
        city: 'Guangzhou'
    },
    'ADDR_WH_UNIV': {
        id: 'ADDR_WH_UNIV',
        name: '武汉大学珞珈山校区', // 跨省件场景
        type: 'ADDRESS',
        location: { lat: 30.5393, lng: 114.3638 },
        city: 'Wuhan'
    },
    'ADDR_CC_FAW': {
        id: 'ADDR_CC_FAW',
        name: '长春一汽家属院', // 远距离跨区域场景
        type: 'ADDRESS',
        location: { lat: 43.8567, lng: 125.2635 },
        city: 'Changchun'
    },

    // ==========================================
    // Level 1: 核心枢纽 (Hubs - 机场/一级转运)
    // ==========================================

    'HUB_SH_HONGQIAO': {
        id: 'HUB_SH_HONGQIAO',
        name: '上海虹桥航空枢纽',
        type: 'HUB',
        location: { lat: 31.1979, lng: 121.3364 },
        city: 'Shanghai'
    },
    'HUB_GZ_BAIYUN_AIR': {
        id: 'HUB_GZ_BAIYUN_AIR',
        name: '广州白云国际机场枢纽',
        type: 'HUB',
        location: { lat: 23.3924, lng: 113.2988 },
        city: 'Guangzhou'
    },
    'HUB_EZHOU_SF': {
        id: 'HUB_EZHOU_SF',
        name: '鄂州花湖国际机场', // 顺丰的核心心脏
        type: 'HUB',
        location: { lat: 30.3541, lng: 115.0566 },
        city: 'Ezhou' // 服务武汉及华中
    },
    'HUB_CC_LONGJIA': {
        id: 'HUB_CC_LONGJIA',
        name: '长春龙嘉国际机场枢纽',
        type: 'HUB',
        location: { lat: 43.9961, lng: 125.6883 },
        city: 'Changchun'
    },
    'HUB_BJ_DAXING': {
        id: 'HUB_BJ_DAXING',
        name: '北京大兴国际机场',
        type: 'HUB',
        location: { lat: 39.5097, lng: 116.4105 },
        city: 'Beijing'
    },
    'HUB_SZ_BAOAN_AIR': {
        id: 'HUB_SZ_BAOAN_AIR',
        name: '深圳宝安国际机场',
        type: 'HUB',
        location: { lat: 22.6367, lng: 113.8053 },
        city: 'Shenzhen'
    },

    // ==========================================
    // Level 2: 城市转运中心 (Centers - 陆运集散)
    // ==========================================

    'CENTER_SH_WEST': {
        id: 'CENTER_SH_WEST',
        name: '上海沪西分拨中心',
        type: 'CENTER',
        location: { lat: 31.1700, lng: 121.2500 },
        city: 'Shanghai'
    },
    'CENTER_GZ_SUIYUN': {
        id: 'CENTER_GZ_SUIYUN',
        name: '广州穗运分拨中心',
        type: 'CENTER',
        location: { lat: 23.2500, lng: 113.3000 },
        city: 'Guangzhou'
    },
    'CENTER_WH_DONGXIHU': {
        id: 'CENTER_WH_DONGXIHU',
        name: '武汉东西湖转运中心',
        type: 'CENTER',
        location: { lat: 30.6200, lng: 114.1500 },
        city: 'Wuhan'
    },
    'CENTER_CC_KUANCHENG': {
        id: 'CENTER_CC_KUANCHENG',
        name: '长春宽城分拨中心',
        type: 'CENTER',
        location: { lat: 43.9500, lng: 125.3500 },
        city: 'Changchun'
    },

    // ==========================================
    // Level 3: 末端网点 (Stations - 快递员归属)
    // ==========================================

    // 上海网点 (服务仓库)
    'STATION_SH_HUAXIN': {
        id: 'STATION_SH_HUAXIN',
        name: '上海青浦华新营业部', // 负责揽收 WH_SH_QINGPU
        type: 'STATION',
        location: { lat: 31.1600, lng: 121.1300 },
        city: 'Shanghai'
    },
    // 广州网点 (服务仓库)
    'STATION_GZ_AIRPORT_NORTH': {
        id: 'STATION_GZ_AIRPORT_NORTH',
        name: '广州机场北营业部', // 负责揽收 WH_GZ_BAIYUN
        type: 'STATION',
        location: { lat: 23.3300, lng: 113.3600 },
        city: 'Guangzhou'
    },
    // 广州网点 (服务买家)
    'STATION_GZ_CBD': {
        id: 'STATION_GZ_CBD',
        name: '广州珠江新城营业部', // 负责派送 ADDR_GZ_TIANHE
        type: 'STATION',
        location: { lat: 23.1250, lng: 113.3250 },
        city: 'Guangzhou'
    },
    // 武汉网点 (服务买家)
    'STATION_WH_LUOJIA': {
        id: 'STATION_WH_LUOJIA',
        name: '武汉大学菜鸟驿站', // 负责派送 ADDR_WH_UNIV
        type: 'STATION',
        location: { lat: 30.5420, lng: 114.3650 },
        city: 'Wuhan'
    },
    // 长春网点 (服务买家)
    'STATION_CC_HONGQI': {
        id: 'STATION_CC_HONGQI',
        name: '长春红旗街营业部', // 负责派送 ADDR_CC_FAW
        type: 'STATION',
        location: { lat: 43.8600, lng: 125.2700 },
        city: 'Changchun'
    }
};