import { beforeAll, describe, expect, it } from 'vitest';
import { blocked, movePlayer } from '../logic/collision.ts';
import { AVATAR_BODY_R } from '../logic/avatar.ts';
import { CAVE_CRYSTAL, CAVE_ROCKS, CAVE_ROPE, caveColliders } from '../logic/cave.ts';
import { installDomStub } from '../test/domStub.ts';
import { unmarkedMeshes, collectColliders } from './colliders.ts';

beforeAll(() => installDomStub());

describe('cave meshes are classified and solid', () => {
  it('a standing body, arms included, stays outside every boulder', () => {
    const cols = caveColliders();
    for (const rock of CAVE_ROCKS) {
      const pos = { x: rock.x - rock.r - 4, y: 0, z: rock.z };
      movePlayer(pos, 12, 0, AVATAR_BODY_R, cols);
      expect(Math.hypot(pos.x - rock.x, pos.z - rock.z), `${rock.x},${rock.z}`).toBeGreaterThanOrEqual(rock.r + AVATAR_BODY_R - 0.08);
    }
  });

  it('every mesh is solid, passable or a surface, and a walker stops on rocks and crystals', async () => {
    const { buildCave } = await import('./cave.ts');
    const cave = buildCave();
    expect(unmarkedMeshes(cave.group)).toEqual([]);
    const seen = collectColliders(cave.group);
    expect(seen.circles.length + seen.rects.length).toBeGreaterThan(8);
    const base = caveColliders();
    const cols = { rects: [...base.rects, ...seen.rects], circles: [...base.circles, ...seen.circles] };
    for (const rock of CAVE_ROCKS) {
      const pos = { x: rock.x - rock.r - 2.2, y: 0, z: rock.z };
      movePlayer(pos, 5, 0, 0.55, cols);
      expect(pos.x, `rock ${rock.x}`).toBeLessThan(rock.x - rock.r * 0.4);
    }
    const crystal = { x: CAVE_CRYSTAL.x - 3, y: 0, z: CAVE_CRYSTAL.z };
    movePlayer(crystal, 5, 0, AVATAR_BODY_R, cols);
    expect(blocked(CAVE_CRYSTAL.x, CAVE_CRYSTAL.z, 0.4, cols)).toBe(true);
    expect(Math.hypot(crystal.x - CAVE_CRYSTAL.x, crystal.z - CAVE_CRYSTAL.z)).toBeGreaterThan(0.8);
    expect(blocked(CAVE_ROPE.x, CAVE_ROPE.z + 1.6, 0.4, cols), 'rope counter').toBe(true);
  });
});
