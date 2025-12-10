import { ServerOrder } from '../types/internal';
import { LogisticsNode } from '../domain/Node';

interface Point {
    lat: number;
    lng: number;
}

// Haversine distance formula to calculate distance between two points in km
function getDistance(p1: Point, p2: Point): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(p2.lat - p1.lat);
    const dLng = deg2rad(p2.lng - p1.lng);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(p1.lat)) * Math.cos(deg2rad(p2.lat)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}

/**
 * Optimized Batch Routing Algorithm (Urgent First + TSP)
 * 
 * Strategy (User Defined):
 * 1. Filter & Split: Separate Urgent (Score >= 80 or Urged) from Normal orders.
 * 2. Sort Urgent: Sort by distance from Station (Start -> Urgent1 -> Urgent2).
 *    - Logic: Prioritize delivering urgent orders first, ordered by proximity to station.
 * 3. Optimize Normal: TSP (Nearest Neighbor) starting from the LAST Urgent order's location.
 *    - Virtual Start: LastUrgentPoint (or Station if none).
 * 4. Merge: Combine sorted Urgent + optimized Normal.
 * 
 * @param startNode Starting point (usually the Station)
 * @param orders List of orders to visit
 * @returns Ordered list of orders representing the optimized route
 */
export const optimizeBatchRoute = (startNode: LogisticsNode, orders: ServerOrder[]): ServerOrder[] => {
    if (!orders || orders.length === 0) {
        return [];
    }

    // Step 1: Filter & Split
    const urgentOrders: ServerOrder[] = [];
    const normalOrders: ServerOrder[] = [];

    orders.forEach(order => {
        // Check for urgent criteria: High priority score or explicitly urged
        // Using 'any' cast temporarily if types aren't fully updated in all contexts, 
        // but ServerOrder should have these from Phase 3.
        const score = (order as any).priorityScore || 0;
        const isUrged = (order as any).isUrged || false;

        if (score >= 80 || isUrged) {
            urgentOrders.push(order);
        } else {
            normalOrders.push(order);
        }
    });

    const stationPoint: Point = { lat: startNode.location.lat, lng: startNode.location.lng };

    // Step 2: Sort Urgent Orders (Distance from Station)
    // Strategy: Station -> Nearest Urgent -> Next Nearest Urgent ...
    // Note: This is a simple sort by distance from station.
    urgentOrders.sort((a, b) => {
        const pA = { lat: a.logistics.endLat, lng: a.logistics.endLng };
        const pB = { lat: b.logistics.endLat, lng: b.logistics.endLng };
        const distA = getDistance(stationPoint, pA);
        const distB = getDistance(stationPoint, pB);
        return distA - distB;
    });

    // Step 3: Optimize Normal Orders (TSP - Nearest Neighbor)
    // The starting point for the normal batch is the location of the LAST urgent order.
    let currentPoint: Point = stationPoint;
    
    if (urgentOrders.length > 0) {
        const lastUrgent = urgentOrders[urgentOrders.length - 1];
        currentPoint = { lat: lastUrgent.logistics.endLat, lng: lastUrgent.logistics.endLng };
    }

    const sortedNormalOrders: ServerOrder[] = [];
    const remainingNormal = [...normalOrders];

    while (remainingNormal.length > 0) {
        let nearestIndex = -1;
        let minDistance = Infinity;

        // Find the nearest unvisited normal order relative to currentPoint
        for (let i = 0; i < remainingNormal.length; i++) {
            const order = remainingNormal[i];
            const orderPoint = { lat: order.logistics.endLat, lng: order.logistics.endLng };
            const dist = getDistance(currentPoint, orderPoint);

            if (dist < minDistance) {
                minDistance = dist;
                nearestIndex = i;
            }
        }

        if (nearestIndex !== -1) {
            // Move to the nearest order
            const nearestOrder = remainingNormal.splice(nearestIndex, 1)[0];
            sortedNormalOrders.push(nearestOrder);
            
            // Update current point to this order's location
            currentPoint = { lat: nearestOrder.logistics.endLat, lng: nearestOrder.logistics.endLng };
        } else {
            break;
        }
    }

    // Step 4: Merge
    // Return: [Urgent1, Urgent2, ..., Normal1, Normal2, ...]
    return [...urgentOrders, ...sortedNormalOrders];
};
