/** Player quests ("Oppdrag") — separate from pet-need "Oppgaver". */

export type MissionKind = 'kjør' | 'benk' | 'butikk' | 'epler' | 'fest' | 'dyrlege';

export interface MissionDef {
  kind: MissionKind;
  title: string;
  hint: string;
  emoji: string;
  reward: number;
}

export const MISSIONS: MissionDef[] = [
  { kind: 'kjør', title: 'Ta en biltur', hint: 'Kjør bilen litt rundt i byen', emoji: '🚗', reward: 15 },
  { kind: 'benk', title: 'Hvile på benken', hint: 'Sett deg på en benk og reis deg igjen', emoji: '🪑', reward: 10 },
  { kind: 'butikk', title: 'Besøk butikken', hint: 'Gå inn i matbutikken (til fots)', emoji: '🛒', reward: 12 },
  { kind: 'epler', title: 'Plukk epler', hint: 'La dyret plukke epler fra et tre', emoji: '🍎', reward: 18 },
  { kind: 'fest', title: 'Fest på torget', hint: 'Ta dyret med på fest ved fontenen', emoji: '💃', reward: 20 },
  { kind: 'dyrlege', title: 'Hjelp et sykt dyr', hint: 'Hos dyrlegen: trykk for å legge dyret i sengen', emoji: '🩺', reward: 25 },
];

export const MISSION_BY_KIND = Object.fromEntries(MISSIONS.map((m) => [m.kind, m])) as Record<MissionKind, MissionDef>;

export interface MissionState {
  kind: MissionKind;
  /** 0–1 progress toward completion. */
  progress: number;
  offeredAt: number;
}

/** Pick a random mission, optionally avoiding the current one. */
export function offerMission(rng: () => number, avoid?: MissionKind | null): MissionState {
  const pool = avoid ? MISSIONS.filter((m) => m.kind !== avoid) : MISSIONS;
  const pick = pool[Math.floor(rng() * pool.length) % pool.length] ?? MISSIONS[0];
  return { kind: pick.kind, progress: 0, offeredAt: Date.now() };
}

export function missionProgress(m: MissionState, add: number): MissionState {
  return { ...m, progress: Math.max(0, Math.min(1, m.progress + add)) };
}

export function missionDone(m: MissionState): boolean {
  return m.progress >= 1;
}
