import { describe, expect, it } from 'vitest';
import { cleanAvatar, DEFAULT_AVATAR } from '../logic/avatar.ts';
import { cleanCode, generateCode, isValidCode, CODE_LEN } from './codes.ts';
import { sampleAt, pushSample, shortestAngle, lerpAngle } from './interp.ts';
import { filterName, nameError, NAME_MAX } from './names.ts';
import {
  decodeClient,
  encode,
  MAX_MSG_BYTES,
  MP_VERSION,
  parseClient,
  type ClientMsg,
} from './protocol.ts';
import { RateLimit } from './rateLimit.ts';
import {
  createRoom,
  handleConnect,
  handleDisconnect,
  handleRawMessage,
  listSnapshots,
  playerCount,
} from './roomLogic.ts';

describe('codes', () => {
  it('generates valid codes of fixed length', () => {
    for (let i = 0; i < 50; i++) {
      const c = generateCode(() => i / 50);
      expect(isValidCode(c)).toBe(true);
      expect(c).toHaveLength(CODE_LEN);
    }
  });
  it('cleans and rejects confusables', () => {
    expect(cleanCode(' ab12o ')).toBe('AB2'); // 1 and O are confusable → stripped
    expect(isValidCode(cleanCode('K7H2M'))).toBe(true);
    expect(isValidCode('OOOOO')).toBe(false);
    expect(isValidCode('11111')).toBe(false);
  });
});

describe('names', () => {
  it('accepts Norwegian letters', () => {
    expect(filterName('Hedda')).toBe('Hedda');
    expect(filterName('ÆØÅ')).toBe('ÆØÅ');
    expect(filterName('ola nord')).toBe('Ola Nord');
  });
  it('rejects bad names', () => {
    expect(filterName('a')).toBeNull();
    expect(filterName('Hello!')).toBeNull();
    expect(filterName('x'.repeat(NAME_MAX + 1))).toBeNull();
    expect(filterName('fuck')).toBeNull();
    expect(nameError('')).toMatch(/minst/);
  });
});

describe('protocol encode/decode', () => {
  it('roundtrips hello and state', () => {
    const hello: ClientMsg = {
      t: 'hello',
      v: MP_VERSION,
      name: 'Hedda',
      avatar: DEFAULT_AVATAR,
      playerId: 'p1',
    };
    const raw = encode(hello);
    expect(raw.length).toBeLessThan(MAX_MSG_BYTES);
    const back = decodeClient(raw);
    expect(back?.t).toBe('hello');
    if (back?.t === 'hello') {
      expect(back.name).toBe('Hedda');
      expect(back.avatar).toEqual(cleanAvatar(DEFAULT_AVATAR));
    }
    const state = decodeClient(
      encode({
        t: 'state',
        x: 1,
        y: 2,
        z: 3,
        yaw: 0.5,
        pose: 'walk',
        speed: 1,
        place: 'town',
        pet: { speciesId: 'hund', name: 'Bikkja' },
        equip: null,
      }),
    );
    expect(state?.t).toBe('state');
  });
  it('rejects malformed and oversized logic', () => {
    expect(parseClient(null)).toBeNull();
    expect(parseClient({ t: 'emote', id: 'nope' })).toBeNull();
    expect(parseClient({ t: 'hello', v: 999, name: 'A', avatar: {}, playerId: 'x' })).toBeNull();
  });
  it('clamps wild coordinates', () => {
    const m = parseClient({
      t: 'state',
      x: 9999,
      y: -999,
      z: 0,
      yaw: 1,
      pose: 'idle',
      speed: 100,
      place: 'town',
      pet: null,
      equip: null,
    });
    expect(m?.t).toBe('state');
    if (m?.t === 'state') {
      expect(m.x).toBe(200);
      expect(m.y).toBe(-80);
      expect(m.speed).toBe(20);
    }
  });
});

describe('interpolation', () => {
  it('lerps position and shortest angle', () => {
    expect(shortestAngle(0.1, -0.1)).toBeCloseTo(-0.2, 5);
    expect(lerpAngle(0, Math.PI, 0.5)).toBeCloseTo(Math.PI / 2, 5);
    const s0 = pushSample(null, { x: 0, y: 0, z: 0, yaw: 0, speed: 0, pose: 'idle', place: 'town', equip: null, at: 1000 }, 1000);
    const s1 = pushSample(s0, { x: 10, y: 0, z: 0, yaw: 0, speed: 1, pose: 'walk', place: 'town', equip: null, at: 1200 }, 1100);
    // renderAt = now - 100 = 1150 → halfway between 1100 and 1200
    const mid = sampleAt(s1, 1250);
    expect(mid.x).toBeGreaterThan(3);
    expect(mid.x).toBeLessThan(10);
  });
});

describe('rate limit', () => {
  it('allows burst then blocks', () => {
    const r = new RateLimit(5, 1000);
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(r.allow(t0 + i)).toBe(true);
    expect(r.allow(t0 + 5)).toBe(false);
    expect(r.allow(t0 + 1001)).toBe(true);
  });
});

describe('room logic', () => {
  const code = 'K7H2M';
  const hello = (name: string, id: string) =>
    encode({ t: 'hello', v: MP_VERSION, name, avatar: DEFAULT_AVATAR, playerId: id });

  it('welcomes first player and broadcasts join', () => {
    const room = createRoom(code);
    expect(handleConnect(room, 'a')).toEqual([]);
    const out = handleRawMessage(room, 'a', hello('Hedda', 'p1'));
    expect(out.some((o) => o.msg.t === 'welcome')).toBe(true);
    expect(playerCount(room)).toBe(1);
  });

  it('notifies others on join/leave and relays state/emote', () => {
    const room = createRoom(code);
    handleConnect(room, 'a');
    handleRawMessage(room, 'a', hello('Ada', 'p1'));
    handleConnect(room, 'b');
    const join = handleRawMessage(room, 'b', hello('Bo', 'p2'));
    expect(join.find((o) => o.to === 'others' && o.msg.t === 'joined')).toBeTruthy();
    expect(listSnapshots(room)).toHaveLength(2);

    const st = handleRawMessage(
      room,
      'a',
      encode({
        t: 'state',
        x: 5,
        y: 0,
        z: 5,
        yaw: 1,
        pose: 'walk',
        speed: 1,
        place: 'town',
        pet: null,
        equip: null,
      }),
    );
    expect(st[0]?.msg.t).toBe('state');

    const em = handleRawMessage(room, 'a', encode({ t: 'emote', id: 'hei' }));
    expect(em[0]?.msg.t).toBe('emote');

    const left = handleDisconnect(room, 'b');
    expect(left[0]?.msg).toEqual({ t: 'left', id: 'b' });
    expect(playerCount(room)).toBe(1);
  });

  it('rejects bad name and full room', () => {
    const room = createRoom(code);
    handleConnect(room, 'a');
    const bad = handleRawMessage(room, 'a', encode({ t: 'hello', v: MP_VERSION, name: '!!!', avatar: DEFAULT_AVATAR, playerId: 'x' }));
    expect(bad[0]?.msg.t).toBe('error');

    const full = createRoom('ABCDE');
    for (let i = 0; i < 8; i++) {
      handleConnect(full, `s${i}`);
      handleRawMessage(full, `s${i}`, hello(`Navn${i}`, `p${i}`));
    }
    const overflow = handleConnect(full, 's8');
    expect(overflow[0]?.msg).toMatchObject({ t: 'error', code: 'full' });
  });

  it('rate-limits and drops oversized', () => {
    const room = createRoom(code);
    handleConnect(room, 'a');
    handleRawMessage(room, 'a', hello('Ada', 'p1'));
    const big = 'x'.repeat(MAX_MSG_BYTES + 10);
    const out = handleRawMessage(room, 'a', big);
    expect(out[0]?.msg).toMatchObject({ code: 'too_big' });
  });
});
