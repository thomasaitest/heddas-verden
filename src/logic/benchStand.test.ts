import { describe, expect, it } from 'vitest';
import { standInFrontOfBench } from './benchStand.ts';
import { benchForward } from './townLayout.ts';

describe('standInFrontOfBench', () => {
  it('places the avatar along the sit forward vector, not on the seat', () => {
    const sit = { x: 10, z: -4, yaw: 0 };
    const stand = standInFrontOfBench(sit, 1.65);
    const f = benchForward(sit.yaw);
    expect(stand.x).toBeCloseTo(sit.x + f.x * 1.65);
    expect(stand.z).toBeCloseTo(sit.z + f.z * 1.65);
    expect(Math.hypot(stand.x - sit.x, stand.z - sit.z)).toBeGreaterThan(1.4);
  });
});
