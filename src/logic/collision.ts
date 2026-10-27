/**
 * Pure 2D (x/z plane) collision helpers. No three.js here so it is easy to test.
 * A player is a circle; the world is made of oriented rectangles and circles.
 */
export interface RectCollider {
  x: number;
  z: number;
  /** Half extents along the rectangle's own x / z axes. */
  hw: number;
  hd: number;
  /** Rotation about the y axis (same convention as three.js `rotation.y`). */
  rot: number;
  /** Top of the object; flying above this clears it. Default: infinitely tall. */
  h?: number;
}
export interface CircleCollider {
  x: number;
  z: number;
  r: number;
  h?: number;
}
export interface Colliders {
  rects: readonly RectCollider[];
  circles: readonly CircleCollider[];
}
export interface Pos {
  x: number;
  y: number;
  z: number;
}

/** How far above an obstacle a player must be (flying) to pass over it. A jump never gets there. */
export const CLEAR_MARGIN = 2.5;

const cleared = (y: number, h: number | undefined) => h !== undefined && y > h + CLEAR_MARGIN;

/** Push a circle (centre + radius r) out of everything. Slides naturally along walls. Mutates pos. */
export function resolve(pos: Pos, r: number, c: Colliders, passes = 4): boolean {
  let hit = false;
  for (let pass = 0; pass < passes; pass++) {
    let moved = false;
    for (const k of c.circles) {
      if (cleared(pos.y, k.h)) continue;
      const dx = pos.x - k.x;
      const dz = pos.z - k.z;
      const d = Math.hypot(dx, dz);
      const min = k.r + r;
      if (d >= min) continue;
      if (d < 1e-6) pos.x = k.x + min;
      else {
        pos.x = k.x + (dx / d) * min;
        pos.z = k.z + (dz / d) * min;
      }
      moved = true;
    }
    for (const b of c.rects) {
      if (cleared(pos.y, b.h)) continue;
      const cos = Math.cos(b.rot);
      const sin = Math.sin(b.rot);
      const wx = pos.x - b.x;
      const wz = pos.z - b.z;
      // world -> rectangle local (inverse of three's rotation.y)
      const lx = wx * cos - wz * sin;
      const lz = wx * sin + wz * cos;
      const cx = Math.max(-b.hw, Math.min(b.hw, lx));
      const cz = Math.max(-b.hd, Math.min(b.hd, lz));
      let nx: number;
      let nz: number;
      if (cx === lx && cz === lz) {
        // centre is inside: leave through the nearest side
        const px = b.hw - Math.abs(lx);
        const pz = b.hd - Math.abs(lz);
        if (px < pz) {
          nx = (lx < 0 ? -1 : 1) * (b.hw + r);
          nz = lz;
        } else {
          nx = lx;
          nz = (lz < 0 ? -1 : 1) * (b.hd + r);
        }
      } else {
        const dx = lx - cx;
        const dz = lz - cz;
        const d = Math.hypot(dx, dz);
        if (d >= r) continue;
        nx = cx + (dx / d) * r;
        nz = cz + (dz / d) * r;
      }
      pos.x = b.x + nx * cos + nz * sin;
      pos.z = b.z - nx * sin + nz * cos;
      moved = true;
    }
    if (!moved) break;
    hit = true;
  }
  return hit;
}

/**
 * Move by (dx, dz) in small sub-steps so a fast player (or a long frame) can never
 * jump over a thin wall, resolving collisions after each step.
 */
export function movePlayer(pos: Pos, dx: number, dz: number, r: number, c: Colliders, bounds?: number, maxStep = 0.3): void {
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / maxStep));
  for (let i = 0; i < steps; i++) {
    pos.x += dx / steps;
    pos.z += dz / steps;
    if (bounds !== undefined) {
      pos.x = Math.max(-bounds, Math.min(bounds, pos.x));
      pos.z = Math.max(-bounds, Math.min(bounds, pos.z));
    }
    resolve(pos, r, c);
  }
}

/** True if a circle at (x,z) with radius r overlaps any collider (used for placing and for tests). */
export function blocked(x: number, z: number, r: number, c: Colliders, y = 0): boolean {
  const p = { x, y, z };
  const px = p.x;
  const pz = p.z;
  resolve(p, r - 1e-4, c, 1);
  return Math.abs(p.x - px) > 1e-6 || Math.abs(p.z - pz) > 1e-6;
}
