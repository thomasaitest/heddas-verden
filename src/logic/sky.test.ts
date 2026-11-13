import { describe, expect, it } from 'vitest';
import { blocked, movePlayer } from './collision.ts';
import { AVATAR_BODY_R } from './avatar.ts';
import { buyAndHatch, buyRope, climbWithRope, collectSkyCoin } from './economy.ts';
import { freshSave, parseSave, START_BUCKS } from './save.ts';
import { seeded } from './rng.ts';
import { EGGS } from './pets.ts';
import {
  CLIMB_COOLDOWN_MS,
  CLIMB_REWARD,
  CLOUD_FLOOR_Y,
  CLOUD_RIM_H,
  CLOUDS,
  RAIN_COIN_COUNT,
  RAIN_COIN_VALUE,
  RAIN_INTERVAL_MS,
  RAIN_WINDOW_MS,
  RAINBOW_EGG_ID,
  ROPE_PRICE,
  cloudAtXZ,
  CAVE_MOUTH,
  cloudFloorAt,
  collectRainCoin,
  FOREST_TREES,
  formatCountdown,
  freshRain,
  groundShopEggs,
  LADDER_BASE,
  ladderPose,
  normalizeRain,
  PLATFORM_TOP,
  rainCoinWorld,
  rainView,
  skyAccessText,
  skyColliders,
  mountainLedgeTop,
  MOUNTAIN_LEDGES,
  skyPlatformTop,
  skyZones,
  SLIDE_START,
  slidePose,
  SUNBEDS,
  useSkyColliders,
} from './sky.ts';

const R = 0.55;

describe('sky clouds', () => {
  const cols = skyColliders();

  it('has four distinct clouds above the town, and the ground gate only explains the way up', () => {
    expect(CLOUDS.map((c) => c.id)).toEqual(['badeland', 'egg', 'fjell', 'skog']);
    expect(new Set(CLOUDS.map((c) => `${c.x},${c.z}`)).size).toBe(4);
    expect(CLOUD_FLOOR_Y).toBeGreaterThan(30);
    const wide = CLOUDS.filter((c) => c.id !== 'fjell');
    expect(Math.min(...wide.map((c) => c.r))).toBeGreaterThanOrEqual(16);
    const fjell = CLOUDS.find((c) => c.id === 'fjell')!;
    expect(fjell.r).toBeLessThan(11);
    expect(fjell.r).toBeGreaterThan(7);
    expect(Math.max(...CLOUDS.map((c) => Math.hypot(c.x, c.z)))).toBeLessThan(48);
    for (let i = 0; i < CLOUDS.length; i++) {
      for (let j = i + 1; j < CLOUDS.length; j++) {
        const a = CLOUDS[i];
        const b = CLOUDS[j];
        const gap = Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r;
        expect(gap, `${a.id}-${b.id}`).toBeGreaterThan(6);
      }
    }
    expect(skyAccessText(false)).toMatch(/øve/);
    expect(skyAccessText(false)).toMatch(/kan ikke kjøpes/);
    expect(skyAccessText(true)).toMatch(/fly opp/);
    expect(useSkyColliders(0)).toBe(false);
    expect(useSkyColliders(CLOUD_FLOOR_Y)).toBe(true);
    expect(cloudFloorAt(CLOUDS[0].x, CLOUDS[0].z, 0)).toBeNull();
    expect(cloudFloorAt(CLOUDS[0].x, CLOUDS[0].z, CLOUD_FLOOR_Y)).toBe(CLOUD_FLOOR_Y);
  });

  it('a walker on a cloud floor cannot leave through the rim, and a flyer above the rim can', () => {
    for (const c of CLOUDS) {
      const start = { x: c.x + c.r - 2, y: CLOUD_FLOOR_Y, z: c.z };
      const pos = { ...start };
      movePlayer(pos, 8, 0, R, cols);
      expect(Math.hypot(pos.x - c.x, pos.z - c.z), c.id).toBeLessThan(c.r + 0.2);
      expect(blocked(pos.x, pos.z, R, cols, CLOUD_FLOOR_Y)).toBe(false);
      const flyer = { x: c.x + c.r - 2, y: CLOUD_FLOOR_Y + CLOUD_RIM_H + 1, z: c.z };
      movePlayer(flyer, 8, 0, R, cols);
      expect(Math.hypot(flyer.x - c.x, flyer.z - c.z), `${c.id} fly`).toBeGreaterThan(c.r);
    }
  });

  it('the little peak blocks you, and the mouth that opens the inner world stays clear', () => {
    const fjell = CLOUDS.find((c) => c.id === 'fjell')!;
    expect(blocked(fjell.x + CAVE_MOUTH.lx, fjell.z + CAVE_MOUTH.lz, R, cols, CLOUD_FLOOR_Y)).toBe(false);
    const rock = { x: fjell.x, y: CLOUD_FLOOR_Y, z: fjell.z + 6 };
    movePlayer(rock, 0, -4, R, cols);
    expect(rock.z).toBeGreaterThan(fjell.z + 3.6);
    const body = { x: fjell.x, y: CLOUD_FLOOR_Y, z: fjell.z + 8 };
    movePlayer(body, 0, -8, AVATAR_BODY_R, cols);
    expect(Math.hypot(body.x - fjell.x, body.z - (fjell.z + 3.6))).toBeGreaterThan(AVATAR_BODY_R);
    const low = MOUNTAIN_LEDGES[0];
    const high = MOUNTAIN_LEDGES[1];
    expect(mountainLedgeTop(fjell.x + high.lx, fjell.z + high.lz)!).toBeGreaterThan(
      mountainLedgeTop(fjell.x + low.lx, fjell.z + low.lz)!,
    );
    expect(skyZones().some((z) => z.kind === 'cave-enter')).toBe(true);
  });

  it('the water park slide start and pool are walkable, tower legs are not', () => {
    const b = CLOUDS.find((c) => c.id === 'badeland')!;
    expect(blocked(b.x - 5.2, b.z - 1.2, R, cols, CLOUD_FLOOR_Y)).toBe(false);
    expect(blocked(b.x + 3.2, b.z + 2.6, R, cols, CLOUD_FLOOR_Y)).toBe(false);
    expect(blocked(b.x - 6.3, b.z - 2.4, R, cols, CLOUD_FLOOR_Y)).toBe(true);
    const slide = skyZones().find((z) => z.kind === 'slide')!;
    const splash = skyZones().find((z) => z.kind === 'splash')!;
    const end = slidePose(1);
    expect(blocked(b.x + end.lx, b.z + end.lz, R, cols, CLOUD_FLOOR_Y)).toBe(false);
    expect(Math.hypot(b.x + end.lx - splash.x, b.z + end.lz - splash.z)).toBeLessThan(splash.r);
    expect(cloudAtXZ(slide.x, slide.z)?.id).toBe('badeland');
    expect(cloudAtXZ(splash.x, splash.z)?.id).toBe('badeland');
    const b2 = CLOUDS.find((c) => c.id === 'badeland')!;
    for (const bed of SUNBEDS) expect(blocked(b2.x + bed.lx, b2.z + bed.lz, R, cols, CLOUD_FLOOR_Y), 'sunbed').toBe(true);
    expect(blocked(b2.x + 6.2, b2.z - 0.4, R, cols, CLOUD_FLOOR_Y), 'umbrella').toBe(true);
    expect(blocked(b2.x + LADDER_BASE.lx, b2.z + LADDER_BASE.lz, R, cols, CLOUD_FLOOR_Y), 'ladder foot').toBe(false);
    const bed = SUNBEDS[0];
    const walker = { x: b2.x + bed.lx - 2.4, y: CLOUD_FLOOR_Y, z: b2.z + bed.lz };
    movePlayer(walker, 3, 0, R, cols);
    expect(walker.x).toBeLessThan(b2.x + bed.lx - 0.4);
  });

  it('the ladder ends on the platform and the rider faces along the chute', () => {
    const foot = ladderPose(0);
    const top = ladderPose(1);
    expect(foot.ly).toBeLessThan(0.05);
    expect(top.ly).toBeCloseTo(PLATFORM_TOP);
    expect(Math.hypot(top.lx - SLIDE_START.lx, top.lz - SLIDE_START.lz)).toBeLessThan(0.05);
    const early = slidePose(0.15);
    const later = slidePose(0.16);
    const along = Math.atan2(later.lx - early.lx, later.lz - early.lz);
    const yawGap = Math.atan2(Math.sin(early.yaw - along), Math.cos(early.yaw - along));
    expect(Math.abs(yawGap)).toBeLessThan(0.05);
    expect(early.tilt).toBeGreaterThan(0.25);
    expect(early.ly).toBeGreaterThan(slidePose(0.85).ly);
    const b = CLOUDS.find((c) => c.id === 'badeland')!;
    expect(skyPlatformTop(b.x + SLIDE_START.lx, b.z + SLIDE_START.lz)).toBe(CLOUD_FLOOR_Y + PLATFORM_TOP);
    expect(skyPlatformTop(b.x, b.z)).toBeNull();
  });

  it('rainbow trees block their trunks and leave the forest middle open', () => {
    const skog = CLOUDS.find((c) => c.id === 'skog')!;
    expect(blocked(skog.x, skog.z, R, cols, CLOUD_FLOOR_Y)).toBe(false);
    expect(blocked(skog.x - 6, skog.z - 4, R, cols, CLOUD_FLOOR_Y)).toBe(true);
    for (const [lx, lz] of FOREST_TREES) {
      expect(Math.hypot(lx, lz), `${lx},${lz}`).toBeLessThan(13.5);
    }
    for (let i = 0; i < RAIN_COIN_COUNT; i++) {
      const coin = rainCoinWorld(i);
      for (const [lx, lz] of FOREST_TREES) {
        const d = Math.hypot(coin.x - (skog.x + lx), coin.z - (skog.z + lz));
        expect(d, `coin ${i} tree ${lx},${lz}`).toBeGreaterThan(1.3);
      }
    }
  });
});

describe('rainbow egg and rope', () => {
  it('the town egg shop does not sell the rainbow egg, and the cloud egg hatches', () => {
    expect(EGGS.some((e) => e.id === RAINBOW_EGG_ID)).toBe(true);
    expect(groundShopEggs(true).some((e) => e.id === RAINBOW_EGG_ID)).toBe(false);
    expect(groundShopEggs(false).some((e) => e.id === 'egg-start')).toBe(true);
    const poor = buyAndHatch({ ...freshSave(0), bucks: 10 }, RAINBOW_EGG_ID, seeded(1), 0);
    expect(poor.ok).toBe(false);
    const rich = buyAndHatch({ ...freshSave(0), bucks: 1000 }, RAINBOW_EGG_ID, seeded(2), 5);
    expect(rich.ok).toBe(true);
    if (rich.ok) {
      expect(rich.pet.speciesId).toBeTruthy();
      expect(rich.save.bucks).toBe(1000 - 260);
      expect(rich.save.pets).toHaveLength(1);
      expect(rich.save.stats.hatched).toBe(1);
    }
  });

  it('the rope is bought once and climbing pays a small reward on a cooldown', () => {
    let s = { ...freshSave(0), bucks: START_BUCKS };
    expect(climbWithRope(s, 0).ok).toBe(false);
    expect(buyRope({ ...s, bucks: 10 }).ok).toBe(false);
    const bought = buyRope(s);
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    expect(bought.save.bucks).toBe(START_BUCKS - ROPE_PRICE);
    expect(bought.save.bag.klatretau).toBe(1);
    expect(buyRope(bought.save).ok).toBe(false);
    const up = climbWithRope(bought.save, 1_000);
    expect(up.ok).toBe(true);
    if (!up.ok) return;
    expect(up.reward).toBe(CLIMB_REWARD);
    expect(up.save.bucks).toBe(bought.save.bucks + CLIMB_REWARD);
    expect(climbWithRope(up.save, 1_000 + CLIMB_COOLDOWN_MS - 1).ok).toBe(false);
    const again = climbWithRope(up.save, 1_000 + CLIMB_COOLDOWN_MS);
    expect(again.ok).toBe(true);
  });
});

describe('rainbow forest rain', () => {
  it('waits a true 20 minutes and does not pay on a fresh load', () => {
    const now = 1_700_000_000_000;
    const fresh = freshRain(now);
    const view = rainView(fresh, now);
    expect(view.active).toBe(false);
    expect(view.msUntil).toBe(RAIN_INTERVAL_MS);
    expect(view.coinsLeft).toBe(0);
    expect(formatCountdown(RAIN_INTERVAL_MS)).toBe('20:00');
    const loaded = parseSave(JSON.stringify({ ...freshSave(now), skyRain: undefined }), now);
    expect(loaded.skyRain?.stormId).toBeNull();
    expect((loaded.skyRain?.nextAt ?? 0) - now).toBe(RAIN_INTERVAL_MS);
  });

  it('opens one storm on time, each coin once, and a reload keeps what was collected', () => {
    const now = 5_000_000;
    const start = freshRain(now);
    const atStorm = rainView(start, now + RAIN_INTERVAL_MS + 1000);
    expect(atStorm.active).toBe(true);
    expect(atStorm.coinsLeft).toBe(RAIN_COIN_COUNT);
    const first = collectRainCoin(atStorm.state, 0, now + RAIN_INTERVAL_MS + 1000);
    expect(first.ok).toBe(true);
    const again = collectRainCoin(first.state, 0, now + RAIN_INTERVAL_MS + 2000);
    expect(again.ok).toBe(false);
    expect(again.reason).toBe('taken');
    const reloaded = normalizeRain(first.state, now + RAIN_INTERVAL_MS + 3000);
    expect(reloaded.collected).toEqual([0]);
    expect(reloaded.stormId).toBe(first.state.stormId);
    let s = { ...freshSave(0), bucks: 100, skyRain: atStorm.state };
    const paid = collectSkyCoin(s, 1, now + RAIN_INTERVAL_MS + 1000);
    expect(paid.ok).toBe(true);
    if (paid.ok) expect(paid.save.bucks).toBe(100 + RAIN_COIN_VALUE);
    const parsed = parseSave(JSON.stringify(paid.ok ? paid.save : s), now + RAIN_INTERVAL_MS + 4000);
    expect(parsed.skyRain?.collected).toContain(1);
    expect(parsed.bucks).toBe(100 + RAIN_COIN_VALUE);
  });

  it('a clock jump past the window pays nothing, and missed storms do not pile up', () => {
    const now = 10_000_000;
    const start = freshRain(now);
    const jumped = normalizeRain(start, now + RAIN_INTERVAL_MS * 9 + RAIN_WINDOW_MS + 5);
    expect(jumped.stormId).toBeNull();
    expect(jumped.collected).toEqual([]);
    expect(jumped.nextAt - (now + RAIN_INTERVAL_MS * 9 + RAIN_WINDOW_MS + 5)).toBe(RAIN_INTERVAL_MS);
    const early = collectRainCoin(start, 0, now + 1000);
    expect(early.ok).toBe(false);
    expect(early.reason).toBe('inactive');
  });

  it('a clock moved backward does not schedule more than one interval away', () => {
    const now = 50_000_000;
    const far = normalizeRain({ nextAt: now + RAIN_INTERVAL_MS * 5, stormId: null, collected: [] }, now);
    expect(far.nextAt - now).toBe(RAIN_INTERVAL_MS);
  });
});
