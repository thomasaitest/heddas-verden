/**
 * The world inside the mountain. It is larger than the little peak outside.
 * Coordinates are local to the cave, not the town.
 */

import type { Colliders, RectCollider } from './collision.ts';

export const CAVE_R = 34;
export const CAVE_EXIT = { x: 0, z: -26, r: 3.4 };
export const CAVE_SPAWN = { x: 0, z: -21 };
export const CAVE_ROPE = { x: 12, z: 8, r: 2.4 };

export interface CaveRock {
  x: number;
  z: number;
  r: number;
  h: number;
}

export const CAVE_ROCKS: readonly CaveRock[] = [
  { x: -10, z: -8, r: 1.6, h: 4 },
  { x: 8, z: -6, r: 1.4, h: 3.5 },
  { x: -16, z: 6, r: 2.1, h: 5 },
  { x: 18, z: 14, r: 1.8, h: 4.2 },
  { x: -6, z: 16, r: 1.5, h: 3.2 },
  { x: 4, z: 18, r: 1.3, h: 2.8 },
  { x: -18, z: -14, r: 1.7, h: 3.6 },
  { x: 16, z: -12, r: 1.5, h: 3 },
];

export function caveColliders(): Colliders {
  const rects: RectCollider[] = [];
  const circles = CAVE_ROCKS.map((rock) => ({ x: rock.x, z: rock.z, r: rock.r, h: rock.h }));
  const n = 28;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // Leave a gap at the south exit (around angle -PI/2).
    const z = Math.sin(a) * CAVE_R;
    if (z < CAVE_EXIT.z + 2 && Math.abs(Math.cos(a) * CAVE_R) < 4) continue;
    rects.push({
      x: Math.cos(a) * CAVE_R,
      z,
      hw: ((2 * Math.PI * CAVE_R) / n) * 0.55,
      hd: 0.8,
      rot: Math.PI / 2 - a,
      h: 8,
    });
  }
  rects.push({ x: CAVE_ROPE.x, z: CAVE_ROPE.z + 1.4, hw: 1.6, hd: 0.55, rot: 0, h: 1.3 });
  rects.push({ x: CAVE_EXIT.x - 2.4, z: CAVE_EXIT.z, hw: 0.5, hd: 0.5, rot: 0, h: 3.2 });
  rects.push({ x: CAVE_EXIT.x + 2.4, z: CAVE_EXIT.z, hw: 0.5, hd: 0.5, rot: 0, h: 3.2 });
  circles.push({ x: -14, z: 10, r: 2.4, h: 0.9 });
  return { rects, circles };
}

export function inCave(x: number, z: number, pad = 0): boolean {
  return Math.hypot(x, z) <= CAVE_R - pad;
}
