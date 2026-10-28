/** Shared multiplayer wire protocol (client + server). Keep messages small and typed. */

import type { Avatar } from '../logic/avatar.ts';
import { cleanAvatar } from '../logic/avatar.ts';

export const MP_VERSION = 1;
export const MAX_PLAYERS = 8;
export const STATE_HZ = 10;
export const MAX_MSG_BYTES = 4096;
/** Max client→server messages per second per socket (state + emotes). */
export const MAX_MSG_PER_SEC = 20;

export const EMOTES = [
  { id: 'hei', emoji: '👋', label: 'Hei!' },
  { id: 'glad', emoji: '😊', label: 'Glad' },
  { id: 'hjerte', emoji: '❤️', label: 'Hjerte' },
  { id: 'lo', emoji: '😂', label: 'Haha' },
  { id: 'tommel', emoji: '👍', label: 'Tommel opp' },
  { id: 'klapp', emoji: '👏', label: 'Klapp' },
  { id: 'dans', emoji: '💃', label: 'Dans' },
  { id: 'wow', emoji: '🤩', label: 'Wow' },
] as const;
export type EmoteId = (typeof EMOTES)[number]['id'];
export const EMOTE_BY_ID: Record<string, (typeof EMOTES)[number]> = Object.fromEntries(EMOTES.map((e) => [e.id, e]));

export type AvatarPoseWire =
  | 'idle'
  | 'walk'
  | 'jump'
  | 'sit'
  | 'hold'
  | 'wave'
  | 'fly'
  | 'swing'
  | 'slide'
  | 'seesaw'
  | 'spin';

/** Where the player is. Newer clients may also send cars/pets; older ones only know the first four. */
export type PlaceWire = 'town' | 'house' | 'shop' | 'vet' | 'cars' | 'pets';

/** How the player is attached to their pet (pony ride etc.). */
export type MountWire = 'none' | 'ride' | 'hold' | 'fly';

export interface PetWire {
  speciesId: string;
  name: string;
}

export interface PlayerSnapshot {
  id: string;
  name: string;
  avatar: Avatar;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pose: AvatarPoseWire;
  speed: number;
  place: PlaceWire;
  /** Whose private house, when place === 'house' (playerId). */
  area: string | null;
  pet: PetWire | null;
  equip: string | null;
  /** Pet mount mode; missing/unknown → none (backward tolerant). */
  mount: MountWire;
  emote: EmoteId | null;
  emoteUntil: number;
}

/** Client → server */
export type ClientMsg =
  | { t: 'hello'; v: number; name: string; avatar: Avatar; playerId: string }
  | {
      t: 'state';
      x: number;
      y: number;
      z: number;
      yaw: number;
      pose: AvatarPoseWire;
      speed: number;
      place: PlaceWire;
      area?: string | null;
      pet: PetWire | null;
      equip: string | null;
      mount?: MountWire;
    }
  | { t: 'avatar'; avatar: Avatar }
  | { t: 'emote'; id: EmoteId }
  | { t: 'ping'; n: number };

/** Server → client */
export type ServerMsg =
  | { t: 'welcome'; you: string; code: string; players: PlayerSnapshot[] }
  | { t: 'joined'; player: PlayerSnapshot }
  | { t: 'left'; id: string }
  | {
      t: 'state';
      id: string;
      x: number;
      y: number;
      z: number;
      yaw: number;
      pose: AvatarPoseWire;
      speed: number;
      place: PlaceWire;
      area?: string | null;
      pet: PetWire | null;
      equip: string | null;
      mount?: MountWire;
    }
  | { t: 'avatar'; id: string; avatar: Avatar }
  | { t: 'emote'; id: string; emote: EmoteId }
  | { t: 'pong'; n: number }
  | { t: 'error'; code: string; message: string };

export function encode(msg: ClientMsg | ServerMsg): string {
  return JSON.stringify(msg);
}

export function decodeClient(raw: string): ClientMsg | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  return parseClient(data);
}

export function decodeServer(raw: string): ServerMsg | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  return parseServer(data);
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const POSES: AvatarPoseWire[] = ['idle', 'walk', 'jump', 'sit', 'hold', 'wave', 'fly', 'swing', 'slide', 'seesaw', 'spin'];
const PLACES: PlaceWire[] = ['town', 'house', 'shop', 'vet', 'cars', 'pets'];
const MOUNTS: MountWire[] = ['none', 'ride', 'hold', 'fly'];

function parsePet(v: unknown): PetWire | null {
  if (v === null) return null;
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!isStr(o.speciesId) || o.speciesId.length > 32) return null;
  if (!isStr(o.name) || o.name.length > 24) return null;
  return { speciesId: o.speciesId, name: o.name };
}

function parseMount(v: unknown): MountWire {
  if (isStr(v) && MOUNTS.includes(v as MountWire)) return v as MountWire;
  return 'none';
}

function parseArea(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (!isStr(v) || v.length > 64) return null;
  return v;
}

export function parseClient(data: unknown): ClientMsg | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  if (o.t === 'hello') {
    if (!isNum(o.v) || o.v !== MP_VERSION) return null;
    if (!isStr(o.name) || !isStr(o.playerId) || o.playerId.length > 64) return null;
    return { t: 'hello', v: MP_VERSION, name: o.name, avatar: cleanAvatar(o.avatar), playerId: o.playerId };
  }
  if (o.t === 'state') {
    if (!isNum(o.x) || !isNum(o.y) || !isNum(o.z) || !isNum(o.yaw) || !isNum(o.speed)) return null;
    if (!isStr(o.pose) || !POSES.includes(o.pose as AvatarPoseWire)) return null;
    if (!isStr(o.place) || !PLACES.includes(o.place as PlaceWire)) return null;
    if (o.equip !== null && o.equip !== undefined && !isStr(o.equip)) return null;
    const pet = parsePet(o.pet ?? null);
    if (o.pet !== null && o.pet !== undefined && pet === null) return null;
    const clamp = (n: number, lim: number) => Math.max(-lim, Math.min(lim, n));
    return {
      t: 'state',
      x: clamp(o.x, 250),
      y: clamp(o.y, 80),
      z: clamp(o.z, 250),
      yaw: o.yaw,
      pose: o.pose as AvatarPoseWire,
      speed: clamp(o.speed, 20),
      place: o.place as PlaceWire,
      area: parseArea(o.area),
      pet,
      equip: isStr(o.equip) && o.equip.length <= 32 ? o.equip : null,
      mount: parseMount(o.mount),
    };
  }
  if (o.t === 'avatar') {
    return { t: 'avatar', avatar: cleanAvatar(o.avatar) };
  }
  if (o.t === 'emote') {
    if (!isStr(o.id) || !EMOTE_BY_ID[o.id]) return null;
    return { t: 'emote', id: o.id as EmoteId };
  }
  if (o.t === 'ping') {
    if (!isNum(o.n)) return null;
    return { t: 'ping', n: o.n };
  }
  return null;
}

export function parseServer(data: unknown): ServerMsg | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  if (!isStr(o.t)) return null;
  // Server messages are trusted from our own server; light shape check is enough for client.
  return o as unknown as ServerMsg;
}

export function snapshotFromHello(id: string, name: string, avatar: Avatar): PlayerSnapshot {
  return {
    id,
    name,
    avatar: cleanAvatar(avatar),
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pose: 'idle',
    speed: 0,
    place: 'town',
    area: null,
    pet: null,
    equip: null,
    mount: 'none',
    emote: null,
    emoteUntil: 0,
  };
}

/** Normalize a snapshot that may come from an older server without area/mount. */
export function normalizeSnapshot(raw: Partial<PlayerSnapshot> & { id: string; name: string; avatar: Avatar }): PlayerSnapshot {
  const base = snapshotFromHello(raw.id, raw.name, raw.avatar);
  return {
    ...base,
    ...raw,
    avatar: cleanAvatar(raw.avatar),
    area: raw.area ?? null,
    mount: parseMount(raw.mount),
    place: (PLACES.includes(raw.place as PlaceWire) ? raw.place : 'town') as PlaceWire,
  };
}
