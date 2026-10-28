/** Day/night cycle and light weather for the outdoor town (pure maths). */

export type WeatherKind = 'clear' | 'cloudy' | 'rain';

export interface SkyState {
  /** 0..1 through a full day (0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk). */
  dayT: number;
  weather: WeatherKind;
  /** 0 = night, 1 = full day. */
  daylight: number;
  sunElevation: number;
  skyTop: string;
  skyHorizon: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  sunColor: string;
  sunIntensity: number;
  /** Rain particle density 0..1. */
  rain: number;
}

/** Real-time seconds for one full in-game day. */
export const DAY_SECONDS = 180;

/** Weather changes every this many real seconds (deterministic from seed+time). */
export const WEATHER_SLOT = 45;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function hexMix(a: string, b: string, t: number): string {
  const parse = (h: string) => {
    const s = h.replace('#', '');
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  };
  const A = parse(a);
  const B = parse(b);
  const m = (i: number) => Math.round(A[i] + (B[i] - A[i]) * t);
  return `#${[m(0), m(1), m(2)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

export function weatherAt(slot: number): WeatherKind {
  const k = ((slot % 7) + 7) % 7;
  if (k === 0 || k === 3) return 'rain';
  if (k === 1 || k === 5) return 'cloudy';
  return 'clear';
}

/** Pure sky state from elapsed seconds since an arbitrary epoch. */
export function skyAt(elapsedSec: number): SkyState {
  const dayT = ((elapsedSec % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS / DAY_SECONDS;
  // Smooth daylight: night around 0 and 1, bright mid-day.
  const ang = dayT * Math.PI * 2;
  const sunElevation = Math.sin(ang - Math.PI / 2); // -1..1, peak at noon (dayT=0.5)
  const daylight = clamp01(sunElevation * 0.9 + 0.55);

  const slot = Math.floor(elapsedSec / WEATHER_SLOT);
  const weather = weatherAt(slot);

  const nightTop = '#0b1a3a';
  const dawnTop = '#ff9a6b';
  const dayTop = '#9fdcff';
  const duskTop = '#ff7a9a';
  let skyTop: string;
  if (dayT < 0.22) skyTop = hexMix(nightTop, dawnTop, dayT / 0.22);
  else if (dayT < 0.35) skyTop = hexMix(dawnTop, dayTop, (dayT - 0.22) / 0.13);
  else if (dayT < 0.65) skyTop = dayTop;
  else if (dayT < 0.78) skyTop = hexMix(dayTop, duskTop, (dayT - 0.65) / 0.13);
  else skyTop = hexMix(duskTop, nightTop, (dayT - 0.78) / 0.22);

  if (weather === 'cloudy') skyTop = hexMix(skyTop, '#a8b8c8', 0.45);
  if (weather === 'rain') skyTop = hexMix(skyTop, '#6a7a8c', 0.55);

  const skyHorizon = hexMix(skyTop, '#ffe9c8', 0.35 * daylight);
  const fog = hexMix(skyTop, '#dfefff', 0.4);
  const rain = weather === 'rain' ? 0.55 + 0.25 * (1 - daylight) : 0;

  return {
    dayT,
    weather,
    daylight,
    sunElevation,
    skyTop,
    skyHorizon,
    fog,
    fogNear: 70 + daylight * 40,
    fogFar: 180 + daylight * 60,
    hemiSky: skyTop,
    hemiGround: hexMix('#3a5a2a', '#9ad07a', daylight),
    hemiIntensity: 0.55 + daylight * 1.1,
    sunColor: daylight > 0.35 ? '#fff4dc' : '#ffb08a',
    sunIntensity: Math.max(0.15, daylight * 2.1),
    rain,
  };
}

/** Label for HUD (Norwegian). */
export function skyLabel(s: SkyState): string {
  const tod =
    s.dayT < 0.2 || s.dayT >= 0.85 ? 'Natt' : s.dayT < 0.35 ? 'Morgen' : s.dayT < 0.65 ? 'Dag' : s.dayT < 0.8 ? 'Kveld' : 'Natt';
  if (s.weather === 'rain') return `${tod} · Regn 🌧️`;
  if (s.weather === 'cloudy') return `${tod} · Skyet ☁️`;
  return `${tod} · Sol ☀️`;
}
