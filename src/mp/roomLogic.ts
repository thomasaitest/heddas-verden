import type { Avatar } from '../logic/avatar.ts';
import { cleanAvatar } from '../logic/avatar.ts';
import { filterName } from './names.ts';
import {
  MAX_PLAYERS,
  MAX_MSG_BYTES,
  MAX_MSG_PER_SEC,
  MP_VERSION,
  type ClientMsg,
  type EmoteId,
  type PlayerSnapshot,
  type ServerMsg,
  decodeClient,
  snapshotFromHello,
} from './protocol.ts';
import { RateLimit } from './rateLimit.ts';
import { isValidCode } from './codes.ts';

export interface Seat {
  id: string;
  name: string;
  avatar: Avatar;
  playerId: string;
  snap: PlayerSnapshot;
  rate: RateLimit;
  helloOk: boolean;
}

export interface RoomState {
  code: string;
  seats: Map<string, Seat>; // socketKey -> seat (only after hello)
  pending: Map<string, RateLimit>; // connected but not yet hello'd
}

export type Outbound = { to: 'all' | 'others' | string; msg: ServerMsg };

export function createRoom(code: string): RoomState {
  if (!isValidCode(code)) throw new Error('bad code');
  return { code, seats: new Map(), pending: new Map() };
}

export function playerCount(room: RoomState): number {
  return room.seats.size;
}

export function listSnapshots(room: RoomState): PlayerSnapshot[] {
  return [...room.seats.values()].filter((s) => s.helloOk).map((s) => s.snap);
}

export function handleConnect(room: RoomState, socketKey: string): Outbound[] {
  if (room.seats.size + room.pending.size >= MAX_PLAYERS) {
    return [{ to: socketKey, msg: { t: 'error', code: 'full', message: 'Rommet er fullt (maks 8).' } }];
  }
  room.pending.set(socketKey, new RateLimit(MAX_MSG_PER_SEC));
  return [];
}

export function handleDisconnect(room: RoomState, socketKey: string): Outbound[] {
  room.pending.delete(socketKey);
  const seat = room.seats.get(socketKey);
  room.seats.delete(socketKey);
  if (!seat?.helloOk) return [];
  return [{ to: 'others', msg: { t: 'left', id: socketKey } }];
}

export function handleRawMessage(room: RoomState, socketKey: string, raw: string, now = Date.now()): Outbound[] {
  if (raw.length > MAX_MSG_BYTES) {
    return [{ to: socketKey, msg: { t: 'error', code: 'too_big', message: 'Meldingen var for stor.' } }];
  }

  const pendingRate = room.pending.get(socketKey);
  const seat = room.seats.get(socketKey);
  const rate = seat?.rate ?? pendingRate;
  if (!rate) return [];
  if (!rate.allow(now)) return [];

  const msg = decodeClient(raw);
  if (!msg) {
    return [{ to: socketKey, msg: { t: 'error', code: 'bad_msg', message: 'Ugyldig melding.' } }];
  }
  return handleMsg(room, socketKey, msg, now);
}

function handleMsg(room: RoomState, socketKey: string, msg: ClientMsg, now: number): Outbound[] {
  if (msg.t === 'hello') {
    if (msg.v !== MP_VERSION) {
      return [{ to: socketKey, msg: { t: 'error', code: 'version', message: 'Oppdater spillet for å spille sammen.' } }];
    }
    if (room.seats.has(socketKey)) {
      return [{ to: socketKey, msg: { t: 'error', code: 'hello_twice', message: 'Du er allerede inne.' } }];
    }
    if (!room.pending.has(socketKey)) {
      return [{ to: socketKey, msg: { t: 'error', code: 'no_socket', message: 'Ukjent tilkobling.' } }];
    }
    if (room.seats.size >= MAX_PLAYERS) {
      return [{ to: socketKey, msg: { t: 'error', code: 'full', message: 'Rommet er fullt (maks 8).' } }];
    }
    const name = filterName(msg.name);
    if (!name) {
      return [{ to: socketKey, msg: { t: 'error', code: 'name', message: 'Ugyldig navn. Bare bokstaver, 2–12 tegn.' } }];
    }
    let finalName = name;
    const taken = new Set([...room.seats.values()].map((s) => s.name.toLowerCase()));
    if (taken.has(finalName.toLowerCase())) {
      for (let i = 2; i < 20; i++) {
        const cand = `${name.slice(0, 10)}${i}`;
        if (!taken.has(cand.toLowerCase())) {
          finalName = cand;
          break;
        }
      }
    }
    const rate = room.pending.get(socketKey) ?? new RateLimit(MAX_MSG_PER_SEC);
    room.pending.delete(socketKey);
    const avatar = cleanAvatar(msg.avatar);
    const seat: Seat = {
      id: socketKey,
      name: finalName,
      avatar,
      playerId: msg.playerId.slice(0, 64),
      snap: snapshotFromHello(socketKey, finalName, avatar),
      rate,
      helloOk: true,
    };
    room.seats.set(socketKey, seat);

    const others = listSnapshots(room).filter((p) => p.id !== socketKey);
    return [
      { to: socketKey, msg: { t: 'welcome', you: socketKey, code: room.code, players: others } },
      { to: 'others', msg: { t: 'joined', player: seat.snap } },
    ];
  }

  const seat = room.seats.get(socketKey);
  if (!seat?.helloOk) {
    return [{ to: socketKey, msg: { t: 'error', code: 'hello_first', message: 'Si hei først.' } }];
  }

  if (msg.t === 'ping') {
    return [{ to: socketKey, msg: { t: 'pong', n: msg.n } }];
  }

  if (msg.t === 'state') {
    seat.snap = {
      ...seat.snap,
      x: msg.x,
      y: msg.y,
      z: msg.z,
      yaw: msg.yaw,
      pose: msg.pose,
      speed: msg.speed,
      place: msg.place,
      pet: msg.pet,
      equip: msg.equip,
    };
    return [
      {
        to: 'others',
        msg: {
          t: 'state',
          id: socketKey,
          x: msg.x,
          y: msg.y,
          z: msg.z,
          yaw: msg.yaw,
          pose: msg.pose,
          speed: msg.speed,
          place: msg.place,
          pet: msg.pet,
          equip: msg.equip,
        },
      },
    ];
  }

  if (msg.t === 'emote') {
    seat.snap.emote = msg.id;
    seat.snap.emoteUntil = now + 3000;
    return [{ to: 'all', msg: { t: 'emote', id: socketKey, emote: msg.id as EmoteId } }];
  }

  return [];
}
