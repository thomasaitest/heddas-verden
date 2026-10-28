import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, skyAt, skyLabel, weatherAt } from './weather.ts';

describe('weather / day-night', () => {
  it('cycles through a day', () => {
    const noon = skyAt(DAY_SECONDS * 0.5);
    const midnight = skyAt(0);
    expect(noon.daylight).toBeGreaterThan(midnight.daylight);
    expect(noon.sunIntensity).toBeGreaterThan(midnight.sunIntensity);
  });
  it('picks weather slots', () => {
    expect(['clear', 'cloudy', 'rain']).toContain(weatherAt(0));
    expect(skyLabel(skyAt(10))).toMatch(/Sol|Skyet|Regn/);
  });
});
