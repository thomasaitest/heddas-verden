import { describe, expect, it } from 'vitest';
import {
  benchBackrestOffset,
  benchSpots,
  buildRoadNetwork,
  buildingsFromPlaces,
  onRoad,
  roadHitsBuilding,
} from './townLayout.ts';

describe('town road network', () => {
  const roads = buildRoadNetwork();
  const buildings = buildingsFromPlaces();

  it('has a real network (ring + approaches + neighbourhood), not only spokes from centre', () => {
    expect(roads.length).toBeGreaterThan(20);
    for (const s of roads) {
      const fromCentre = Math.hypot(s.x1, s.z1) < 1 || Math.hypot(s.x2, s.z2) < 1;
      expect(fromCentre).toBe(false);
    }
  });

  it('no road intersects a building footprint', () => {
    for (const s of roads) {
      for (const b of buildings) {
        expect(roadHitsBuilding(s, b, 0.4), `${b.id} vs ${s.x1.toFixed(0)},${s.z1.toFixed(0)}→${s.x2.toFixed(0)},${s.z2.toFixed(0)}`).toBe(false);
      }
    }
  });

  it('benches never sit on a road', () => {
    const benches = benchSpots(roads);
    expect(benches.length).toBeGreaterThanOrEqual(4);
    for (const b of benches) {
      expect(onRoad(b.x, b.z, roads, 0.9), `${b.x.toFixed(1)},${b.z.toFixed(1)}`).toBe(false);
    }
  });

  it('sit yaw faces away from the backrest for every bench', () => {
    const benches = benchSpots(roads);
    for (const b of benches) {
      const back = benchBackrestOffset(b.yaw);
      const fx = Math.sin(b.yaw);
      const fz = Math.cos(b.yaw);
      const dot = fx * back.x + fz * back.z;
      expect(dot, `${b.x.toFixed(1)},${b.z.toFixed(1)}`).toBeLessThan(-0.2);
    }
  });
});
