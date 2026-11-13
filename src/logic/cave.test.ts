import { describe, expect, it } from 'vitest';
import { blocked, movePlayer } from './collision.ts';
import { CAVE_EXIT, CAVE_R, CAVE_ROPE, CAVE_ROCKS, CAVE_SPAWN, caveColliders, inCave } from './cave.ts';
import { CLOUDS } from './sky.ts';
import { freshSave, parseSave } from './save.ts';

const R = 0.55;

describe('inner cave', () => {
  const cols = caveColliders();

  it('is larger than the little peak, and the rope counter stops you', () => {
    expect(CAVE_R).toBeGreaterThan(24);
    const fjell = CLOUDS.find((c) => c.id === 'fjell')!;
    expect(CAVE_R).toBeGreaterThan(fjell.r * 3);
    expect(inCave(0, 0)).toBe(true);
    expect(inCave(0, CAVE_R + 2)).toBe(false);
    expect(blocked(CAVE_ROPE.x, CAVE_ROPE.z + 1.4, R, cols)).toBe(true);
    expect(blocked(CAVE_SPAWN.x, CAVE_SPAWN.z, R, cols)).toBe(false);
    expect(blocked(CAVE_EXIT.x, CAVE_EXIT.z, R, cols)).toBe(false);
  });

  it('a walker cannot pass through a rock or the outer wall', () => {
    const rock = CAVE_ROCKS[0];
    const pos = { x: rock.x - rock.r - 2, y: 0, z: rock.z };
    movePlayer(pos, 6, 0, R, cols);
    expect(pos.x).toBeLessThan(rock.x - rock.r);
    const edge = { x: 0, y: 0, z: CAVE_R - 3 };
    movePlayer(edge, 0, 8, R, cols);
    expect(edge.z).toBeLessThan(CAVE_R - 0.5);
  });

  it('older saves stay in town, and a cave save remembers the realm', () => {
    const old = parseSave(JSON.stringify({ ...freshSave(0), skyRealm: undefined }), 0);
    expect(old.skyRealm).toBeUndefined();
    const inside = parseSave(JSON.stringify({ ...freshSave(0), skyRealm: 'cave', caveX: 2, caveZ: -4 }), 0);
    expect(inside.skyRealm).toBe('cave');
    expect(inside.caveX).toBe(2);
    expect(inside.caveZ).toBe(-4);
    const junk = parseSave(JSON.stringify({ ...freshSave(0), skyRealm: 'moon' }), 0);
    expect(junk.skyRealm).toBeUndefined();
  });
});
