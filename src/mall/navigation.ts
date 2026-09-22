export type StoreDestination = 'lululemon' | 'apple' | 'aesop';
export type FloorPoint = { x: number; z: number };
type Obstacle = { minX: number; maxX: number; minZ: number; maxZ: number };
export const storeEntrances: Record<StoreDestination, FloorPoint> = {
  lululemon: { x: 0, z: -4.2 }, apple: { x: -7, z: -4.2 }, aesop: { x: 7, z: -4.2 },
};
// Robot centre bounds and fixture footprints expanded by its 1.05m turning radius.
export const navigationBounds = { minX: -10.2, maxX: 10.2, minZ: -4.35, maxZ: 7.5 };
const fixture = (x: number, z: number, width: number, depth: number): Obstacle => ({
  minX: x - width / 2 - 1.05, maxX: x + width / 2 + 1.05,
  minZ: z - depth / 2 - 1.05, maxZ: z + depth / 2 + 1.05,
});
export const navigationObstacles: Obstacle[] = [
  fixture(-8, 3.6, 2.8, .9), fixture(7.7, 5.3, 2.8, .9),
  fixture(-9.2, 5.3, .8, .8), fixture(9.2, 6.5, .8, .8), fixture(-10.5, -3.4, .9, .9),
  fixture(-8.8, -.8, 1.3, .18), fixture(3.7, -3.7, 1.05, .13),
  fixture(9.5, -1.25, 1.8, 6.7),
];
export function isWalkable(point: FloorPoint) {
  return point.x >= navigationBounds.minX && point.x <= navigationBounds.maxX && point.z >= navigationBounds.minZ && point.z <= navigationBounds.maxZ &&
    !navigationObstacles.some(o => point.x >= o.minX && point.x <= o.maxX && point.z >= o.minZ && point.z <= o.maxZ);
}
export function clearSegment(a: FloorPoint, b: FloorPoint) {
  if (!isWalkable(a) || !isWalkable(b)) return false;
  return !navigationObstacles.some(o => {
    let lo = 0, hi = 1;
    for (const [start, delta, min, max] of [[a.x, b.x - a.x, o.minX, o.maxX], [a.z, b.z - a.z, o.minZ, o.maxZ]]) {
      if (Math.abs(delta) < 1e-8) { if (start < min || start > max) return false; }
      else { const p = (min - start) / delta, q = (max - start) / delta; lo = Math.max(lo, Math.min(p, q)); hi = Math.min(hi, Math.max(p, q)); if (lo > hi) return false; }
    }
    return true;
  });
}
// Visibility graph + Dijkstra: routes bend around fixtures instead of driving through them.
export function routeToStore(start: FloorPoint, store: StoreDestination): FloorPoint[] {
  const goal = storeEntrances[store];
  const corners = navigationObstacles.flatMap(o => [
    {x:o.minX-.03,z:o.minZ-.03}, {x:o.minX-.03,z:o.maxZ+.03},
    {x:o.maxX+.03,z:o.minZ-.03}, {x:o.maxX+.03,z:o.maxZ+.03},
  ]).filter(isWalkable);
  const nodes = [{...start}, {...goal}, ...corners];
  const costs = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set<number>(); costs[0] = 0;
  while (visited.size < nodes.length) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (current === -1 || costs[i] < costs[current])) current = i;
    if (current < 0 || !Number.isFinite(costs[current])) return [];
    if (current === 1) { const path: FloorPoint[] = []; for (let i = 1; i > 0; i = previous[i]) path.unshift(nodes[i]); return path; }
    visited.add(current);
    nodes.forEach((node, i) => {
      if (visited.has(i) || !clearSegment(nodes[current], node)) return;
      const cost = costs[current] + Math.hypot(node.x - nodes[current].x, node.z - nodes[current].z);
      if (cost < costs[i]) { costs[i] = cost; previous[i] = current; }
    });
  }
  return [];
}
