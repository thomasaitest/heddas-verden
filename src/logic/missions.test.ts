import { describe, expect, it } from 'vitest';
import { MISSIONS, missionDone, missionProgress, offerMission } from './missions.ts';

describe('missions', () => {
  it('offers a known mission and can avoid the previous kind', () => {
    const a = offerMission(() => 0.1);
    expect(MISSIONS.some((m) => m.kind === a.kind)).toBe(true);
    const b = offerMission(() => 0.1, a.kind);
    expect(b.kind).not.toBe(a.kind);
  });

  it('tracks progress to completion', () => {
    let m = offerMission(() => 0);
    expect(missionDone(m)).toBe(false);
    m = missionProgress(m, 0.6);
    expect(m.progress).toBeCloseTo(0.6);
    m = missionProgress(m, 0.5);
    expect(missionDone(m)).toBe(true);
  });
});
