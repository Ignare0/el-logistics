// 定义层级归属关系：Child -> Parent
export const NETWORK_TOPOLOGY = {
    // --- 1. 商家/用户 -> 负责的网点 (Last Mile / First Mile) ---
    'WH_SH_QINGPU': 'STATION_SH_HUAXIN',         // 上海仓 -> 青浦网点
    'WH_GZ_BAIYUN': 'STATION_GZ_AIRPORT_NORTH',  // 广州仓 -> 机场北网点
    'WH_BJ_DASHING': 'HUB_BJ_DAXING',            // 北京仓 -> 大兴机场 (直连)
    'WH_SZ_BAOAN': 'HUB_SZ_BAOAN_AIR',           // 深圳仓 -> 宝安机场 (直连)

    'ADDR_GZ_TIANHE': 'STATION_GZ_CBD',          // 广州塔买家 -> 珠江新城网点
    'ADDR_WH_UNIV': 'STATION_WH_LUOJIA',         // 武大买家 -> 武大驿站
    'ADDR_CC_FAW': 'STATION_CC_HONGQI',          // 长春买家 -> 红旗街网点

    // --- 2. 网点 -> 转运中心 (City Distribution) ---
    'STATION_SH_HUAXIN': 'CENTER_SH_WEST',
    'STATION_GZ_AIRPORT_NORTH': 'CENTER_GZ_SUIYUN',
    'STATION_GZ_CBD': 'CENTER_GZ_SUIYUN',
    'STATION_WH_LUOJIA': 'CENTER_WH_DONGXIHU',
    'STATION_CC_HONGQI': 'CENTER_CC_KUANCHENG',

    // --- 3. 转运中心 -> 核心枢纽 (Regional Connection) ---
    'CENTER_SH_WEST': 'HUB_SH_HONGQIAO',
    'CENTER_GZ_SUIYUN': 'HUB_GZ_BAIYUN_AIR',
    'CENTER_WH_DONGXIHU': 'HUB_EZHOU_SF', // 武汉去鄂州机场
    'CENTER_CC_KUANCHENG': 'HUB_CC_LONGJIA'
};