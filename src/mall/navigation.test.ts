import { describe, expect, it } from 'vitest';
import { clearSegment, isWalkable, routeToStore, storeEntrances, type FloorPoint, type StoreDestination } from './navigation';

describe('mall store navigation', () => {
  const starts: FloorPoint[] = [{x:0,z:6.5},{x:0,z:3.4},{x:-3.5,z:1.7},{x:3.8,z:2.4},{x:-.4,z:4.4},...Object.values(storeEntrances)];
  for (const store of Object.keys(storeEntrances) as StoreDestination[]) {
    it(`reaches ${store} from conversation, roaming and other entrances without crossing fixtures`, () => {
      for (const start of starts) {
        const path = routeToStore(start, store);
        expect(path.length).toBeGreaterThan(0);
        expect(path.at(-1)).toEqual(storeEntrances[store]);
        let previous = start;
        for (const point of path) {
          expect(isWalkable(point)).toBe(true);
          expect(clearSegment(previous, point)).toBe(true);
          previous = point;
        }
      }
    });
  }
  it('takes a bend around the freestanding sign instead of driving straight through it', () => {
    const start = {x:0,z:-3.5};
    expect(clearSegment(start, storeEntrances.aesop)).toBe(false);
    const route = routeToStore(start, 'aesop');
    expect(route.length).toBeGreaterThan(1);
    expect(route.at(-1)).toEqual(storeEntrances.aesop);
  });
  it('rejects a blocked or out-of-bounds start instead of teleporting it', () => {
    expect(routeToStore({x:9.5,z:0}, 'apple')).toEqual([]);
    expect(routeToStore({x:20,z:0}, 'apple')).toEqual([]);
  });
});
