// apps/mobile/types/amap.d.ts

/**
 * 高德地图类型定义 (Strict Mode)
 */
declare namespace AMap {
    // 1. 通用事件对象
    export interface AMapEvent<T = any> {
        type: string;
        target: T;
        [key: string]: unknown;
    }

    // 2. 覆盖物联合类型 (用于 add/remove 等方法)
    export type Overlay = Marker | Polyline;

    // 3. 核心命名空间接口 (这就是 AMapLoader 加载回来的东西)
    // 使用 typeof ClassName 来获取构造函数本身的类型
    export interface AMapNamespace {
        Map: typeof Map;
        Marker: typeof Marker;
        Polyline: typeof Polyline;
        Icon: typeof Icon;
        Size: typeof Size;
        Pixel: typeof Pixel;
        LngLat: typeof LngLat;
    }

    // --- 以下是类定义 ---

    export class Map {
        constructor(container: string | HTMLElement, options?: MapOptions);
        destroy(): void;
        setZoomAndCenter(zoom: number, center: [number, number], immediate?: boolean, duration?: number): void;
        panTo(position: [number, number]): void;
        setFitView(overlays?: Overlay[]): void; // ✅ 替换 any
        add(overlay: Overlay | Overlay[]): void; // ✅ 替换 any
        on(event: string, callback: (e: AMapEvent<Map>) => void): void;
    }

    export interface MapOptions {
        viewMode?: '2D' | '3D';
        zoom?: number;
        center?: [number, number];
    }

    export class Marker {
        constructor(options?: MarkerOptions);
        setMap(map: Map | null): void;
        moveTo(position: [number, number], options: { duration: number; autoRotation: boolean }): void;
        getPosition(): LngLat;
        // ✅ 泛型指定事件 target 是 Marker 实例
        on(event: string, callback: (e: AMapEvent<Marker>) => void): void;
    }

    export interface MarkerOptions {
        map?: Map;
        position: [number, number];
        icon?: Icon;
        offset?: Pixel;
        zIndex?: number;
        clickable?: boolean;
        cursor?: string;
        bubble?: boolean;
        title?: string;
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

// 4. 全局 Window 扩展 (解决 window._AMapSecurityConfig 报错)
interface Window {
    _AMapSecurityConfig: {
        securityJsCode?: string;
    };
    AMap?: AMap.AMapNamespace; // 可选，某些场景可能会挂载在 window 上
}