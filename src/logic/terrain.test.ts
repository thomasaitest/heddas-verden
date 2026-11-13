import { describe, expect, it } from 'vitest';
import { PLACES } from './townLayout.ts';
import { GROUND_HILLS, hillHeight, treeOnHill } from './terrain.ts';

describe('ground hills', () => {
  it('each mound rises at the crest and is flat grass just outside it', () => {
    for (const hill of GROUND_HILLS) {
      expect(hillHeight(hill.x, hill.z)).toBeCloseTo(hill.h);
      expect(hillHeight(hill.x + hill.r * 0.5, hill.z)).toBeGreaterThan(1);
      expect(hillHeight(hill.x + hill.r + 2, hill.z)).toBe(0);
      expect(Math.abs(hill.x) + hill.r).toBeLessThan(120);
      expect(Math.abs(hill.z) + hill.r).toBeLessThan(120);
    }
  });

  it('hills stay off the buildings, and a tree on the upper slope is rejected', () => {
    for (const place of Object.values(PLACES)) {
      expect(hillHeight(place.x, place.z), place.id).toBe(0);
      expect(treeOnHill(place.x, place.z), place.id).toBe(false);
    }
    const hill = GROUND_HILLS[0];
    expect(treeOnHill(hill.x, hill.z)).toBe(true);
    expect(treeOnHill(hill.x + hill.r * 0.95, hill.z)).toBe(false);
  });
});
