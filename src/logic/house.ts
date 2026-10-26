import { FURN_BY_ID, HOUSE_BY_STYLE, type HouseStyle } from './catalog.ts';
import type { CareWhere } from './needs.ts';
import { uid } from './rng.ts';

export interface PlacedItem {
  uid: string;
  itemId: string;
  /** Room-local position in metres; (0,0) is the room centre, the door is at +z. */
  x: number;
  z: number;
  /** Radians. */
  rot: number;
  scale: number;
  color: string;
}

export interface House {
  id: string;
  style: HouseStyle;
  /** Multiplayer stub: the owner and the players allowed to build here. */
  ownerId: string;
  editors: string[];
  editRequests: string[];
  wallColor: string;
  floorColor: string;
  items: PlacedItem[];
  createdAt: number;
}

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 2;
const MARGIN = 0.4;

export function roomSize(style: HouseStyle): { w: number; d: number } {
  const h = HOUSE_BY_STYLE[style] ?? HOUSE_BY_STYLE.hytte;
  return { w: h.w, d: h.d };
}

export function newHouse(style: HouseStyle, ownerId: string, now = Date.now()): House {
  const { w, d } = roomSize(style);
  const items: PlacedItem[] = [
    { uid: uid('it'), itemId: 'dyreseng', x: -w / 2 + 2, z: -d / 2 + 2, rot: 0, scale: 1, color: '#ffb84d' },
    { uid: uid('it'), itemId: 'badekar', x: w / 2 - 2.2, z: -d / 2 + 1.6, rot: 0, scale: 1, color: '#ffffff' },
    { uid: uid('it'), itemId: 'rundtteppe', x: 0, z: 0, rot: 0, scale: 1, color: '#ff9ccf' },
    { uid: uid('it'), itemId: 'potteplante', x: w / 2 - 1, z: d / 2 - 1.2, rot: 0, scale: 1, color: '#5cc36b' },
  ];
  return { id: uid('house'), style, ownerId, editors: [], editRequests: [], wallColor: '#fff1e0', floorColor: '#d9a066', items, createdAt: now };
}

export function canEdit(house: House, playerId: string): boolean {
  return house.ownerId === playerId || house.editors.includes(playerId);
}
export function requestEdit(house: House, playerId: string): House {
  if (canEdit(house, playerId) || house.editRequests.includes(playerId)) return house;
  return { ...house, editRequests: [...house.editRequests, playerId] };
}
/** Only the owner can let someone build. */
export function grantEdit(house: House, byId: string, playerId: string): House {
  if (byId !== house.ownerId || house.editors.includes(playerId)) return house;
  return { ...house, editors: [...house.editors, playerId], editRequests: house.editRequests.filter((p) => p !== playerId) };
}
export function revokeEdit(house: House, byId: string, playerId: string): House {
  if (byId !== house.ownerId) return house;
  return { ...house, editors: house.editors.filter((p) => p !== playerId) };
}

export function clampToRoom(style: HouseStyle, x: number, z: number): { x: number; z: number } {
  const { w, d } = roomSize(style);
  const cx = w / 2 - MARGIN;
  const cz = d / 2 - MARGIN;
  return { x: Math.max(-cx, Math.min(cx, x)), z: Math.max(-cz, Math.min(cz, z)) };
}

/** Move a wall item onto the nearest wall, facing into the room. The front wall (with the door) is skipped. */
export function snapToWall(style: HouseStyle, x: number, z: number): { x: number; z: number; rot: number } {
  const { w, d } = roomSize(style);
  const p = clampToRoom(style, x, z);
  const inset = 0.08;
  const options = [
    { dist: Math.abs(p.z + d / 2), x: p.x, z: -d / 2 + inset, rot: 0 },
    { dist: Math.abs(p.x + w / 2), x: -w / 2 + inset, z: p.z, rot: Math.PI / 2 },
    { dist: Math.abs(p.x - w / 2), x: w / 2 - inset, z: p.z, rot: -Math.PI / 2 },
  ];
  options.sort((a, b) => a.dist - b.dist);
  const { x: sx, z: sz, rot } = options[0];
  return { x: sx, z: sz, rot };
}

function fit(style: HouseStyle, item: PlacedItem): PlacedItem {
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Number.isFinite(item.scale) ? item.scale : 1));
  if (FURN_BY_ID[item.itemId]?.wall) return { ...item, scale, ...snapToWall(style, item.x, item.z) };
  return { ...item, scale, ...clampToRoom(style, item.x, item.z) };
}

export function placeItem(house: House, itemId: string, x = 0, z = 0, color?: string): House {
  const def = FURN_BY_ID[itemId];
  if (!def) return house;
  const item = fit(house.style, { uid: uid('it'), itemId, x, z, rot: 0, scale: 1, color: color ?? def.color });
  return { ...house, items: [...house.items, item] };
}

export function updateItem(house: House, itemUid: string, patch: Partial<Omit<PlacedItem, 'uid' | 'itemId'>>): House {
  return { ...house, items: house.items.map((it) => (it.uid === itemUid ? fit(house.style, { ...it, ...patch }) : it)) };
}

export function rotateItem(house: House, itemUid: string): House {
  const it = house.items.find((i) => i.uid === itemUid);
  if (!it || FURN_BY_ID[it.itemId]?.wall) return house;
  const rot = (it.rot + Math.PI / 4) % (Math.PI * 2);
  return updateItem(house, itemUid, { rot });
}

export function removeItem(house: House, itemUid: string): { house: House; itemId: string | null } {
  const it = house.items.find((i) => i.uid === itemUid);
  if (!it) return { house, itemId: null };
  return { house: { ...house, items: house.items.filter((i) => i.uid !== itemUid) }, itemId: it.itemId };
}

/** Placed items that give a kind of care, e.g. beds for sleep. */
export function careItems(house: House, where: CareWhere): PlacedItem[] {
  return house.items.filter((i) => FURN_BY_ID[i.itemId]?.care === where);
}

export function serializeHouse(house: House): string {
  return JSON.stringify(house);
}

export function deserializeHouse(json: string): House | null {
  try {
    const raw = JSON.parse(json) as Partial<House>;
    if (!raw || typeof raw.id !== 'string' || typeof raw.ownerId !== 'string' || !raw.style || !HOUSE_BY_STYLE[raw.style]) return null;
    const style = raw.style;
    const items = (Array.isArray(raw.items) ? raw.items : [])
      .filter((i) => i && FURN_BY_ID[i.itemId] && typeof i.uid === 'string')
      .map((i) => fit(style, { uid: i.uid, itemId: i.itemId, x: Number(i.x) || 0, z: Number(i.z) || 0, rot: Number(i.rot) || 0, scale: Number(i.scale) || 1, color: typeof i.color === 'string' ? i.color : FURN_BY_ID[i.itemId].color }));
    return {
      id: raw.id,
      style,
      ownerId: raw.ownerId,
      editors: Array.isArray(raw.editors) ? raw.editors.filter((e) => typeof e === 'string') : [],
      editRequests: Array.isArray(raw.editRequests) ? raw.editRequests.filter((e) => typeof e === 'string') : [],
      wallColor: typeof raw.wallColor === 'string' ? raw.wallColor : '#fff1e0',
      floorColor: typeof raw.floorColor === 'string' ? raw.floorColor : '#d9a066',
      items,
      createdAt: Number(raw.createdAt) || Date.now(),
    };
  } catch {
    return null;
  }
}
