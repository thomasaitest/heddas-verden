/**
 * The world inside the mountain. It is a cavern, far larger than the little peak outside.
 * Coordinates are local to the cave, not the town.
 */

import type { Colliders, RectCollider } from './collision.ts';

/** Walkable radius. The outside fjell cloud is only 9 across the middle. */
export const CAVE_R = 90;
/** Rock roof. Feet stop under this so a jump cannot leave the cavern. */
export const CAVE_CEILING = 8.5;
export const CAVE_EXIT = { x: 0, z: -(CAVE_R - 14), r: 4.2 };
export const CAVE_SPAWN = { x: 0, z: CAVE_EXIT.z + 9 };
/** Stall stands a walk north of the gate, still with most of the cavern ahead. */
export const CAVE_ROPE = { x: 18, z: CAVE_EXIT.z + 36, r: 2.8 };

export interface CaveRock {
  x: number;
  z: number;
  /** Visual and collider radius. A sphere of this size sits on the floor. */
  r: number;
  h: number;
}

export const CAVE_ROCKS: readonly CaveRock[] = [
  { x: -24, z: -48, r: 2.4, h: 4.8 },
  { x: 30, z: -28, r: 2.2, h: 4.4 },
  { x: -12, z: -8, r: 2.8, h: 5.6 },
  { x: 22, z: 6, r: 2.0, h: 4 },
  { x: -36, z: 18, r: 3.1, h: 6.2 },
  { x: 8, z: 36, r: 2.5, h: 5 },
  { x: 48, z: -8, r: 2.6, h: 5.2 },
  { x: -6, z: 58, r: 2.3, h: 4.6 },
];

export const CAVE_CRYSTAL = { x: -16, z: 22 };

export function caveColliders(): Colliders {
  const rects: RectCollider[] = [];
  const circles = CAVE_ROCKS.map((rock) => ({ x: rock.x, z: rock.z, r: rock.r + 0.45, h: rock.h }));
  const n = 56;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * CAVE_R;
    const z = Math.sin(a) * CAVE_R;
    // Gap at the south gate.
    if (z < CAVE_EXIT.z + 3 && Math.abs(x - CAVE_EXIT.x) < 5.5) continue;
    rects.push({
      x,
      z,
      hw: ((2 * Math.PI * CAVE_R) / n) * 0.58,
      hd: 1.1,
      rot: Math.PI / 2 - a,
      h: CAVE_CEILING,
    });
  }
  rects.push({ x: CAVE_ROPE.x, z: CAVE_ROPE.z + 1.6, hw: 1.8, hd: 0.6, rot: 0, h: 1.4 });
  rects.push({ x: CAVE_EXIT.x - 2.6, z: CAVE_EXIT.z, hw: 0.55, hd: 0.55, rot: 0, h: 3.4 });
  rects.push({ x: CAVE_EXIT.x + 2.6, z: CAVE_EXIT.z, hw: 0.55, hd: 0.55, rot: 0, h: 3.4 });
  return { rects, circles };
}

export function inCave(x: number, z: number, pad = 0): boolean {
  return Math.hypot(x, z) <= CAVE_R - pad;
}
