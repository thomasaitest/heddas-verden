/**
 * The town is a rectangle that continues on the opposite side.
 * Positions stay inside [-size/2, size/2). Neighbours across the cut
 * are the same places shifted by one world width.
 */

import type { Colliders, RectCollider, CircleCollider } from './collision.ts';
import { resolve, type Pos } from './collision.ts';

export function wrapCoord(v: number, size: number): number {
  const half = size / 2;
  let x = ((v + half) % size + size) % size;
  return x - half;
}

/** Shortest step from `a` toward `b` on a wrapping axis. */
export function wrapDelta(a: number, b: number, size: number): number {
  let d = b - a;
  const half = size / 2;
  if (d > half) d -= size;
  if (d < -half) d += size;
  return d;
}

/** Copy of (x,z) that sits closest to the viewer, including across the cut. */
export function nearestCopy(x: number, z: number, vx: number, vz: number, size: number): { x: number; z: number } {
  let bestX = x;
  let bestZ = z;
  let best = Infinity;
  for (let ix = -1; ix <= 1; ix++) {
    for (let iz = -1; iz <= 1; iz++) {
      const xx = x + ix * size;
      const zz = z + iz * size;
      const d = (xx - vx) ** 2 + (zz - vz) ** 2;
      if (d < best) {
        best = d;
        bestX = xx;
        bestZ = zz;
      }
    }
  }
  return { x: bestX, z: bestZ };
}

/**
 * When you stand near an edge, solids from the opposite edge are shifted
 * so they block you before you cross. The middle of the map is unchanged.
 */
export function seamColliders(c: Colliders, size: number, x: number, z: number, margin = 12): Colliders {
  const half = size / 2;
  const east = x > half - margin;
  const west = x < -half + margin;
  const north = z > half - margin;
  const south = z < -half + margin;
  if (!east && !west && !north && !south) return c;
  const rects: RectCollider[] = c.rects.slice();
  const circles: CircleCollider[] = c.circles.slice();
  const reach = margin + 8;
  const onWest = (v: number) => v < -half + reach;
  const onEast = (v: number) => v > half - reach;
  const onSouth = (v: number) => v < -half + reach;
  const onNorth = (v: number) => v > half - reach;
  const any = () => true;
  const add = (dx: number, dz: number, xOk: (v: number) => boolean, zOk: (v: number) => boolean) => {
    for (const r of c.rects) if (xOk(r.x) && zOk(r.z)) rects.push({ ...r, x: r.x + dx, z: r.z + dz });
    for (const k of c.circles) if (xOk(k.x) && zOk(k.z)) circles.push({ ...k, x: k.x + dx, z: k.z + dz });
  };
  if (east) add(size, 0, onWest, any);
  if (west) add(-size, 0, onEast, any);
  if (north) add(0, size, any, onSouth);
  if (south) add(0, -size, any, onNorth);
  if (east && north) add(size, size, onWest, onSouth);
  if (east && south) add(size, -size, onWest, onNorth);
  if (west && north) add(-size, size, onEast, onSouth);
  if (west && south) add(-size, -size, onEast, onNorth);
  return { rects, circles };
}

/** Walk (dx,dz), crossing to the opposite side instead of stopping at the edge. */
export function moveWrapped(pos: Pos, dx: number, dz: number, r: number, c: Colliders, size: number, maxStep = 0.08): void {
  const dist = Math.hypot(dx, dz);
  const step = Math.min(0.08, Math.max(0.02, maxStep));
  const steps = Math.max(1, Math.ceil(dist / step));
  const sx = dx / steps;
  const sz = dz / steps;
  for (let i = 0; i < steps; i++) {
    pos.x += sx;
    pos.z += sz;
    pos.x = wrapCoord(pos.x, size);
    pos.z = wrapCoord(pos.z, size);
    resolve(pos, r, seamColliders(c, size, pos.x, pos.z), 8, { x: sx, z: sz });
    pos.x = wrapCoord(pos.x, size);
    pos.z = wrapCoord(pos.z, size);
  }
}
