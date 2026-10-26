import { HOUSES, ITEM_BY_ID, type FloorType, type HouseStyle, type WallPattern } from './catalog.ts';
import { uid } from './rng.ts';

export interface PlacedItem {
  uid: string;
  itemId: string;
  /** Centre position in % of the room (0–100). */
  x: number;
  y: number;
  scale: number;
  color: string;
  note?: string;
}

/**
 * Multiplayer is not in v1, but houses already carry an owner and a permission list
 * so a later sync backend can enforce "only build with the owner's permission".
 */
export interface HousePermissions {
  ownerId: string;
  editors: string[];
  requests: string[];
}

export interface House {
  id: string;
  style: HouseStyle;
  name: string;
  wallColor: string;
  wallPattern: WallPattern;
  floor: FloorType;
  items: PlacedItem[];
  permissions: HousePermissions;
  updatedAt: number;
}

export const STYLE_DEFAULTS: Record<HouseStyle, { wallColor: string; wallPattern: WallPattern; floor: FloorType }> = {
  cottage: { wallColor: '#fff1e0', wallPattern: 'dots', floor: 'wood' },
  apartment: { wallColor: '#e4f4ff', wallPattern: 'plain', floor: 'tiles' },
  farmhouse: { wallColor: '#ffd6c4', wallPattern: 'stripes', floor: 'wood' },
  treehouse: { wallColor: '#e8ffe4', wallPattern: 'plain', floor: 'grass' },
};

export function newHouse(style: HouseStyle, ownerId: string, now = Date.now()): House {
  const info = HOUSES.find((h) => h.style === style)!;
  return {
    id: uid('house'),
    style,
    name: info.name,
    ...STYLE_DEFAULTS[style],
    items: [],
    permissions: { ownerId, editors: [], requests: [] },
    updatedAt: now,
  };
}

export function canEdit(house: House, userId: string): boolean {
  return house.permissions.ownerId === userId || house.permissions.editors.includes(userId);
}

export function requestEdit(house: House, userId: string): House {
  if (canEdit(house, userId) || house.permissions.requests.includes(userId)) return house;
  return { ...house, permissions: { ...house.permissions, requests: [...house.permissions.requests, userId] } };
}

/** Only the owner can grant; granting removes the pending request. */
export function grantEdit(house: House, byUserId: string, userId: string): House {
  if (house.permissions.ownerId !== byUserId || userId === byUserId) return house;
  const p = house.permissions;
  return {
    ...house,
    permissions: { ...p, editors: p.editors.includes(userId) ? p.editors : [...p.editors, userId], requests: p.requests.filter((r) => r !== userId) },
  };
}

export function revokeEdit(house: House, byUserId: string, userId: string): House {
  if (house.permissions.ownerId !== byUserId) return house;
  return { ...house, permissions: { ...house.permissions, editors: house.permissions.editors.filter((e) => e !== userId) } };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Edits below are no-ops for users without permission. */
export function placeItem(house: House, userId: string, itemId: string, x = 50, y = 70): { house: House; placed: PlacedItem | null } {
  const item = ITEM_BY_ID[itemId];
  if (!item || item.kind === 'house' || !canEdit(house, userId)) return { house, placed: null };
  const placed: PlacedItem = { uid: uid('it'), itemId, x: clamp(x, 0, 100), y: clamp(item.wall ? Math.min(y, 40) : y, 0, 100), scale: 1, color: item.color ?? '#ffffff' };
  return { house: { ...house, items: [...house.items, placed], updatedAt: Date.now() }, placed };
}

export function updateItem(house: House, userId: string, itemUid: string, patch: Partial<Omit<PlacedItem, 'uid' | 'itemId'>>): House {
  if (!canEdit(house, userId)) return house;
  return {
    ...house,
    updatedAt: Date.now(),
    items: house.items.map((it) =>
      it.uid !== itemUid
        ? it
        : {
            ...it,
            ...patch,
            x: clamp(patch.x ?? it.x, 0, 100),
            y: clamp(patch.y ?? it.y, 0, 100),
            scale: clamp(patch.scale ?? it.scale, 0.5, 2.5),
          },
    ),
  };
}

export function removeItem(house: House, userId: string, itemUid: string): { house: House; removed: PlacedItem | null } {
  const removed = house.items.find((it) => it.uid === itemUid) ?? null;
  if (!removed || !canEdit(house, userId)) return { house, removed: null };
  return { house: { ...house, items: house.items.filter((it) => it.uid !== itemUid), updatedAt: Date.now() }, removed };
}

export function serializeHouse(house: House): string {
  return JSON.stringify(house);
}

export function deserializeHouse(json: string): House | null {
  try {
    const h = JSON.parse(json) as House;
    if (!h || typeof h.id !== 'string' || !Array.isArray(h.items) || !h.permissions?.ownerId) return null;
    if (!HOUSES.some((x) => x.style === h.style)) return null;
    h.items = h.items.filter((it) => it && typeof it.uid === 'string' && ITEM_BY_ID[it.itemId]);
    h.permissions.editors ??= [];
    h.permissions.requests ??= [];
    return h;
  } catch {
    return null;
  }
}
