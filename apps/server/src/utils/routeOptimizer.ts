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
 * Optimized Batch Routing Algorithm (Urgent First + Closed-Loop TSP)
 * 
 * Strategy:
 * 1. Filter & Split:
 *    - Tier 1: Urged Orders (Customer Urged) - HIGHEST PRIORITY
 *    - Tier 2: Urgent Orders (Score >= 80 or Express)
 *    - Tier 3: Normal Orders
 * 2. Sort Tier 1: Station -> Nearest Urged -> ...
 * 3. Sort Tier 2: Last Tier 1 -> Nearest Urgent -> ...
 * 4. Optimize Tier 3 (Cheapest Insertion):
 *    - Start: Last Tier 2 Location (or Last Tier 1, or Station).
 *    - End: Station (Fixed Return).
 *    - Goal: Minimize total distance traversing all normal orders and returning to station.
 * 5. Merge: [Tier 1] + [Tier 2] + [Optimized Tier 3].
 */
export const optimizeBatchRoute = (startNode: LogisticsNode, orders: ServerOrder[]): ServerOrder[] => {
    if (!orders || orders.length === 0) {
        return [];
    }

    // Step 1: Filter & Split
    const urgedOrders: ServerOrder[] = [];   // Tier 1
    const urgentOrders: ServerOrder[] = [];  // Tier 2
    const normalOrders: ServerOrder[] = [];  // Tier 3

    orders.forEach(order => {
        const score = (order as any).priorityScore || 0;
        const isUrged = (order as any).isUrged || false;
        const isExpress = order.serviceLevel === 'EXPRESS';

        if (isUrged) {
            urgedOrders.push(order);
        } else if (score >= 80 || isExpress) {
            urgentOrders.push(order);
        } else {
            normalOrders.push(order);
        }
    });

    const stationPoint: Point = { lat: startNode.location.lat, lng: startNode.location.lng };

    // Helper to sort a list of orders into a chain starting from a point
    const buildChain = (start: Point, list: ServerOrder[]): { sorted: ServerOrder[], lastPoint: Point } => {
        const sorted: ServerOrder[] = [];
        let current = start;
        const temp = [...list];

        while (temp.length > 0) {
            let nearestIdx = -1;
            let minD = Infinity;
            for (let i = 0; i < temp.length; i++) {
                const p = { lat: temp[i].logistics.endLat, lng: temp[i].logistics.endLng };
                const d = getDistance(current, p);
                if (d < minD) {
                    minD = d;
                    nearestIdx = i;
                }
            }
            if (nearestIdx !== -1) {
                const next = temp.splice(nearestIdx, 1)[0];
                sorted.push(next);
                current = { lat: next.logistics.endLat, lng: next.logistics.endLng };
            }
        }
        return { sorted, lastPoint: current };
    };

    // Step 2: Sort Tier 1 (Urged)
    const tier1 = buildChain(stationPoint, urgedOrders);

    // Step 3: Sort Tier 2 (Urgent) - Start from last point of Tier 1 (or Station)
    const tier2 = buildChain(tier1.lastPoint, urgentOrders);

    // Step 4: Optimize Tier 3 (Normal)
    // Start: Last Tier 2 Location (or Tier 1, or Station)
    // End: Station
    const startPoint = tier2.lastPoint;
    const endPoint = stationPoint;

    // Path represents the sequence of Normal Orders.
    // We simulate the path: Start -> [Path] -> End
    const path: ServerOrder[] = [];
    const remainingNormal = [...normalOrders];

    // Initialize path? No, start with empty path between Start and End.
    // Logic: Insert k into [Start, ...Path, End] such that cost increase is minimized.

    while (remainingNormal.length > 0) {
        let bestOrderIdx = -1;
        let bestInsertPos = -1; // 0 means after Start, path.length means before End
        let minCostIncrease = Infinity;

        for (let i = 0; i < remainingNormal.length; i++) {
            const candidate = remainingNormal[i];
            const pCandidate = { lat: candidate.logistics.endLat, lng: candidate.logistics.endLng };

            // Try inserting at every position j (0 to path.length)
            // Position j means: between element (j-1) and element (j)
            // if j=0: between Start and path[0] (or End if empty)
            // if j=len: between path[len-1] and End

            for (let j = 0; j <= path.length; j++) {
                // Determine Previous Point
                let prev: Point;
                if (j === 0) prev = startPoint;
                else prev = { lat: path[j-1].logistics.endLat, lng: path[j-1].logistics.endLng };

                // Determine Next Point
                let next: Point;
                if (j === path.length) next = endPoint;
                else next = { lat: path[j].logistics.endLat, lng: path[j].logistics.endLng };

                // Cost: Dist(Prev->Cand) + Dist(Cand->Next) - Dist(Prev->Next)
                const addedCost = getDistance(prev, pCandidate) + getDistance(pCandidate, next);
                const removedCost = getDistance(prev, next);
                const costIncrease = addedCost - removedCost;

                if (costIncrease < minCostIncrease) {
                    minCostIncrease = costIncrease;
                    bestOrderIdx = i;
                    bestInsertPos = j;
                }
            }
        }

        if (bestOrderIdx !== -1) {
            path.splice(bestInsertPos, 0, remainingNormal[bestOrderIdx]);
            remainingNormal.splice(bestOrderIdx, 1);
        } else {
            break; 
        }
    }

    // Step 5: Merge
    return [...tier1.sorted, ...tier2.sorted, ...path];
};

/**
 * Distribute Orders to Multiple Riders (K-means Clustering)
 * 
 * Strategy:
 * 1. Determine K (Number of clusters): min(availableRiders, ceil(orders.length / maxOrdersPerRider))
 * 2. K-means Clustering:
 *    - Initialize K centroids (randomly or intelligently).
 *    - Assign each order to the nearest centroid.
 *    - Recompute centroids.
 *    - Repeat until convergence or max iterations.
 * 3. Route Optimization per Cluster:
 *    - For each cluster, run optimizeBatchRoute().
 * 
 * @param startNode Station Node
 * @param orders All selected orders
 * @param availableRiders Number of available riders (default: 3)
 * @returns Array of order batches (one batch per rider)
 */
export const distributeOrders = (startNode: LogisticsNode, orders: ServerOrder[], availableRiders: number = 3): ServerOrder[][] => {
    if (!orders || orders.length === 0) return [];
    
    // 1. Determine K
    // Heuristic: Each rider handles roughly 3-5 orders efficiently.
    // If we have 10 orders and 5 riders -> K=5 (2 orders/rider) is better than K=2 (5 orders/rider) for speed.
    // But we are limited by availableRiders.
    // Let's maximize parallelism: use as many riders as possible, as long as each has at least 1 order.
    const k = Math.min(availableRiders, orders.length);
    
    if (k <= 1) {
        return [optimizeBatchRoute(startNode, orders)];
    }

    // 2. K-means Initialization
    // Pick K random orders as initial centroids
    let centroids: Point[] = [];
    const usedIndices = new Set<number>();
    
    // Improved Initialization: K-means++ style (pick first random, then furthest...)
    // For simplicity, just pick evenly spaced indices to spread them out
    for (let i = 0; i < k; i++) {
        const idx = Math.floor(i * orders.length / k);
        const o = orders[idx];
        centroids.push({ lat: o.logistics.endLat, lng: o.logistics.endLng });
    }

    let clusters: ServerOrder[][] = Array.from({ length: k }, () => []);
    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
        // Clear clusters
        clusters = Array.from({ length: k }, () => []);

        // Assignment Step
        orders.forEach(order => {
            const p = { lat: order.logistics.endLat, lng: order.logistics.endLng };
            let minD = Infinity;
            let bestCluster = 0;

            centroids.forEach((c, idx) => {
                const d = getDistance(p, c);
                if (d < minD) {
                    minD = d;
                    bestCluster = idx;
                }
            });
            clusters[bestCluster].push(order);
        });

        // Update Step
        let changed = false;
        const newCentroids: Point[] = [];

        clusters.forEach((cluster, idx) => {
            if (cluster.length === 0) {
                // Handle empty cluster: keep old centroid or re-initialize?
                // Keep old to maintain stability, or if old is lost, pick random point
                newCentroids.push(centroids[idx]);
                return;
            }

            let sumLat = 0, sumLng = 0;
            cluster.forEach(o => {
                sumLat += o.logistics.endLat;
                sumLng += o.logistics.endLng;
            });
            const newC = { lat: sumLat / cluster.length, lng: sumLng / cluster.length };
            
            // Check drift
            const drift = getDistance(centroids[idx], newC);
            if (drift > 0.01) changed = true; // 10 meters tolerance

            newCentroids.push(newC);
        });

        centroids = newCentroids;
        if (!changed) break;
        iterations++;
    }

    // Filter out empty clusters (if any)
    const validClusters = clusters.filter(c => c.length > 0);

    // 3. Optimize each cluster
    return validClusters.map(batch => optimizeBatchRoute(startNode, batch));
};
