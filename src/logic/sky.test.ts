import { describe, expect, it } from 'vitest';
import { blocked, movePlayer } from './collision.ts';
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
  cloudFloorAt,
  collectRainCoin,
  formatCountdown,
  freshRain,
  groundShopEggs,
  normalizeRain,
  rainView,
  skyAccessText,
  skyColliders,
  skyZones,
  useSkyColliders,
} from './sky.ts';

const R = 0.55;

describe('sky clouds', () => {
  const cols = skyColliders();

  it('has four distinct clouds above the town, and the ground gate only explains the way up', () => {
    expect(CLOUDS.map((c) => c.id)).toEqual(['badeland', 'egg', 'fjell', 'skog']);
    expect(new Set(CLOUDS.map((c) => `${c.x},${c.z}`)).size).toBe(4);
    expect(CLOUD_FLOOR_Y).toBeGreaterThan(30);
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

  it('the cave door is open, the counter and walls are solid', () => {
    const fjell = CLOUDS.find((c) => c.id === 'fjell')!;
    const door = { x: fjell.x, y: CLOUD_FLOOR_Y, z: fjell.z + 1.2 };
    const inside = { x: fjell.x, y: CLOUD_FLOOR_Y, z: fjell.z + 5.2 };
    const pos = { ...door };
    movePlayer(pos, inside.x - door.x, inside.z - door.z, R, cols);
    expect(Math.hypot(pos.x - inside.x, pos.z - inside.z)).toBeLessThan(0.8);
    expect(blocked(fjell.x, fjell.z + 6.4, R, cols, CLOUD_FLOOR_Y)).toBe(true);
    expect(blocked(fjell.x - 4.2, fjell.z + 4.8, R, cols, CLOUD_FLOOR_Y)).toBe(true);
    const outside = { x: fjell.x - 6, y: CLOUD_FLOOR_Y, z: fjell.z + 4.8 };
    movePlayer(outside, 3, 0, R, cols);
    expect(outside.x).toBeLessThan(fjell.x - 4);
  });

  it('the water park slide start and pool are walkable, tower legs are not', () => {
    const b = CLOUDS.find((c) => c.id === 'badeland')!;
    expect(blocked(b.x - 5.2, b.z - 1.2, R, cols, CLOUD_FLOOR_Y)).toBe(false);
    expect(blocked(b.x + 3.2, b.z + 2.6, R, cols, CLOUD_FLOOR_Y)).toBe(false);
    expect(blocked(b.x - 6.3, b.z - 2.4, R, cols, CLOUD_FLOOR_Y)).toBe(true);
    const slide = skyZones().find((z) => z.kind === 'slide')!;
    const splash = skyZones().find((z) => z.kind === 'splash')!;
    expect(cloudAtXZ(slide.x, slide.z)?.id).toBe('badeland');
    expect(cloudAtXZ(splash.x, splash.z)?.id).toBe('badeland');
  });

  it('rainbow trees block their trunks and leave the forest middle open', () => {
    const skog = CLOUDS.find((c) => c.id === 'skog')!;
    expect(blocked(skog.x, skog.z, R, cols, CLOUD_FLOOR_Y)).toBe(false);
    expect(blocked(skog.x - 6, skog.z - 4, R, cols, CLOUD_FLOOR_Y)).toBe(true);
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
