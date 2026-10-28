/** Shared multiplayer wire protocol (client + server). Keep messages small and typed. */

import type { Avatar } from '../logic/avatar.ts';
import { cleanAvatar } from '../logic/avatar.ts';

export const MP_VERSION = 1;
export const MAX_PLAYERS = 8;
export const STATE_HZ = 10;
export const MAX_MSG_BYTES = 2048;
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

export type PlaceWire = 'town' | 'house' | 'shop' | 'vet';

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
  pet: PetWire | null;
  equip: string | null;
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
      pet: PetWire | null;
      equip: string | null;
    }
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
      pet: PetWire | null;
      equip: string | null;
    }
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
const PLACES: PlaceWire[] = ['town', 'house', 'shop', 'vet'];

function parsePet(v: unknown): PetWire | null {
  if (v === null) return null;
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!isStr(o.speciesId) || o.speciesId.length > 32) return null;
  if (!isStr(o.name) || o.name.length > 24) return null;
  return { speciesId: o.speciesId, name: o.name };
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
      x: clamp(o.x, 200),
      y: clamp(o.y, 80),
      z: clamp(o.z, 200),
      yaw: o.yaw,
      pose: o.pose as AvatarPoseWire,
      speed: clamp(o.speed, 20),
      place: o.place as PlaceWire,
      pet,
      equip: isStr(o.equip) && o.equip.length <= 32 ? o.equip : null,
    };
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

export function snapshotFromHello(
  id: string,
  name: string,
  avatar: Avatar,
): PlayerSnapshot {
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
    pet: null,
    equip: null,
    emote: null,
    emoteUntil: 0,
  };
}
