/**
 * Grassy mounds on the town. You walk up the slope; nothing solid fills the hill,
 * so a tree must not be planted on the upper slope.
 */

export interface Hill {
  x: number;
  z: number;
  /** Horizontal radius. */
  r: number;
  /** Height of the crest above the grass. */
  h: number;
}

/** Inside the walkable square (half-width 120). Kept off roads and buildings. */
export const GROUND_HILLS: readonly Hill[] = [
  { x: 96, z: 78, r: 16, h: 8 },
  { x: 100, z: -78, r: 18, h: 7.5 },
  { x: -100, z: 72, r: 17, h: 8.5 },
  { x: -96, z: -18, r: 15, h: 7 },
  { x: 10, z: 102, r: 16, h: 9 },
  { x: -6, z: -102, r: 16, h: 7.5 },
];

/** A tree this far inside the radius is standing on the mountain, not at its foot. */
export const HILL_TREE_KEEP_OUT = 0.72;

export function hillHeight(x: number, z: number, hills: readonly Hill[] = GROUND_HILLS): number {
  let best = 0;
  for (const hill of hills) {
    const d = Math.hypot(x - hill.x, z - hill.z);
    if (d >= hill.r) continue;
    const u = 1 - d / hill.r;
    const h = hill.h * u * u;
    if (h > best) best = h;
  }
  return best;
}

export function treeOnHill(x: number, z: number, hills: readonly Hill[] = GROUND_HILLS): boolean {
  return hills.some((hill) => Math.hypot(x - hill.x, z - hill.z) < hill.r * HILL_TREE_KEEP_OUT);
}
