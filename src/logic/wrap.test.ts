import { describe, expect, it } from 'vitest';
import { blocked, type Colliders } from './collision.ts';
import { moveWrapped, nearestCopy, seamColliders, wrapCoord, wrapDelta } from './wrap.ts';

const SIZE = 240;

describe('world wrap', () => {
  it('crosses the east edge onto the west side, and the short step points across the cut', () => {
    expect(wrapCoord(SIZE / 2 + 3, SIZE)).toBeCloseTo(-SIZE / 2 + 3);
    expect(wrapCoord(-SIZE / 2 - 4, SIZE)).toBeCloseTo(SIZE / 2 - 4);
    expect(wrapDelta(SIZE / 2 - 2, -SIZE / 2 + 3, SIZE)).toBeCloseTo(5);
    expect(wrapDelta(0, 10, SIZE)).toBeCloseTo(10);
  });

  it('a walker who steps past the edge comes out on the opposite side', () => {
    const pos = { x: SIZE / 2 - 1, y: 0, z: 4 };
    moveWrapped(pos, 6, 0, 0.5, { rects: [], circles: [] }, SIZE);
    expect(pos.x).toBeLessThan(0);
    expect(pos.x).toBeCloseTo(-SIZE / 2 + 5, 0);
    expect(pos.z).toBeCloseTo(4);
  });

  it('a solid on the far side blocks you as you cross', () => {
    const cols: Colliders = { rects: [], circles: [{ x: -SIZE / 2 + 2, z: 0, r: 1.2, h: 4 }] };
    const pos = { x: SIZE / 2 - 0.4, y: 0, z: 0 };
    moveWrapped(pos, 4, 0, 0.5, cols, SIZE);
    expect(Math.abs(pos.x)).toBeGreaterThan(SIZE / 2 - 4);
    const seen = seamColliders(cols, SIZE, SIZE / 2 - 1, 0);
    expect(blocked(SIZE / 2 + 0.8, 0, 0.5, seen)).toBe(true);
  });

  it('a friend just across the cut is drawn beside you, not a world away', () => {
    const near = nearestCopy(-SIZE / 2 + 2, 8, SIZE / 2 - 3, 8, SIZE);
    expect(near.x).toBeGreaterThan(SIZE / 2);
    expect(near.z).toBeCloseTo(8);
    const same = nearestCopy(4, 4, 5, 5, SIZE);
    expect(same.x).toBeCloseTo(4);
    expect(same.z).toBeCloseTo(4);
  });
});
