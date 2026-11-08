import { cleanAvatar, DEFAULT_AVATAR, type Avatar } from './avatar.ts';
import { CAR_BY_ID, FOOD_BY_ID, FURN_BY_ID, PET_SHOP_BY_ID, POTIONS, STARTER_TOYS, TOY_BY_ID } from './catalog.ts';
import { EGG_BY_ID, FLIGHT_LESSONS, SPECIES_BY_ID } from './pets.ts';
import { deserializeHouse, ensureStarterFurniture, migrateFurnitureClearOfWalls, newHouse, type House } from './house.ts';
import { normalizeQuestLog, type QuestLog } from './missions.ts';
import { MAX_NEEDS, NEED_INFO, syncNeeds, type Need, type NeedKind, type PetState } from './needs.ts';
import { uid } from './rng.ts';

export interface SaveData {
  version: 1;
  playerId: string;
  bucks: number;
  avatar: Avatar;
  avatarDone: boolean;
  pets: PetState[];
  /** Pets following the player (max MAX_EQUIPPED). */
  equipped: string[];
  /** Unplaced furniture. */
  inventory: Record<string, number>;
  /** Food, drinks, eggs and potions in the backpack. */
  bag: Record<string, number>;
  houses: House[];
  activeHouseId: string;
  stats: { tasks: number; hatched: number; doorWins: number };
  sound: boolean;
  starterClaimed: boolean;
  /** The starter toys have been put in the backpack (older saves get them once). */
  toysGiven?: boolean;
  /** Oppdrag board. Missing on older saves — they start at the first two quests, nothing is marked done. */
  quests?: QuestLog;
}

export const SAVE_KEY = 'heddasverden-save-v1';
export const START_BUCKS = 150;
/** Only one pet follows the player at a time; starting a new follower sends the old one home. */
export const MAX_EQUIPPED = 1;

export function freshSave(now = Date.now()): SaveData {
  const playerId = uid('player');
  const house = newHouse('hytte', playerId, now);
  return {
    version: 1,
    playerId,
    bucks: START_BUCKS,
    avatar: { ...DEFAULT_AVATAR },
    avatarDone: false,
    pets: [],
    equipped: [],
    inventory: { sofa: 1, ball: 1 },
    bag: { eple: 2, vann: 2, ...Object.fromEntries(STARTER_TOYS.map((t) => [t, 1])) },
    houses: [house],
    activeHouseId: house.id,
    stats: { tasks: 0, hatched: 0, doorWins: 0 },
    sound: true,
    starterClaimed: false,
    toysGiven: true,
    quests: normalizeQuestLog(null, now),
  };
}

const isBagId = (id: string) => !!FOOD_BY_ID[id] || !!TOY_BY_ID[id] || !!EGG_BY_ID[id] || !!CAR_BY_ID[id] || !!PET_SHOP_BY_ID[id] || POTIONS.some((p) => p.id === id);
const counts = (raw: unknown, ok: (id: string) => boolean): Record<string, number> =>
  Object.fromEntries(
    Object.entries(raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {})
      .map(([k, v]) => [k, Math.floor(Number(v) || 0)] as const)
      .filter(([k, v]) => ok(k) && v > 0),
  );

/** Parse and repair a stored save. Unknown things are dropped instead of crashing the game. */
export function parseSave(json: string | null, now = Date.now()): SaveData {
  if (!json) return freshSave(now);
  try {
    const raw = JSON.parse(json) as Partial<SaveData>;
    if (!raw || raw.version !== 1 || typeof raw.playerId !== 'string') return freshSave(now);
    const base = freshSave(now);
    const houses = (Array.isArray(raw.houses) ? raw.houses : [])
      .map((h) => deserializeHouse(JSON.stringify(h)))
      .filter((h): h is House => !!h)
      .map((h) => migrateFurnitureClearOfWalls(ensureStarterFurniture(h)));
    const readNeed = (n: unknown): Need | null => {
      if (!n || typeof n !== 'object') return null;
      const kind = (n as { kind?: unknown }).kind;
      if (typeof kind !== 'string' || !(kind in NEED_INFO)) return null;
      return {
        kind: kind as NeedKind,
        since: Number((n as { since?: unknown }).since) || now,
        progress: Math.max(0, Math.min(1, Number((n as { progress?: unknown }).progress) || 0)),
      };
    };
    const pets: PetState[] = (Array.isArray(raw.pets) ? raw.pets : [])
      .filter((p) => p && typeof p.uid === 'string' && SPECIES_BY_ID[p.speciesId])
      .map((p) => {
        const flyable = !!p.flyable;
        const storedLessons = Number(p.flyLessons);
        const flyLessons = flyable ? FLIGHT_LESSONS : Math.max(0, Math.min(FLIGHT_LESSONS, Number.isFinite(storedLessons) ? Math.floor(storedLessons) : 0));
        const fromList = Array.isArray(p.needs) ? p.needs.map(readNeed).filter((n): n is Need => !!n).slice(0, MAX_NEEDS) : null;
        const legacy = readNeed(p.need);
        const base: PetState = {
          uid: p.uid,
          speciesId: p.speciesId,
          name: typeof p.name === 'string' ? p.name : SPECIES_BY_ID[p.speciesId].name,
          flyable,
          rideable: !!p.rideable,
          obtainedAt: Number(p.obtainedAt) || now,
          xp: Math.max(0, Math.floor(Number(p.xp) || 0)),
          need: legacy,
          nextNeedAt: Number(p.nextNeedAt) || now,
          lastNeed: typeof p.lastNeed === 'string' && p.lastNeed in NEED_INFO ? (p.lastNeed as NeedKind) : null,
          flyLessons,
          ...(Number(p.joy) > 0 ? { joy: Math.min(1, Number(p.joy)), joyAt: Number(p.joyAt) || now } : {}),
        };
        // Keep a single legacy need as-is until the game tick migrates it, so we don't stack extras on load.
        if (!fromList) return base;
        return syncNeeds(base, fromList);
      });
    const save: SaveData = {
      ...base,
      playerId: raw.playerId,
      bucks: Math.max(0, Math.floor(Number(raw.bucks) || 0)),
      avatar: cleanAvatar(raw.avatar),
      avatarDone: !!raw.avatarDone,
      pets,
      equipped: (Array.isArray(raw.equipped) ? raw.equipped : []).filter((id) => pets.some((p) => p.uid === id)).slice(0, MAX_EQUIPPED),
      inventory: counts(raw.inventory, (id) => !!FURN_BY_ID[id]),
      bag: counts(raw.bag, isBagId),
      houses: houses.length ? houses : [newHouse('hytte', raw.playerId, now)],
      activeHouseId: typeof raw.activeHouseId === 'string' ? raw.activeHouseId : '',
      stats: { ...base.stats, ...(raw.stats ?? {}) },
      sound: raw.sound !== false,
      starterClaimed: !!raw.starterClaimed,
      toysGiven: true,
      quests: normalizeQuestLog(raw.quests, now),
    };
    if (!raw.toysGiven) {
      // saves from before the toys existed: one ball and one yarn ball as a gift, once
      for (const t of STARTER_TOYS) save.bag[t] = Math.max(1, save.bag[t] ?? 0);
    }
    if (!save.houses.some((h) => h.id === save.activeHouseId)) save.activeHouseId = save.houses[0].id;
    return save;
  } catch {
    return freshSave(now);
  }
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
    /* private mode or full: keep playing in memory */
  }
}
