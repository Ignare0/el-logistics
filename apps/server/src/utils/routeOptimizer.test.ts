
import { optimizeBatchRoute } from './routeOptimizer';
import { ServerOrder } from '../types/internal';
import { LogisticsNode } from '../domain/Node';

// Mock helper
const createOrder = (id: string, lat: number, lng: number, score: number = 0, isUrged: boolean = false): ServerOrder => {
    return {
        id,
        priorityScore: score,
        isUrged,
        logistics: {
            endLat: lat,
            endLng: lng
        }
    } as any; // Cast to any to skip other fields
};

const station: LogisticsNode = {
    id: 'STATION',
    name: 'Station',
    type: 'STATION',
    location: { lat: 0, lng: 0 }
};

describe('Route Optimizer (Phase 4)', () => {

    it('should put urgent orders first', () => {
        const o1 = createOrder('normal1', 10, 10, 50);
        const o2 = createOrder('urgent1', 5, 5, 90); // Urgent by score
        const o3 = createOrder('normal2', 12, 12, 60);

        const result = optimizeBatchRoute(station, [o1, o2, o3]);
        
        expect(result[0].id).toBe('urgent1');
        expect(result.length).toBe(3);
    });

    it('should sort urgent orders by distance from station', () => {
        // Station at 0,0
        const o1 = createOrder('far_urgent', 10, 10, 90); // Distance ~14
        const o2 = createOrder('near_urgent', 1, 1, 90);   // Distance ~1.4
        
        const result = optimizeBatchRoute(station, [o1, o2]);
        
        expect(result[0].id).toBe('near_urgent');
        expect(result[1].id).toBe('far_urgent');
    });

    it('should optimize normal orders using Nearest Neighbor from last urgent', () => {
        // Station at 0,0
        // Urgent at 2,2
        // Normal A at 3,3 (Dist from Urgent: ~1.4)
        // Normal B at 10,10 (Dist from Urgent: ~11)
        
        const urgent = createOrder('urgent', 2, 2, 90);
        const normalA = createOrder('normalA', 3, 3, 50);
        const normalB = createOrder('normalB', 10, 10, 50);
        
        // Input order shouldn't matter for NN
        const result = optimizeBatchRoute(station, [normalB, urgent, normalA]);
        
        expect(result[0].id).toBe('urgent');
        expect(result[1].id).toBe('normalA'); // Closest to urgent
        expect(result[2].id).toBe('normalB'); // Closest to normalA
    });

    it('should handle mixed urgent and normal correctly', () => {
        // Station: 0,0
        // U1: 1,0 (Dist 1)
        // U2: 5,0 (Dist 5)
        // N1: 6,0 (Dist 1 from U2)
        // N2: 10,0 (Dist 4 from N1)
        // N3: 5.5, 0 (Dist 0.5 from U2, so closer than N1)
        
        const u1 = createOrder('U1', 1, 0, 90);
        const u2 = createOrder('U2', 5, 0, 90);
        const n1 = createOrder('N1', 6, 0, 50);
        const n2 = createOrder('N2', 10, 0, 50);
        const n3 = createOrder('N3', 5.5, 0, 50);

        const result = optimizeBatchRoute(station, [n1, n2, n3, u2, u1]);

        // Expected:
        // Urgent sorted by dist from station: U1 (1), U2 (5)
        // Normal sorted by NN from U2:
        // - From U2(5,0): N3(5.5,0) is dist 0.5. N1(6,0) is dist 1. So N3 first.
        // - From N3(5.5,0): N1(6,0) is dist 0.5. N2(10,0) is far. So N1 next.
        // - From N1(6,0): N2(10,0) is last.
        
        expect(result.map(o => o.id)).toEqual(['U1', 'U2', 'N3', 'N1', 'N2']);
    });
});
