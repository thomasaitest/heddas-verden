import { HOUSE_BY_STYLE, type HouseStyle } from './catalog.ts';
import { blocked, movePlayer, resolve, type Colliders, type RectCollider } from './collision.ts';

/**
 * Floor plans for the houses: rooms with walls and door gaps on two floors joined by a staircase.
 * Pure data and maths (no three.js) so walking, stairs and furniture placement can be tested.
 * Coordinates are house-local metres: (0,0) is the middle, the front door is on the +z side.
 *
 * Every HouseStyle has a clearly distinct plan: staircase side/width, room count, wall layout and names.
 */
export const FLOORS = 2;
/** Height between two floors. */
export const FLOOR_H = 6.6;
export const WALL_T = 0.4;
export const DOOR_W = 2.8;
/** Legacy default corner-room size (tests / older callers). */
export const ROOM = 7;
const MARGIN = 0.4;

export interface Room {
  id: string;
  name: string;
  floor: number;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
export interface Stairs {
  x0: number;
  x1: number;
  /** The top end (rises towards -z) and the bottom end. */
  zTop: number;
  zBottom: number;
}
export interface HouseLayout {
  style: HouseStyle;
  w: number;
  d: number;
  stairs: Stairs;
  rooms: Room[];
  /** Wall pieces per floor (axis aligned rectangles; door gaps are simply missing). */
  walls: RectCollider[][];
  /** Where the front door is (floor 0). */
  door: { x: number; z: number };
}

export const stairsMidX = (s: Stairs): number => (s.x0 + s.x1) / 2;

function wallX(out: RectCollider[], x: number, z0: number, z1: number, gaps: number[]): void {
  const cuts = [...gaps].sort((a, b) => a - b).flatMap((g) => [g - DOOR_W / 2, g + DOOR_W / 2]);
  const pts = [z0, ...cuts, z1];
  for (let i = 0; i < pts.length; i += 2) if (pts[i + 1] - pts[i] > 0.01) out.push({ x, z: (pts[i] + pts[i + 1]) / 2, hw: WALL_T / 2, hd: (pts[i + 1] - pts[i]) / 2, rot: 0 });
}
function wallZ(out: RectCollider[], z: number, x0: number, x1: number, gaps: number[]): void {
  const cuts = [...gaps].sort((a, b) => a - b).flatMap((g) => [g - DOOR_W / 2, g + DOOR_W / 2]);
  const pts = [x0, ...cuts, x1];
  for (let i = 0; i < pts.length; i += 2) if (pts[i + 1] - pts[i] > 0.01) out.push({ x: (pts[i] + pts[i + 1]) / 2, z, hw: (pts[i + 1] - pts[i]) / 2, hd: WALL_T / 2, rot: 0 });
}

/** Where the doors from the middle into the back rooms are (z), on both floors. */
export const roomDoorZ = (d: number): number => -d / 2 + 2.6;

const cache = new Map<string, HouseLayout>();

function mkStairs(midX: number, halfW: number, zTop: number, len: number): Stairs {
  return { x0: midX - halfW, x1: midX + halfW, zTop, zBottom: zTop + len };
}

type Built = { stairs: Stairs; rooms: Room[]; walls: [RectCollider[], RectCollider[]]; door: { x: number; z: number } };

/** Classic cosy cottage: centre stairs, two back bedrooms + bath, open living. */
function planHytte(w: number, d: number): Built {
  const stairs = mkStairs(0, 1.4, -d / 2 + 4.2, 8);
  const ax = w / 2 - 7;
  const bz = -d / 2 + 7;
  const doorZ = roomDoorZ(d);
  const f0: RectCollider[] = [];
  const f1: RectCollider[] = [];
  for (const out of [f0, f1]) {
    wallX(out, -ax, -d / 2, bz, [doorZ]);
    wallX(out, ax, -d / 2, bz, [doorZ]);
    wallZ(out, bz, -w / 2, -ax, []);
    wallZ(out, bz, ax, w / 2, []);
  }
  wallX(f1, 0, d / 2 - 7, d / 2, [d / 2 - 3.6]);
  const rooms: Room[] = [
    { id: 'f0-sove', name: 'Soverom', floor: 0, x0: -w / 2, x1: -ax, z0: -d / 2, z1: bz },
    { id: 'f0-bad', name: 'Bad', floor: 0, x0: ax, x1: w / 2, z0: -d / 2, z1: bz },
    { id: 'f0-gang', name: 'Gang', floor: 0, x0: -ax, x1: ax, z0: -d / 2, z1: bz },
    { id: 'f0-stue', name: 'Stue og kjøkken', floor: 0, x0: -w / 2, x1: w / 2, z0: bz, z1: d / 2 },
    { id: 'f1-sove', name: 'Soverom 2', floor: 1, x0: -w / 2, x1: -ax, z0: -d / 2, z1: bz },
    { id: 'f1-lek', name: 'Lekerom', floor: 1, x0: ax, x1: w / 2, z0: -d / 2, z1: bz },
    { id: 'f1-gang', name: 'Gang', floor: 1, x0: -ax, x1: ax, z0: -d / 2, z1: d / 2 - 7 },
    { id: 'f1-gjest', name: 'Gjesterom', floor: 1, x0: -w / 2, x1: 0, z0: d / 2 - 7, z1: d / 2 },
    { id: 'f1-hobby', name: 'Hobbyrom', floor: 1, x0: 0, x1: w / 2, z0: d / 2 - 7, z1: d / 2 },
  ];
  return { stairs, rooms, walls: [f0, f1], door: { x: 0, z: d / 2 - 1.4 } };
}




/**
 * Shared connected skeleton (same topology as the working hytte):
 * back left/right rooms + middle hall + open living downstairs;
 * matching upstairs + two front rooms. Stairs ALWAYS sit inside the
 * middle hall strip so they never trap a side room.
 */
function planFromSkeleton(
  w: number,
  d: number,
  opts: {
    /** Stairs mid-X; must stay inside (-ax+halfW, ax-halfW). */
    stairSide: 'left' | 'right' | 'center';
    stairHalfW: number;
    stairZTopPad: number;
    stairLen: number;
    /** Depth/width of each back corner room. */
    room: number;
    frontRoom: number;
    doorX: number;
    /** Optional living-room partial wall with a door gap (never a sealed pocket). */
    livingDivider?: boolean;
    names: {
      sleep: string;
      bath: string;
      living: string;
      sleep2: string;
      play: string;
      guest: string;
      hobby: string;
      hall: string;
      hallUp?: string;
    };
  },
): Built {
  const room = Math.min(opts.room, Math.min(w, d) * 0.38);
  const frontDepth = Math.min(opts.frontRoom, d * 0.4);
  const ax = w / 2 - room;
  const bz = -d / 2 + room;
  const halfW = opts.stairHalfW;
  // Keep a 0.35m clearance from the hall side-walls so stairs never clip into bedrooms.
  const maxOffset = Math.max(0, ax - halfW - 0.35);
  let midX = 0;
  if (opts.stairSide === 'left') midX = -maxOffset;
  else if (opts.stairSide === 'right') midX = maxOffset;
  const zTop = -d / 2 + opts.stairZTopPad;
  const stairs = mkStairs(midX, halfW, zTop, opts.stairLen);
  const doorZ = roomDoorZ(d);
  const f0: RectCollider[] = [];
  const f1: RectCollider[] = [];
  for (const out of [f0, f1]) {
    wallX(out, -ax, -d / 2, bz, [doorZ]);
    wallX(out, ax, -d / 2, bz, [doorZ]);
    wallZ(out, bz, -w / 2, -ax, []);
    wallZ(out, bz, ax, w / 2, []);
  }
  // Upstairs front rooms split down the middle with a door gap.
  wallX(f1, 0, d / 2 - frontDepth, d / 2, [d / 2 - Math.min(3.6, frontDepth * 0.55)]);
  // Living-room L-divider (floor 0 only): wall stub with a wide gap so the whole living stays one connected component.
  if (opts.livingDivider) {
    const divX = w / 2 - room * 0.55;
    wallX(f0, divX, bz + 2.2, d / 2 - 1.5, [bz + 4.5]);
  }
  const rooms: Room[] = [
    { id: 'f0-sove', name: opts.names.sleep, floor: 0, x0: -w / 2, x1: -ax, z0: -d / 2, z1: bz },
    { id: 'f0-bad', name: opts.names.bath, floor: 0, x0: ax, x1: w / 2, z0: -d / 2, z1: bz },
    { id: 'f0-gang', name: opts.names.hall, floor: 0, x0: -ax, x1: ax, z0: -d / 2, z1: bz },
    { id: 'f0-stue', name: opts.names.living, floor: 0, x0: -w / 2, x1: w / 2, z0: bz, z1: d / 2 },
    { id: 'f1-sove', name: opts.names.sleep2, floor: 1, x0: -w / 2, x1: -ax, z0: -d / 2, z1: bz },
    { id: 'f1-lek', name: opts.names.play, floor: 1, x0: ax, x1: w / 2, z0: -d / 2, z1: bz },
    { id: 'f1-gang', name: opts.names.hallUp ?? 'Gang', floor: 1, x0: -ax, x1: ax, z0: -d / 2, z1: d / 2 - frontDepth },
    { id: 'f1-gjest', name: opts.names.guest, floor: 1, x0: -w / 2, x1: 0, z0: d / 2 - frontDepth, z1: d / 2 },
    { id: 'f1-hobby', name: opts.names.hobby, floor: 1, x0: 0, x1: w / 2, z0: d / 2 - frontDepth, z1: d / 2 },
  ];
  return { stairs, rooms, walls: [f0, f1], door: { x: opts.doorX, z: d / 2 - 1.4 } };
}

/** Rosa villa: wide left stairs, larger back rooms, salon names. */
function planVilla(w: number, d: number): Built {
  return planFromSkeleton(w, d, {
    stairSide: 'left',
    stairHalfW: 1.55,
    stairZTopPad: 3.8,
    stairLen: 9,
    room: 6.4,
    frontRoom: 7.2,
    doorX: -2.5,
    livingDivider: true,
    names: {
      sleep: 'Master',
      bath: 'Ensuite',
      living: 'Salon',
      sleep2: 'Gjesterom',
      play: 'Bibliotek',
      guest: 'Atelier',
      hobby: 'Boudoir',
      hall: 'Galleri',
      hallUp: 'Øvre galleri',
    },
  });
}

/** Gårdshus: right-side stairs, farm room names, living divider. */
function planGard(w: number, d: number): Built {
  return planFromSkeleton(w, d, {
    stairSide: 'right',
    stairHalfW: 1.3,
    stairZTopPad: 4.0,
    stairLen: 8.5,
    room: 7.2,
    frontRoom: 6.5,
    doorX: 2.2,
    livingDivider: true,
    names: {
      sleep: 'Soverom',
      bath: 'Vaskerom',
      living: 'Stue',
      sleep2: 'Barnerom',
      play: 'Verksted',
      guest: 'Lekerom',
      hobby: 'Forråd',
      hall: 'Entre',
    },
  });
}

/** Moderne: narrow «spiral-feel» stairs hard left in the hall. */
function planModerne(w: number, d: number): Built {
  return planFromSkeleton(w, d, {
    stairSide: 'left',
    stairHalfW: 1.05,
    stairZTopPad: 3.2,
    stairLen: 8.8,
    room: 5.6,
    frontRoom: 8.0,
    doorX: 0,
    livingDivider: false,
    names: {
      sleep: 'Soverom',
      bath: 'Bad',
      living: 'Åpen stue',
      sleep2: 'Kontor',
      play: 'Mediarom',
      guest: 'Loft øst',
      hobby: 'Loft vest',
      hall: 'Åpen gang',
      hallUp: 'Galleri',
    },
  });
}

/** Trehus: stairs slightly right of centre, forest cabin names. */
function planTrehus(w: number, d: number): Built {
  return planFromSkeleton(w, d, {
    stairSide: 'right',
    stairHalfW: 1.35,
    stairZTopPad: 4.2,
    stairLen: 8,
    room: 6.8,
    frontRoom: 6.4,
    doorX: -1.2,
    livingDivider: false,
    names: {
      sleep: 'Soverom',
      bath: 'Bad',
      living: 'Stue og kjøkken',
      sleep2: 'Loftsrom',
      play: 'Lekerom',
      guest: 'Gjesterom',
      hobby: 'Hobbyrom',
      hall: 'Gang',
    },
  });
}

/** Sjøhus: right stairs, nautical names, living divider like a bulkhead. */
function planSjohus(w: number, d: number): Built {
  return planFromSkeleton(w, d, {
    stairSide: 'right',
    stairHalfW: 1.2,
    stairZTopPad: 3.5,
    stairLen: 9.0,
    room: 5.8,
    frontRoom: 7.0,
    doorX: 1.4,
    livingDivider: true,
    names: {
      sleep: 'Lugar',
      bath: 'Bad',
      living: 'Stue',
      sleep2: 'Kapteinslugar',
      play: 'Fiskebu',
      guest: 'Utsikt',
      hobby: 'Bro',
      hall: 'Dekk',
      hallUp: 'Øvre dekk',
    },
  });
}

/** Eventyrslott: grand wide centre stairs, palace names. */
function planSlott(w: number, d: number): Built {
  return planFromSkeleton(w, d, {
    stairSide: 'center',
    stairHalfW: 2.4,
    stairZTopPad: 3.6,
    stairLen: 10,
    room: 8.5,
    frontRoom: 8.0,
    doorX: 0,
    livingDivider: true,
    names: {
      sleep: 'Kongesuite',
      bath: 'Tronsal',
      living: 'Festsal',
      sleep2: 'Ballsal',
      play: 'Skattkammer',
      guest: 'Vesttårn',
      hobby: 'Østtårn',
      hall: 'Vestibyle',
      hallUp: 'Galleri',
    },
  });
}

function buildPlan(style: HouseStyle, w: number, d: number): Built {
  switch (style) {
    case 'villa':
      return planVilla(w, d);
    case 'gard':
      return planGard(w, d);
    case 'moderne':
      return planModerne(w, d);
    case 'trehus':
      return planTrehus(w, d);
    case 'sjohus':
      return planSjohus(w, d);
    case 'slott':
      return planSlott(w, d);
    default:
      return planHytte(w, d);
  }
}

export function houseLayout(style: HouseStyle): HouseLayout {
  const hit = cache.get(style);
  if (hit) return hit;
  const info = HOUSE_BY_STYLE[style] ?? HOUSE_BY_STYLE.hytte;
  const { w, d } = info;
  const built = buildPlan(style, w, d);
  // Keep stairs inside the footprint with clear step-off room.
  const s = built.stairs;
  if (s.x0 < -w / 2 + 0.5 || s.x1 > w / 2 - 0.5) throw new Error(`stairs out of width for ${style}`);
  if (s.zTop < -d / 2 + 1.5 || s.zBottom > d / 2 - 1.5) throw new Error(`stairs out of depth for ${style}`);
  const layout: HouseLayout = { style, w, d, stairs: s, rooms: built.rooms, walls: built.walls, door: built.door };
  cache.set(style, layout);
  return layout;
}

/** Test helper: drop cached plans (vitest module reuse). */
export function clearLayoutCache(): void {
  cache.clear();
}

export const floorOfY = (y: number): number => (y > FLOOR_H * 0.5 ? 1 : 0);

const stairsRect = (s: Stairs): RectCollider => {
  const mx = stairsMidX(s);
  return { x: mx, z: (s.zTop + s.zBottom) / 2, hw: (s.x1 - s.x0) / 2, hd: (s.zBottom - s.zTop) / 2, rot: 0 };
};
export const onStairs = (s: Stairs, x: number, z: number): boolean => x > s.x0 && x < s.x1 && z > s.zTop && z < s.zBottom;

/** Height of the walkable ground at a spot, for a walker currently on `floor`. The stairs are a ramp. */
export function groundHeight(l: HouseLayout, x: number, z: number, floor: number): number {
  const s = l.stairs;
  if (onStairs(s, x, z)) return Math.max(0, Math.min(1, (s.zBottom - z) / (s.zBottom - s.zTop))) * FLOOR_H;
  return floor >= 1 ? FLOOR_H : 0;
}

/** The staircase's side rails (both floors) and a cap at the end you can't enter from this floor. */
function stairBarriers(l: HouseLayout, floor: number): RectCollider[] {
  const s = l.stairs;
  const mx = stairsMidX(s);
  const len = (s.zBottom - s.zTop) / 2;
  const cz = (s.zTop + s.zBottom) / 2;
  const rails: RectCollider[] = [-1, 1].map((side) => ({ x: side < 0 ? s.x0 - 0.12 : s.x1 + 0.12, z: cz, hw: 0.12, hd: len, rot: 0 }));
  const capW = (s.x1 - s.x0) / 2 + 0.24;
  const cap: RectCollider = floor === 0 ? { x: mx, z: s.zTop - 0.12, hw: capW, hd: 0.12, rot: 0 } : { x: mx, z: s.zBottom + 0.12, hw: capW, hd: 0.12, rot: 0 };
  return [...rails, cap];
}

/** What stops a walker on this floor: partition walls and the staircase barriers (furniture is added by the interior). */
export function floorColliders(l: HouseLayout, floor: number): Colliders {
  return { rects: [...l.walls[Math.min(FLOORS - 1, floor)], ...stairBarriers(l, floor)], circles: [] };
}

/** Where furniture may not stand on a floor: walls, and the stairs and the hole above them. */
function itemBlockers(l: HouseLayout, floor: number): Colliders {
  return { rects: [...l.walls[Math.min(FLOORS - 1, floor)], stairsRect(l.stairs)], circles: [] };
}

export const itemRadius = (size: number, scale: number): number => Math.max(0.3, size * scale * 0.5 * 0.9);

/** Which room a point is in (or null in a doorway or outside). */
export function roomAt(l: HouseLayout, floor: number, x: number, z: number): Room | null {
  let best: Room | null = null;
  for (const r of l.rooms) {
    if (r.floor !== floor || x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
    if (!best || (r.x1 - r.x0) * (r.z1 - r.z0) < (best.x1 - best.x0) * (best.z1 - best.z0)) best = r;
  }
  return best;
}

function keepInside(l: HouseLayout, x: number, z: number, r: number): { x: number; z: number } {
  const lim = (half: number) => Math.max(0, half - Math.max(MARGIN, r * 0.6));
  return { x: Math.max(-lim(l.w / 2), Math.min(lim(l.w / 2), x)), z: Math.max(-lim(l.d / 2), Math.min(lim(l.d / 2), z)) };
}

/** Put furniture of radius r at (x,z) on a floor: inside the house and out of every wall and the stairs. */
export function placeInLayout(l: HouseLayout, floor: number, x: number, z: number, r: number): { x: number; z: number } {
  const c = itemBlockers(l, floor);
  let p = keepInside(l, x, z, r);
  for (let i = 0; i < 3; i++) {
    const pos = { x: p.x, y: 0, z: p.z };
    resolve(pos, r, c, 6);
    p = keepInside(l, pos.x, pos.z, r);
  }
  return p;
}

/**
 * Drag furniture from one spot to another. It slides along walls instead of jumping through them,
 * so you can't push a sofa from one room to the next except through the doorway.
 */
export function moveInLayout(l: HouseLayout, floor: number, from: { x: number; z: number }, to: { x: number; z: number }, r: number): { x: number; z: number } {
  const c = itemBlockers(l, floor);
  const pos = { x: from.x, y: 0, z: from.z };
  movePlayer(pos, to.x - from.x, to.z - from.z, r, c, undefined, 0.15);
  return keepInside(l, pos.x, pos.z, r);
}

/** True if furniture of radius r would overlap a wall or the stairs here. */
export function itemBlocked(l: HouseLayout, floor: number, x: number, z: number, r: number): boolean {
  return blocked(x, z, r, itemBlockers(l, floor));
}

/** Preferred centre of a named room (or null). */
export function roomCenter(l: HouseLayout, floor: number, nameMatch: RegExp): { x: number; z: number } | null {
  const r = l.rooms.find((q) => q.floor === floor && nameMatch.test(q.name));
  if (!r) return null;
  return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
}
