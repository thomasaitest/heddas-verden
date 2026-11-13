import { beforeAll, describe, expect, it } from 'vitest';
import { blocked, movePlayer } from '../logic/collision.ts';
import { CAVE_ROCKS, caveColliders } from '../logic/cave.ts';
import { installDomStub } from '../test/domStub.ts';
import { unmarkedMeshes, collectColliders } from './colliders.ts';

beforeAll(() => installDomStub());

describe('cave meshes are classified and solid', () => {
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
    const crystal = { x: -8 - 2.4, y: 0, z: 12 };
    movePlayer(crystal, 4, 0, 0.55, cols);
    expect(blocked(-8, 12, 0.4, cols)).toBe(true);
    expect(crystal.x).toBeLessThan(-8);
    expect(blocked(12, 8 + 1.4, 0.4, cols), 'rope counter').toBe(true);
  });
});
