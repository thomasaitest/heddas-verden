import { HOUSE_BY_STYLE, type HouseStyle } from './catalog.ts';
import { blocked, movePlayer, resolve, type Colliders, type RectCollider } from './collision.ts';

/**
 * Floor plans for the houses: rooms with walls and door gaps on two floors joined by a staircase.
 * Pure data and maths (no three.js) so walking, stairs and furniture placement can be tested.
 * Coordinates are house-local metres: (0,0) is the middle, the front door is on the +z side.
 */
export const FLOORS = 2;
/** Height between two floors. */
export const FLOOR_H = 6.6;
export const WALL_T = 0.4;
export const DOOR_W = 2.8;
/** Width/depth of the corner rooms. */
export const ROOM = 7;
const STAIR_LEN = 8;
const STAIR_HALF_W = 1.4;
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

/** Per-style plan knobs so each house feels different inside. */
function planParams(style: HouseStyle): {
  room: number;
  frontRoom: number;
  sideNook: boolean;
  names: { sleep: string; play: string; guest: string; hobby: string; living: string };
} {
  switch (style) {
    case 'villa':
      return { room: 8, frontRoom: 7.5, sideNook: false, names: { sleep: 'Master', play: 'Bad 2', guest: 'Gjesterom', hobby: 'Bibliotek', living: 'Stue og kjøkken' } };
    case 'gard':
      return { room: 6.2, frontRoom: 6, sideNook: true, names: { sleep: 'Soverom', play: 'Vaskerom', guest: 'Barnerom', hobby: 'Verksted', living: 'Stue' } };
    case 'moderne':
      return { room: 5.5, frontRoom: 8.5, sideNook: true, names: { sleep: 'Soverom', play: 'Bad', guest: 'Kontor', hobby: 'Mediarom', living: 'Åpen stue' } };
    case 'trehus':
      return { room: 7.4, frontRoom: 6.8, sideNook: false, names: { sleep: 'Soverom', play: 'Lekerom', guest: 'Gjesterom', hobby: 'Hobbyrom', living: 'Stue og kjøkken' } };
    case 'sjohus':
      return { room: 6, frontRoom: 7.2, sideNook: true, names: { sleep: 'Soverom', play: 'Bad', guest: 'Utsikt', hobby: 'Fiskebu', living: 'Stue' } };
    case 'slott':
      return { room: 9, frontRoom: 8, sideNook: true, names: { sleep: 'Kongesuite', play: 'Tronsal', guest: 'Ballsal', hobby: 'Skattkammer', living: 'Festsal' } };
    default: // hytte
      return { room: 7, frontRoom: 7, sideNook: false, names: { sleep: 'Soverom', play: 'Lekerom', guest: 'Gjesterom', hobby: 'Hobbyrom', living: 'Stue og kjøkken' } };
  }
}

export function houseLayout(style: HouseStyle): HouseLayout {
  const hit = cache.get(style);
  if (hit) return hit;
  const info = HOUSE_BY_STYLE[style] ?? HOUSE_BY_STYLE.hytte;
  const { w, d } = info;
  const plan = planParams(style);
  const room = Math.min(plan.room, d * 0.42);
  const frontDepth = Math.min(plan.frontRoom, d * 0.4);
  const zTop = -d / 2 + 4.2;
  const stairs: Stairs = { x0: -STAIR_HALF_W, x1: STAIR_HALF_W, zTop, zBottom: zTop + STAIR_LEN };
  const ax = w / 2 - room;
  const bz = -d / 2 + room;
  const floor0: RectCollider[] = [];
  const floor1: RectCollider[] = [];
  for (const out of [floor0, floor1]) {
    wallX(out, -ax, -d / 2, bz, [roomDoorZ(d)]);
    wallX(out, ax, -d / 2, bz, [roomDoorZ(d)]);
    wallZ(out, bz, -w / 2, -ax, []);
    wallZ(out, bz, ax, w / 2, []);
  }
  // Optional living-room side wall (does not enclose a pocket — leaves a wide gap so the whole stue stays reachable)
  if (plan.sideNook) {
    const nookX = w / 2 - 4.5;
    wallX(floor0, nookX, bz + 2.0, d / 2 - 1.5, []); // solid stub wall, open at both ends of the living room
  }
  // Upstairs front split (depth varies by style)
  wallX(floor1, 0, d / 2 - frontDepth, d / 2, [d / 2 - 3.6]);
  // Extra hall cross-wall for some styles (door at centre so stairs remain reachable)
  if (style === 'moderne' || style === 'slott' || style === 'sjohus') {
    wallZ(floor1, d / 2 - frontDepth, -ax, ax, [0]);
  }
  const rooms: Room[] = [
    { id: 'f0-sove', name: plan.names.sleep, floor: 0, x0: -w / 2, x1: -ax, z0: -d / 2, z1: bz },
    { id: 'f0-bad', name: 'Bad', floor: 0, x0: ax, x1: w / 2, z0: -d / 2, z1: bz },
    { id: 'f0-gang', name: 'Gang', floor: 0, x0: -ax, x1: ax, z0: -d / 2, z1: bz },
    { id: 'f0-stue', name: plan.names.living, floor: 0, x0: -w / 2, x1: w / 2, z0: bz, z1: d / 2 },
    { id: 'f1-sove', name: 'Soverom 2', floor: 1, x0: -w / 2, x1: -ax, z0: -d / 2, z1: bz },
    { id: 'f1-lek', name: plan.names.play, floor: 1, x0: ax, x1: w / 2, z0: -d / 2, z1: bz },
    { id: 'f1-gang', name: 'Gang', floor: 1, x0: -ax, x1: ax, z0: -d / 2, z1: d / 2 - frontDepth },
    { id: 'f1-gjest', name: plan.names.guest, floor: 1, x0: -w / 2, x1: 0, z0: d / 2 - frontDepth, z1: d / 2 },
    { id: 'f1-hobby', name: plan.names.hobby, floor: 1, x0: 0, x1: w / 2, z0: d / 2 - frontDepth, z1: d / 2 },
  ];
  const layout: HouseLayout = { style, w, d, stairs, rooms, walls: [floor0, floor1], door: { x: 0, z: d / 2 - 1.4 } };
  cache.set(style, layout);
  return layout;
}

export const floorOfY = (y: number): number => (y > FLOOR_H * 0.5 ? 1 : 0);

const stairsRect = (s: Stairs): RectCollider => ({ x: 0, z: (s.zTop + s.zBottom) / 2, hw: (s.x1 - s.x0) / 2, hd: (s.zBottom - s.zTop) / 2, rot: 0 });
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
  const len = (s.zBottom - s.zTop) / 2;
  const cz = (s.zTop + s.zBottom) / 2;
  const rails: RectCollider[] = [-1, 1].map((side) => ({ x: side < 0 ? s.x0 - 0.12 : s.x1 + 0.12, z: cz, hw: 0.12, hd: len, rot: 0 }));
  const capW = (s.x1 - s.x0) / 2 + 0.24;
  const cap: RectCollider = floor === 0 ? { x: 0, z: s.zTop - 0.12, hw: capW, hd: 0.12, rot: 0 } : { x: 0, z: s.zBottom + 0.12, hw: capW, hd: 0.12, rot: 0 };
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
  // a little extra clearance, so the item never ends up touching a wall's far side
  movePlayer(pos, to.x - from.x, to.z - from.z, r, c, undefined, 0.15);
  return keepInside(l, pos.x, pos.z, r);
}

/** True if furniture of radius r would overlap a wall or the stairs here. */
export function itemBlocked(l: HouseLayout, floor: number, x: number, z: number, r: number): boolean {
  return blocked(x, z, r, itemBlockers(l, floor));
}
