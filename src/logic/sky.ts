/**
 * Skyverden: four walkable clouds above the town.
 * Pure data and rules (no three.js) so entry, shops and the money-rain can be tested.
 * Device time is the clock. A reload or a clock jump never pays missed storms twice,
 * and jumping past a storm pays nothing.
 */

import type { Colliders, RectCollider, Surface } from './collision.ts';
import type { EggType } from './pets.ts';
import { EGGS } from './pets.ts';

export type CloudId = 'badeland' | 'egg' | 'fjell' | 'skog';

export interface CloudDef {
  id: CloudId;
  name: string;
  emoji: string;
  /** World position of the cloud centre. */
  x: number;
  z: number;
  /** Walkable floor radius. */
  r: number;
  blurb: string;
}

/** Feet stand here. High enough that only flight reaches it. */
export const CLOUD_FLOOR_Y = 46;
/** Rim walls rise this far above the floor. A normal jump on the cloud does not clear them. */
export const CLOUD_RIM_H = 2.6;
/** Flying higher than this is the open sky above the clouds. */
export const FLY_CEILING = 64;
/** Sky solids are only used at this height and above, so they never block the town. */
export const SKY_COLLIDE_MIN_Y = 30;

export const CLOUDS: readonly CloudDef[] = [
  { id: 'badeland', name: 'Badeland', emoji: '💦', x: -52, z: -18, r: 13, blurb: 'Skli og plask' },
  { id: 'egg', name: 'Regnbueegg', emoji: '🥚', x: 52, z: -18, r: 12, blurb: 'Kjøp og klekk et regnbueegg' },
  { id: 'fjell', name: 'Fjellskyen', emoji: '⛰️', x: 18, z: 52, r: 14, blurb: 'Hule med klatretau' },
  { id: 'skog', name: 'Regnbueskog', emoji: '🌈', x: -18, z: 52, r: 15, blurb: 'Her regner det bucks' },
];

export const CLOUD_BY_ID: Record<CloudId, CloudDef> = Object.fromEntries(CLOUDS.map((c) => [c.id, c])) as Record<CloudId, CloudDef>;

/** Rainbow arch on the ground. It explains Skyverden. You still have to fly up yourself. */
export const SKY_GATE = { x: -16, z: 8, r: 3.6 };

export const RAINBOW_EGG_ID = 'egg-regnbue';
export const RAINBOW_EGG_PRICE = 260;

export const ROPE_ID = 'klatretau';
export const ROPE_PRICE = 45;
export const CLIMB_REWARD = 6;
export const CLIMB_COOLDOWN_MS = 60_000;

/** One storm every 20 real minutes. Coins stay briefly, then the next wait starts. */
export const RAIN_INTERVAL_MS = 20 * 60 * 1000;
export const RAIN_WINDOW_MS = 50 * 1000;
export const RAIN_COIN_COUNT = 6;
/** Each coin. Six of them is 24 bucks, about one small quest, not a fortune. */
export const RAIN_COIN_VALUE = 4;

/** Trunks in the rainbow forest. Kept off the centre and off the rain coins. */
export const FOREST_TREES: readonly [number, number][] = [
  [-6, -4], [-2, -6], [3, -5], [7, -2],
  [-8, 1], [8, 2], [-7, 5], [-3, 7],
  [2, 6], [6, 5], [-4, 2], [4, -1],
  [0, -3], [5, 3],
  [-9, -7], [9, -7], [0, 9], [8, 7],
  [-9, 3], [2, -8], [-4, -8], [10, 1],
];

export const SPLASH_COOLDOWN_MS = 2_500;

export function cloudById(id: CloudId): CloudDef {
  return CLOUD_BY_ID[id];
}

export function worldOnCloud(id: CloudId, lx: number, lz: number): { x: number; z: number } {
  const c = cloudById(id);
  return { x: c.x + lx, z: c.z + lz };
}

/** Which cloud disc contains this point, ignoring height. */
export function cloudAtXZ(x: number, z: number, pad = 0): CloudDef | null {
  for (const c of CLOUDS) {
    if (Math.hypot(x - c.x, z - c.z) <= c.r + pad) return c;
  }
  return null;
}

/** True when sky walls should be added. Ground level never includes them. */
export function useSkyColliders(y: number): boolean {
  return y >= SKY_COLLIDE_MIN_Y;
}

/** Walkable floor under a flyer or walker, or null when they are out in the open sky. */
export function cloudFloorAt(x: number, z: number, y: number): number | null {
  if (y < SKY_COLLIDE_MIN_Y) return null;
  return cloudAtXZ(x, z, 0.4) ? CLOUD_FLOOR_Y : null;
}

export function skyAccessText(canFly: boolean): string {
  if (canFly) return 'Hold ⬆ og fly opp. Fire skyer: badeland, egg, fjell og skog.';
  return 'Skyverden er oppe i skyene. Et dyr med vinger må øve fire ganger. Trylledrikk kan ikke kjøpes.';
}

export interface SkySolid {
  name: string;
  shape: 'rect' | 'circle';
  x: number;
  z: number;
  hw: number;
  hd: number;
  r: number;
  rot: number;
  /** Absolute top. Feet at or above this clear it. */
  h: number;
}

function rimSolids(c: CloudDef): SkySolid[] {
  const n = 20;
  const out: SkySolid[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rot = Math.PI / 2 - a;
    const x = c.x + Math.cos(a) * c.r;
    const z = c.z + Math.sin(a) * c.r;
    const arc = (2 * Math.PI * c.r) / n;
    out.push({
      name: `${c.id}-rim-${i}`,
      shape: 'rect',
      x,
      z,
      hw: arc * 0.62,
      hd: 0.55,
      r: 0,
      rot,
      h: CLOUD_FLOOR_Y + CLOUD_RIM_H,
    });
  }
  return out;
}

function solid(name: string, cloud: CloudId, lx: number, lz: number, hw: number, hd: number, top: number, rot = 0): SkySolid {
  const p = worldOnCloud(cloud, lx, lz);
  return { name, shape: 'rect', x: p.x, z: p.z, hw, hd, r: 0, rot, h: CLOUD_FLOOR_Y + top };
}

function circ(name: string, cloud: CloudId, lx: number, lz: number, r: number, top: number): SkySolid {
  const p = worldOnCloud(cloud, lx, lz);
  return { name, shape: 'circle', x: p.x, z: p.z, hw: r, hd: r, r, rot: 0, h: CLOUD_FLOOR_Y + top };
}

/** Everything that stops you on a cloud: rims, cave, slide tower, trees, counters. */
export function skySolids(): SkySolid[] {
  const out: SkySolid[] = [];
  for (const c of CLOUDS) out.push(...rimSolids(c));

  // Badeland: slide tower legs. The chute and pool stay open.
  out.push(solid('slide-leg-a', 'badeland', -6.3, -2.4, 0.35, 0.35, 3.4));
  out.push(solid('slide-leg-b', 'badeland', -4.0, -2.3, 0.35, 0.35, 2.4));

  // Egg stall counter.
  out.push(solid('egg-counter', 'egg', 0, 2.4, 1.6, 0.7, 1.2));

  // Mountain cave: a room with a door toward the cloud centre (−z).
  out.push(solid('cave-back', 'fjell', 0, 7.4, 4.2, 0.4, 3.2));
  out.push(solid('cave-left', 'fjell', -4.2, 4.8, 0.4, 2.6, 3.2));
  out.push(solid('cave-right', 'fjell', 4.2, 4.8, 0.4, 2.6, 3.2));
  // Wide open mouth: the gap between these jambs is about 5.5 m.
  out.push(solid('cave-front-l', 'fjell', -3.6, 2.3, 0.85, 0.45, 3.4));
  out.push(solid('cave-front-r', 'fjell', 3.6, 2.3, 0.85, 0.45, 3.4));
  out.push(solid('rope-counter', 'fjell', 0, 6.4, 1.3, 0.55, 1.15));
  // The peak itself, behind the cave, so you walk around it to the climb spot.
  out.push(circ('peak', 'fjell', 0, 8.6, 2.4, 8));

  // Rainbow trees. The middle of the cloud, and every rain coin, stays open.
  FOREST_TREES.forEach(([lx, lz], i) => out.push(circ(`tree-${i}`, 'skog', lx, lz, 0.55, 4.2)));
  return out;
}

export function skyColliders(): Colliders {
  const rects: RectCollider[] = [];
  const circles = [];
  for (const s of skySolids()) {
    if (s.shape === 'circle') circles.push({ x: s.x, z: s.z, r: s.r, h: s.h });
    else rects.push({ x: s.x, z: s.z, hw: s.hw, hd: s.hd, rot: s.rot, h: s.h });
  }
  return { rects, circles };
}

export function skySurfaces(): Surface[] {
  return CLOUDS.map((c) => ({ x: c.x, z: c.z, r: c.r - 0.3, top: CLOUD_FLOOR_Y }));
}

export type SkyZoneKind = 'sky-info' | 'slide' | 'splash' | 'egg' | 'rope' | 'climb';

export interface SkyZone {
  kind: SkyZoneKind;
  cloud: CloudId | null;
  x: number;
  z: number;
  r: number;
  label: string;
}

export function skyZones(): SkyZone[] {
  const slide = worldOnCloud('badeland', -5.2, -1.2);
  const pool = worldOnCloud('badeland', 3.2, 2.6);
  const egg = worldOnCloud('egg', 0, 1.2);
  const rope = worldOnCloud('fjell', 0, 5.2);
  const climb = worldOnCloud('fjell', -5.2, 1.2);
  return [
    { kind: 'sky-info', cloud: null, x: SKY_GATE.x, z: SKY_GATE.z, r: SKY_GATE.r, label: 'Skyverden ☁️' },
    { kind: 'slide', cloud: 'badeland', x: slide.x, z: slide.z, r: 1.6, label: 'Ta sklien 🛝' },
    { kind: 'splash', cloud: 'badeland', x: pool.x, z: pool.z, r: 2.6, label: 'Plask 💦' },
    { kind: 'egg', cloud: 'egg', x: egg.x, z: egg.z, r: 2.2, label: 'Kjøp regnbueegg 🌈' },
    { kind: 'rope', cloud: 'fjell', x: rope.x, z: rope.z, r: 1.8, label: 'Kjøp klatretau 🪢' },
    { kind: 'climb', cloud: 'fjell', x: climb.x, z: climb.z, r: 1.8, label: 'Klatre 🧗' },
  ];
}

export function rainbowEgg(): EggType {
  return EGGS.find((e) => e.id === RAINBOW_EGG_ID) ?? EGGS[0];
}

/** Eggs shown in the town egg shop. The rainbow egg lives only on its cloud. */
export function groundShopEggs(starterClaimed: boolean): EggType[] {
  return EGGS.filter((e) => e.id !== RAINBOW_EGG_ID && (e.price > 0 || !starterClaimed));
}

/** 0 at the top of the slide, 1 in the pool. */
export function slidePose(u: number): { lx: number; ly: number; lz: number; done: boolean } {
  const t = Math.max(0, Math.min(1, u));
  return {
    lx: -5.2 + t * 8.4,
    lz: -1.2 + t * 3.8,
    ly: (1 - t) * 3.1 + 0.15,
    done: t >= 1,
  };
}

/** Climb up the outside of the mountain, then come back down. ly is above the floor. */
export function climbPose(u: number): { lx: number; ly: number; lz: number; done: boolean } {
  const t = Math.max(0, Math.min(1, u));
  const up = t < 0.55 ? t / 0.55 : 1 - (t - 0.55) / 0.45;
  return {
    lx: -5.2 + up * 2.2,
    lz: 1.2 + up * 2.4,
    ly: up * 4.2,
    done: t >= 1,
  };
}

export interface SkyRainSave {
  nextAt: number;
  /** When this storm's coins appeared, or null when the sky is dry. */
  stormId: number | null;
  collected: number[];
}

export function freshRain(now: number): SkyRainSave {
  return { nextAt: now + RAIN_INTERVAL_MS, stormId: null, collected: [] };
}

function cleanCollected(list: unknown): number[] {
  if (!Array.isArray(list)) return [];
  const out: number[] = [];
  for (const n of list) {
    const i = Math.floor(Number(n));
    if (i >= 0 && i < RAIN_COIN_COUNT && !out.includes(i)) out.push(i);
  }
  return out;
}

/**
 * Repair a saved rain clock.
 * - Future nextAt is kept, but never further away than one interval (clock moved backward).
 * - A storm you are still inside keeps its collected coins.
 * - A storm whose window has passed, or a clock jump that skips the window, pays nothing.
 */
export function normalizeRain(raw: Partial<SkyRainSave> | null | undefined, now: number): SkyRainSave {
  if (!raw || !Number.isFinite(Number(raw.nextAt))) return freshRain(now);
  let nextAt = Number(raw.nextAt);
  let stormId = raw.stormId == null || !Number.isFinite(Number(raw.stormId)) ? null : Number(raw.stormId);
  let collected = cleanCollected(raw.collected);
  if (nextAt > now + RAIN_INTERVAL_MS) nextAt = now + RAIN_INTERVAL_MS;

  if (stormId != null && now >= stormId && now < stormId + RAIN_WINDOW_MS) {
    return { nextAt: Math.max(nextAt, stormId + RAIN_INTERVAL_MS), stormId, collected };
  }

  if (stormId != null && now >= (stormId as number) + RAIN_WINDOW_MS) {
    stormId = null;
    collected = [];
    if (nextAt <= now) nextAt = now + RAIN_INTERVAL_MS;
  }

  if (stormId == null && now >= nextAt && now < nextAt + RAIN_WINDOW_MS) {
    return { nextAt: nextAt + RAIN_INTERVAL_MS, stormId: nextAt, collected: [] };
  }

  if (stormId == null && now >= nextAt + RAIN_WINDOW_MS) {
    return freshRain(now);
  }

  return { nextAt, stormId: null, collected: [] };
}

export function rainView(state: SkyRainSave, now: number): { active: boolean; msUntil: number; coinsLeft: number; state: SkyRainSave } {
  const s = normalizeRain(state, now);
  if (s.stormId != null && now >= s.stormId && now < s.stormId + RAIN_WINDOW_MS) {
    return { active: true, msUntil: s.stormId + RAIN_WINDOW_MS - now, coinsLeft: RAIN_COIN_COUNT - s.collected.length, state: s };
  }
  return { active: false, msUntil: Math.max(0, s.nextAt - now), coinsLeft: 0, state: s };
}

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function collectRainCoin(state: SkyRainSave, index: number, now: number): { state: SkyRainSave; ok: boolean; reason?: 'inactive' | 'taken' | 'bad' } {
  const s = normalizeRain(state, now);
  if (!Number.isInteger(index) || index < 0 || index >= RAIN_COIN_COUNT) return { state: s, ok: false, reason: 'bad' };
  if (s.stormId == null || now < s.stormId || now >= s.stormId + RAIN_WINDOW_MS) return { state: s, ok: false, reason: 'inactive' };
  if (s.collected.includes(index)) return { state: s, ok: false, reason: 'taken' };
  return { state: { ...s, collected: [...s.collected, index] }, ok: true };
}

export function rainCoinWorld(index: number): { x: number; z: number } {
  const a = (index / RAIN_COIN_COUNT) * Math.PI * 2 + 0.35;
  const rad = 3.2 + (index % 3) * 2.1;
  return worldOnCloud('skog', Math.cos(a) * rad, Math.sin(a) * rad);
}

export function canSplash(lastAt: number | null | undefined, now: number): boolean {
  if (!lastAt) return true;
  return now - lastAt >= SPLASH_COOLDOWN_MS;
}

export function canClimb(hasRope: boolean, lastAt: number | null | undefined, now: number): { ok: boolean; reason?: 'no-rope' | 'wait' } {
  if (!hasRope) return { ok: false, reason: 'no-rope' };
  if (lastAt && now - lastAt < CLIMB_COOLDOWN_MS) return { ok: false, reason: 'wait' };
  return { ok: true };
}
