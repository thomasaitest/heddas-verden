import { HOUSES, ITEM_BY_ID } from './catalog.ts';
import { deserializeHouse, newHouse, type House } from './house.ts';
import type { PetState } from './needs.ts';
import { SPECIES_BY_ID } from './pets.ts';
import { uid } from './rng.ts';

export interface SaveData {
  version: 1;
  playerId: string;
  points: number;
  pets: PetState[];
  /** Bought furniture and decorations not placed in a house yet. */
  inventory: Record<string, number>;
  houses: House[];
  activeHouseId: string;
  /** Pet that follows the player between screens. */
  followerUid: string | null;
  /** Pet uid waiting for its egg to hatch. */
  pendingReveal: string | null;
  starterGiven: boolean;
  stats: { games: number; wins: number; needs: number };
  sound: boolean;
}

export const SAVE_KEY = 'petdoors-save-v1';
export const START_POINTS = 40;

export function freshSave(now = Date.now()): SaveData {
  const playerId = uid('player');
  const house = newHouse('cottage', playerId, now);
  return {
    version: 1,
    playerId,
    points: START_POINTS,
    pets: [],
    inventory: { plant: 1, rug: 1, beanbag: 1 },
    houses: [house],
    activeHouseId: house.id,
    followerUid: null,
    pendingReveal: null,
    starterGiven: false,
    stats: { games: 0, wins: 0, needs: 0 },
    sound: true,
  };
}

/** Parse and repair a stored save. Unknown pets or items are dropped instead of crashing the game. */
export function parseSave(json: string | null, now = Date.now()): SaveData {
  if (!json) return freshSave(now);
  try {
    const raw = JSON.parse(json) as Partial<SaveData>;
    if (!raw || raw.version !== 1 || typeof raw.playerId !== 'string') return freshSave(now);
    const base = freshSave(now);
    const houses = (raw.houses ?? []).map((h) => deserializeHouse(JSON.stringify(h))).filter((h): h is House => !!h);
    const save: SaveData = {
      ...base,
      ...raw,
      version: 1,
      points: Math.max(0, Math.floor(Number(raw.points) || 0)),
      pets: (raw.pets ?? [])
        .filter((p) => p && SPECIES_BY_ID[p.speciesId])
        .map((p) => ({ ...p, need: p.need ?? null, growth: p.growth ?? 0, nextNeedAt: p.nextNeedAt ?? now })),
      inventory: Object.fromEntries(Object.entries(raw.inventory ?? {}).filter(([id, n]) => ITEM_BY_ID[id] && n > 0)),
      houses: houses.length ? houses : [newHouse('cottage', raw.playerId, now)],
      stats: { ...base.stats, ...(raw.stats ?? {}) },
    };
    if (!save.houses.some((h) => h.id === save.activeHouseId)) save.activeHouseId = save.houses[0].id;
    if (save.followerUid && !save.pets.some((p) => p.uid === save.followerUid)) save.followerUid = null;
    if (save.pendingReveal && !save.pets.some((p) => p.uid === save.pendingReveal)) save.pendingReveal = null;
    return save;
  } catch {
    return freshSave(now);
  }
}

export function ownsHouseStyle(save: SaveData, houseItemId: string): boolean {
  const info = HOUSES.find((h) => h.id === houseItemId);
  return !!info && save.houses.some((h) => h.style === info.style);
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadSave(storage: StorageLike): SaveData {
  return parseSave(storage.getItem(SAVE_KEY));
}

export function writeSave(storage: StorageLike, save: SaveData): void {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* storage full or private mode: keep playing in memory */
  }
}
