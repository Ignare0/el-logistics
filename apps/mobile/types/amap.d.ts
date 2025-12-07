// apps/mobile/types/amap.d.ts

/**
 * 高德地图类型定义 (Strict Mode) - 修正版
 */
declare namespace AMap {
    // 1. 通用事件对象
    export interface AMapEvent<T = any> {
        type: string;
        target: T;
        [key: string]: unknown;
    }

    // 2. 覆盖物联合类型
    export type Overlay = Marker | Polyline;

    // 3. 核心命名空间接口
    export interface AMapNamespace {
        Map: typeof Map;
        Marker: typeof Marker;
        Polyline: typeof Polyline;
        Icon: typeof Icon;
        Size: typeof Size;
        Pixel: typeof Pixel;
        LngLat: typeof LngLat;
    }

    // --- 类定义 ---

    export class Map {
        constructor(container: string | HTMLElement, options?: MapOptions);
        destroy(): void;
        setZoomAndCenter(zoom: number, center: [number, number], immediate?: boolean, duration?: number): void;
        panTo(position: [number, number]): void;

        // ✅ 修复 TS2554: 增加 setFitView 的完整参数定义
        // setFitView(overlays, immediately, avoid, maxZoom)
        setFitView(
            overlays?: Overlay[] | null,
            immediate?: boolean,
            avoid?: [number, number, number, number],
            maxZoom?: number
        ): void;

        add(overlay: Overlay | Overlay[]): void;
        setMapStyle(style: string): void; // 增加样式设置方法
        on(event: string, callback: (e: AMapEvent<Map>) => void): void;
    }

    export interface MapOptions {
        viewMode?: '2D' | '3D';
        zoom?: number;
        center?: [number, number];
        mapStyle?: string; // 支持初始化样式
    }

    export class Marker {
        constructor(options?: MarkerOptions);
        setMap(map: Map | null): void;
        moveTo(position: [number, number], options: { duration: number; autoRotation: boolean }): void;
        getPosition(): LngLat;
        on(event: string, callback: (e: AMapEvent<Marker>) => void): void;
    }

    export interface MarkerOptions {
        map?: Map;
        position: [number, number];
        icon?: Icon;
        // ✅ 修复 TS2353: 增加 content 属性，支持自定义 HTML 标记
        content?: string | HTMLElement;
        offset?: Pixel;
        zIndex?: number;
        clickable?: boolean;
        cursor?: string;
        bubble?: boolean;
        title?: string;
        anchor?: string; // 增加锚点定位
    }

    export class Polyline {
        constructor(options?: PolylineOptions);
        setMap(map: Map | null): void;
        setPath(path: [number, number][]): void;
    }

    export interface PolylineOptions {
        path?: [number, number][];
        strokeColor?: string;
        strokeOpacity?: number;
        strokeWeight?: number;
        strokeStyle?: 'solid' | 'dashed';
        strokeDasharray?: number[];
        geodesic?: boolean;
        isOutline?: boolean;
    }

    export class Icon {
        constructor(options: { size: Size; image: string; imageSize: Size });
    }

    export class Size {
        constructor(width: number, height: number);
    }

    export class Pixel {
        constructor(x: number, y: number);
    }

    export class LngLat {
        constructor(lng: number, lat: number);
        lng: number;
        lat: number;
    }
}

interface Window {
    _AMapSecurityConfig: {
        securityJsCode?: string;
    };
    AMap?: AMap.AMapNamespace;
}