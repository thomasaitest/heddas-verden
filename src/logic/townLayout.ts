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
/**
 * Road network: orthogonal grid of main streets + cross streets, a small
 * plaza square around the fountain, and short stubs to each door.
 * No hub-and-spoke diagonals from the centre.
 */
export function buildRoadNetwork(): RoadSeg[] {
  const buildings = buildingsFromPlaces();
  const roads: RoadSeg[] = [];

  const add = (x1: number, z1: number, x2: number, z2: number, width = ROAD_W) => {
    pushClear(roads, { x1, z1, x2, z2, width }, buildings);
  };

  // --- Plaza square (around the fountain), not a spoke ring ---
  const P = 14;
  add(-P, -P, P, -P, 5.0);
  add(P, -P, P, P, 5.0);
  add(P, P, -P, P, 5.0);
  add(-P, P, -P, -P, 5.0);

  // --- Main streets (axis-aligned) ---
  // East–West corridors
  add(-70, -22, 70, -22, 5.2); // south of plaza: pets ↔ home/shop ↔ cars
  add(-60, 22, 60, 22, 5.0); // north of plaza: play ↔ doors/vet belt
  add(-80, -55, -10, -55, 4.6); // neighbourhood south belt
  add(-80, -40, -20, -40, 4.4); // neighbourhood mid belt

  // North–South corridors
  add(-22, -78, -22, 40, 5.0); // west spine: houses / play
  add(22, -60, 22, 50, 5.0); // east spine: eggs/shop/vet/doors
  add(-55, -78, -55, 10, 4.6); // far-west neighbourhood
  add(55, -40, 55, 20, 4.6); // far-east: cars / vet

  // Extra cross links (still axis-aligned; form a real network)
  add(-22, -22, 22, -22, 5.2); // already on EW but ensure plaza connector
  add(0, -P, 0, -48, 4.8); // plaza south → eggs
  add(0, P, 0, 42, 4.8); // plaza north → doors
  add(-P, 0, -48, 0, 4.8); // plaza west → pets/play approach
  add(P, 0, 50, 0, 4.8); // plaza east → cars/vet approach

  // --- Short stubs: from nearest main street to each building door (L-shaped, axis-aligned) ---
  // Landmark doors (front side facing plaza)
  for (const p of Object.values(PLACES)) {
    if (p.id === 'home') continue; // plot stub below
    const door = frontOf(p, p.hd + 3.2);
    // Snap stub to nearest cardinal main street
    const candidates: { sx?: number; sz?: number; d: number }[] = [
      { sz: -22, d: Math.abs(door.z - -22) },
      { sz: 22, d: Math.abs(door.z - 22) },
      { sz: -55, d: Math.abs(door.z - -55) },
      { sz: 0, d: Math.abs(door.z - 0) },
      { sx: -22, d: Math.abs(door.x - -22) },
      { sx: 22, d: Math.abs(door.x - 22) },
      { sx: -55, d: Math.abs(door.x - -55) },
      { sx: 55, d: Math.abs(door.x - 55) },
      { sx: 0, d: Math.abs(door.x - 0) },
    ];
    candidates.sort((a, b) => a.d - b.d);
    const best = candidates[0];
    if (best.sz !== undefined) {
      // vertical stub from EW street up to door, plus short EW jog from street x to door x
      const along = best.sz;
      add(door.x, along, door.x, door.z, APPROACH_W);
    } else if (best.sx !== undefined) {
      add(best.sx, door.z, door.x, door.z, APPROACH_W);
    }
  }

  // House plot stubs → nearest neighbourhood belt
  for (const plot of HOUSE_PLOTS) {
    const rot = faceCenter(plot.x, plot.z);
    const door = { x: plot.x + Math.sin(rot) * 10, z: plot.z + Math.cos(rot) * 10 };
    // attach to closest of z=-40, z=-55, x=-22, x=-55
    const opts = [
      { sz: -40, d: Math.abs(door.z + 40) },
      { sz: -55, d: Math.abs(door.z + 55) },
      { sx: -22, d: Math.abs(door.x + 22) },
      { sx: -55, d: Math.abs(door.x + 55) },
    ];
    opts.sort((a, b) => a.d - b.d);
    const b = opts[0] as { sx?: number; sz?: number };
    if (b.sz !== undefined) add(door.x, b.sz, door.x, door.z, 4.0);
    else if (b.sx !== undefined) add(b.sx, door.z, door.x, door.z, 4.0);
  }

  return roads;
}

/**
 * Bench positions: on the grass, clearly off every road.
 * `yaw` = sit facing (avatar forward = away from the backrest).
 * Forward in the game is (sin(yaw), cos(yaw)).
 */
export function benchSpots(roads: readonly RoadSeg[]): { x: number; z: number; yaw: number }[] {
  const out: { x: number; z: number; yaw: number }[] = [];
  const tryAdd = (x: number, z: number, yaw: number) => {
    if (onRoad(x, z, roads, 1.35)) return;
    // Keep clear of the fountain bowl only (not the whole plaza lawn).
    if (Math.hypot(x, z) < 6.2) return;
    for (const p of Object.values(PLACES)) {
      if (Math.hypot(x - p.x, z - p.z) < Math.max(p.hw, p.hd) + 2.5) return;
    }
    // keep clear of other benches
    if (out.some((b) => Math.hypot(b.x - x, b.z - z) < 3.5)) return;
    out.push({ x, z, yaw });
  };

  // Plaza grass just inside the square roads, facing the fountain.
  // Sit on the inner lawn (radius ~10), not on the plaza road at |x| or |z| = 14.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    // well inside the plaza square roads (|x|,|z|=14) so onRoad never rejects them
    const x = Math.cos(a) * 8.5;
    const z = Math.sin(a) * 8.5;
    tryAdd(x, z, Math.atan2(-x, -z));
  }

  // Grass strips beside the main streets (offset off the asphalt), facing the street.
  const roadside: [number, number, number][] = [
    // south of EW z=-22, face north (toward street / plaza)
    [-35, -27, Math.PI],
    [8, -27, Math.PI],
    [35, -27, Math.PI],
    // north of EW z=-22, face south
    [-35, -17, 0],
    [35, -17, 0],
    // west of NS x=-22, face east
    [-27, 5, Math.PI / 2],
    [-27, -35, Math.PI / 2],
    // east of NS x=22, face west
    [27, 5, -Math.PI / 2],
    [27, -35, -Math.PI / 2],
    // neighbourhood park pockets
    [-40, -48, Math.PI],
    [-65, -48, Math.PI / 2],
    [-48, -70, 0],
    [-18, -62, -Math.PI / 2],
  ];
  for (const [x, z, yaw] of roadside) tryAdd(x, z, yaw);

  return out;
}

/** World offset of the backrest relative to the sit point for a given sit yaw. */
export function benchBackrestOffset(sitYaw: number, depth = 0.3): { x: number; z: number } {
  // Backrest is behind the sitter (opposite of forward).
  return { x: -Math.sin(sitYaw) * depth, z: -Math.cos(sitYaw) * depth };
}

/** Lamp posts along the plaza square and main streets, off the asphalt. */
export function lampSpots(roads: readonly RoadSeg[]): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  const tryAdd = (x: number, z: number) => {
    if (onRoad(x, z, roads, 0.9)) return;
    out.push({ x, z });
  };
  // Corners of the plaza square
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) tryAdd(s * 16.5, t * 16.5);
  }
  // Along main corridors
  for (const x of [-50, -30, 30, 50]) {
    tryAdd(x, -25);
    tryAdd(x, -19);
  }
  for (const z of [-50, -30, 10, 30]) {
    tryAdd(-25, z);
    tryAdd(25, z);
  }
  return out;
}
