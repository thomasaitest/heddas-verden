/**
 * Pure town layout: places, building footprints, road network and props.
 * Used by the 3D town builder and by tests (no three.js).
 */

export interface Place {
  id: string;
  x: number;
  z: number;
  /** Half-width / half-depth of the building footprint in local space (facing plaza). */
  hw: number;
  hd: number;
}

export interface RoadSeg {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
}

export interface BuildingFoot {
  x: number;
  z: number;
  hw: number;
  hd: number;
  rot: number;
  id: string;
}

/** Landmark centres (world). */
export const PLACES: Record<string, Place> = {
  home: { id: 'home', x: -38, z: -34, hw: 8, hd: 7 },
  shop: { id: 'shop', x: 38, z: -34, hw: 7, hd: 5 },
  eggs: { id: 'eggs', x: 0, z: -50, hw: 6, hd: 4.5 },
  vet: { id: 'vet', x: 46, z: 12, hw: 7, hd: 5.5 },
  play: { id: 'play', x: -44, z: 16, hw: 11, hd: 11 },
  doors: { id: 'doors', x: 4, z: 46, hw: 5, hd: 3 },
  cars: { id: 'cars', x: 52, z: -8, hw: 9, hd: 6.5 },
  pets: { id: 'pets', x: -52, z: -8, hw: 8, hd: 6 },
};

export const PLAZA_R = 13;
export const RING_R = 17;
export const ROAD_W = 4.8;
export const APPROACH_W = 4.6;

export function faceCenter(x: number, z: number) {
  return Math.atan2(-x, -z);
}

/** Point in front of a place (local +z is the door side after rotation). */
export function frontOf(p: { x: number; z: number }, dist: number) {
  const rot = faceCenter(p.x, p.z);
  return { x: p.x + Math.sin(rot) * dist, z: p.z + Math.cos(rot) * dist, rot };
}

/**
 * Neighbourhood house plots (plot 0 = local player / Hjem).
 * Kept clear of shop/vet/play footprints.
 */
export const HOUSE_PLOTS: { x: number; z: number }[] = [
  { x: -38, z: -34 },
  { x: -68, z: -40 },
  { x: -58, z: -68 },
  { x: -28, z: -68 },
  { x: -12, z: -42 },
  { x: -78, z: -58 },
];

function len(x1: number, z1: number, x2: number, z2: number) {
  return Math.hypot(x2 - x1, z2 - z1);
}

/** Closest distance from point to a finite road segment (to centre line). */
export function distToSeg(x: number, z: number, s: RoadSeg): number {
  const dx = s.x2 - s.x1;
  const dz = s.z2 - s.z1;
  const L2 = dx * dx + dz * dz;
  if (L2 < 1e-9) return Math.hypot(x - s.x1, z - s.z1);
  let t = ((x - s.x1) * dx + (z - s.z1) * dz) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (s.x1 + dx * t), z - (s.z1 + dz * t));
}

export function onRoad(x: number, z: number, roads: readonly RoadSeg[], margin = 0): boolean {
  return roads.some((s) => distToSeg(x, z, s) < s.width / 2 + margin);
}

/** Does a road centre-line come within the building footprint (+ pad)? */
export function roadHitsBuilding(s: RoadSeg, b: BuildingFoot, pad = 0.5): boolean {
  const steps = Math.max(10, Math.ceil(len(s.x1, s.z1, s.x2, s.z2) / 1.2));
  const cos = Math.cos(b.rot);
  const sin = Math.sin(b.rot);
  const expand = s.width / 2 + pad;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = s.x1 + (s.x2 - s.x1) * t;
    const z = s.z1 + (s.z2 - s.z1) * t;
    const wx = x - b.x;
    const wz = z - b.z;
    const lx = wx * cos - wz * sin;
    const lz = wx * sin + wz * cos;
    if (Math.abs(lx) < b.hw + expand && Math.abs(lz) < b.hd + expand) return true;
  }
  return false;
}

export function buildingsFromPlaces(): BuildingFoot[] {
  return Object.values(PLACES).map((p) => ({
    id: p.id,
    x: p.x,
    z: p.z,
    hw: p.hw,
    hd: p.hd,
    rot: faceCenter(p.x, p.z),
  }));
}

function hitsAny(s: RoadSeg, buildings: BuildingFoot[], pad = 0.5): boolean {
  return buildings.some((b) => roadHitsBuilding(s, b, pad));
}

/** Add a segment only if it clears every building. */
function pushClear(roads: RoadSeg[], s: RoadSeg, buildings: BuildingFoot[]) {
  if (!hitsAny(s, buildings, 0.45)) roads.push(s);
}

/**
 * Road network: plaza ring + short approaches that stop at each building front,
 * neighbourhood loop, and clear cross-links. Never runs through a building.
 */
export function buildRoadNetwork(): RoadSeg[] {
  const buildings = buildingsFromPlaces();
  const roads: RoadSeg[] = [];

  // Ring around the plaza (chords).
  const N = 20;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2;
    const a1 = ((i + 1) / N) * Math.PI * 2;
    pushClear(
      roads,
      {
        x1: Math.cos(a0) * RING_R,
        z1: Math.sin(a0) * RING_R,
        x2: Math.cos(a1) * RING_R,
        z2: Math.sin(a1) * RING_R,
        width: ROAD_W,
      },
      buildings,
    );
  }

  // Approach from ring to each landmark's door (stops well clear of the footprint).
  for (const p of Object.values(PLACES)) {
    if (p.id === 'home' || p.id === 'play') continue; // home/play use other links
    const doorDist = p.hd + 3.5;
    const door = frontOf(p, doorDist);
    const ang = Math.atan2(p.z, p.x);
    const ring = { x: Math.cos(ang) * RING_R, z: Math.sin(ang) * RING_R };
    if (Math.hypot(p.x, p.z) <= RING_R + 6) continue;
    // Route via an intermediate point further out from the plaza so we don't clip corners.
    const midAng = Math.atan2(door.z - ring.z, door.x - ring.x);
    const midLen = Math.hypot(door.x - ring.x, door.z - ring.z) * 0.55;
    const mid = {
      x: ring.x + Math.cos(midAng) * midLen,
      z: ring.z + Math.sin(midAng) * midLen,
    };
    // Nudge mid away from any building centre it might skim.
    let mx = mid.x;
    let mz = mid.z;
    for (const b of buildings) {
      const d = Math.hypot(mx - b.x, mz - b.z);
      const minD = Math.hypot(b.hw, b.hd) + APPROACH_W + 2;
      if (d < minD && d > 1e-3) {
        const push = (minD - d) / d;
        mx += (mx - b.x) * push;
        mz += (mz - b.z) * push;
      }
    }
    pushClear(roads, { x1: ring.x, z1: ring.z, x2: mx, z2: mz, width: APPROACH_W }, buildings);
    pushClear(roads, { x1: mx, z1: mz, x2: door.x, z2: door.z, width: APPROACH_W }, buildings);
  }

  // Playground: approach to the gate (not through the fence circle).
  {
    const p = PLACES.play;
    const door = frontOf(p, 13);
    const ang = Math.atan2(p.z, p.x);
    const ring = { x: Math.cos(ang) * RING_R, z: Math.sin(ang) * RING_R };
    pushClear(roads, { x1: ring.x, z1: ring.z, x2: door.x, z2: door.z, width: APPROACH_W }, buildings);
  }

  // Neighbourhood loop (west/south of home), clear of every landmark.
  const loop: [number, number][] = [
    [-22, -20],
    [-22, -52],
    [-42, -78],
    [-72, -78],
    [-86, -48],
    [-72, -22],
    [-48, -20],
    [-22, -20],
  ];
  for (let i = 0; i < loop.length - 1; i++) {
    const [x1, z1] = loop[i];
    const [x2, z2] = loop[i + 1];
    pushClear(roads, { x1, z1, x2, z2, width: 4.2 }, buildings);
  }
  for (const plot of HOUSE_PLOTS) {
    const rot = faceCenter(plot.x, plot.z);
    const door = { x: plot.x + Math.sin(rot) * 10, z: plot.z + Math.cos(rot) * 10 };
    let best = loop[0];
    let bestD = Infinity;
    for (const v of loop) {
      const d = Math.hypot(v[0] - door.x, v[1] - door.z);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    pushClear(roads, { x1: best[0], z1: best[1], x2: door.x, z2: door.z, width: 4.0 }, buildings);
  }

  // Cross-links via outer waypoints (network, not only spokes).
  const links: { a: string; b: string; wx: number; wz: number; w: number }[] = [
    { a: 'shop', b: 'eggs', wx: 22, wz: -48, w: 4.2 },
    { a: 'cars', b: 'vet', wx: 58, wz: 4, w: 4.2 },
    { a: 'pets', b: 'play', wx: -58, wz: 6, w: 4.2 },
    { a: 'doors', b: 'vet', wx: 28, wz: 36, w: 4.0 },
    { a: 'shop', b: 'cars', wx: 48, wz: -22, w: 4.2 },
    { a: 'eggs', b: 'doors', wx: 18, wz: -8, w: 4.0 },
  ];
  for (const L of links) {
    const A = PLACES[L.a];
    const B = PLACES[L.b];
    const da = frontOf(A, A.hd + 3.5);
    const db = frontOf(B, B.hd + 3.5);
    pushClear(roads, { x1: da.x, z1: da.z, x2: L.wx, z2: L.wz, width: L.w }, buildings);
    pushClear(roads, { x1: L.wx, z1: L.wz, x2: db.x, z2: db.z, width: L.w }, buildings);
  }

  return roads;
}

/**
 * Bench positions: off every road.
 * `yaw` is the sit-facing direction (avatar forward = away from the backrest).
 * Forward in the game is (sin(yaw), cos(yaw)).
 */
export function benchSpots(roads: readonly RoadSeg[]): { x: number; z: number; yaw: number }[] {
  const out: { x: number; z: number; yaw: number }[] = [];
  const tryAdd = (x: number, z: number, yaw: number) => {
    if (onRoad(x, z, roads, 1.3)) return;
    if (Math.hypot(x, z) < PLAZA_R - 0.5) return;
    for (const p of Object.values(PLACES)) {
      if (Math.hypot(x - p.x, z - p.z) < Math.max(p.hw, p.hd) + 2) return;
    }
    out.push({ x, z, yaw });
  };
  // Around the plaza: face the fountain (towards origin).
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.2;
    const x = Math.cos(a) * 12.2;
    const z = Math.sin(a) * 12.2;
    // forward toward centre: (-x, -z) ⇒ yaw = atan2(-x, -z)
    tryAdd(x, z, Math.atan2(-x, -z));
  }
  // Outside the ring: face roughly toward the plaza.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.4;
    const x = Math.cos(a) * 24;
    const z = Math.sin(a) * 24;
    tryAdd(x, z, Math.atan2(-x, -z));
  }
  // Neighbourhood: face the nearby road / open space (explicit sit yaw).
  for (const [x, z, yaw] of [
    [-30, -54, Math.PI],       // look north toward loop
    [-60, -80, Math.PI / 2],   // look east
    [-84, -48, 0],             // look south
    [-48, -24, -Math.PI / 2],  // look west
    [-14, -56, Math.PI],
  ] as [number, number, number][]) {
    tryAdd(x, z, yaw);
  }
  return out;
}

/** World offset of the backrest relative to the seat for a given sit yaw (pure helper for tests). */
export function benchBackrestOffset(sitYaw: number, depth = 0.45): { x: number; z: number } {
  return { x: -Math.sin(sitYaw) * depth, z: -Math.cos(sitYaw) * depth };
}

/** Lamp posts sit just outside the ring road. */
export function lampSpots(roads: readonly RoadSeg[]): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.12;
    const x = Math.cos(a) * (RING_R + 3.5);
    const z = Math.sin(a) * (RING_R + 3.5);
    if (onRoad(x, z, roads, 0.9)) continue;
    out.push({ x, z });
  }
  return out;
}
