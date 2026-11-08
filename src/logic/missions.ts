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

/** Two quests can be in progress at once. Later ones stay visible, but locked, until these are done. */
export const MAX_ACTIVE_QUESTS = 2;

export interface MissionState {
  kind: MissionKind;
  /** 0–1 progress toward completion. */
  progress: number;
  offeredAt: number;
}

export interface QuestLog {
  /** Finished quests, in the order they were completed. */
  done: MissionKind[];
  /** Up to two quests the player is doing now. */
  active: MissionState[];
}

export type QuestVisual = 'active' | 'done' | 'upcoming';

export interface QuestRow {
  kind: MissionKind;
  state: QuestVisual;
  progress: number;
  title: string;
  hint: string;
  emoji: string;
  reward: number;
}

const isKind = (k: unknown): k is MissionKind => typeof k === 'string' && k in MISSION_BY_KIND;

/** The first two quests start active. Nothing is skipped or discarded. */
export function freshQuestLog(now = Date.now()): QuestLog {
  return {
    done: [],
    active: MISSIONS.slice(0, MAX_ACTIVE_QUESTS).map((m) => ({ kind: m.kind, progress: 0, offeredAt: now })),
  };
}

function fillActive(done: MissionKind[], active: MissionState[], now: number): MissionState[] {
  const next = active.slice(0, MAX_ACTIVE_QUESTS);
  for (const m of MISSIONS) {
    if (next.length >= MAX_ACTIVE_QUESTS) break;
    if (done.includes(m.kind) || next.some((a) => a.kind === m.kind)) continue;
    next.push({ kind: m.kind, progress: 0, offeredAt: now });
  }
  return next;
}

/** Repair a saved quest log. Unknown kinds are dropped. Progress already earned is kept. */
export function normalizeQuestLog(raw: unknown, now = Date.now()): QuestLog {
  if (!raw || typeof raw !== 'object') return freshQuestLog(now);
  const o = raw as { done?: unknown; active?: unknown };
  const done: MissionKind[] = [];
  if (Array.isArray(o.done)) {
    for (const k of o.done) if (isKind(k) && !done.includes(k)) done.push(k);
  }
  const active: MissionState[] = [];
  if (Array.isArray(o.active)) {
    for (const item of o.active) {
      if (!item || typeof item !== 'object') continue;
      const kind = (item as { kind?: unknown }).kind;
      if (!isKind(kind) || done.includes(kind) || active.some((a) => a.kind === kind)) continue;
      const progress = Number((item as { progress?: unknown }).progress);
      if (progress >= 1) {
        done.push(kind);
        continue;
      }
      active.push({
        kind,
        progress: Math.max(0, Math.min(0.999, Number.isFinite(progress) ? progress : 0)),
        offeredAt: Number((item as { offeredAt?: unknown }).offeredAt) || now,
      });
      if (active.length >= MAX_ACTIVE_QUESTS) break;
    }
  }
  return { done, active: fillActive(done, active, now) };
}

export function questBoard(log: QuestLog): QuestRow[] {
  const active = new Map(log.active.map((a) => [a.kind, a.progress]));
  const done = new Set(log.done);
  return MISSIONS.map((m) => ({
    kind: m.kind,
    state: done.has(m.kind) ? 'done' : active.has(m.kind) ? 'active' : 'upcoming',
    progress: done.has(m.kind) ? 1 : active.get(m.kind) ?? 0,
    title: m.title,
    hint: m.hint,
    emoji: m.emoji,
    reward: m.reward,
  }));
}

export function questActive(log: QuestLog | undefined, kind: MissionKind): boolean {
  return !!log?.active.some((a) => a.kind === kind);
}

/**
 * Add progress to one active quest. Other active quests are left alone.
 * Completing one unlocks the next upcoming quest. There is no skip.
 */
export function bumpQuest(log: QuestLog, kind: MissionKind, amount: number, now = Date.now()): { log: QuestLog; completed: MissionDef | null; changed: boolean } {
  const i = log.active.findIndex((a) => a.kind === kind);
  if (i < 0 || amount === 0) return { log, completed: null, changed: false };
  const progress = Math.max(0, Math.min(1, log.active[i].progress + amount));
  if (progress < 1) {
    if (progress === log.active[i].progress) return { log, completed: null, changed: false };
    const active = log.active.slice();
    active[i] = { ...active[i], progress };
    return { log: { ...log, active }, completed: null, changed: true };
  }
  const done = [...log.done, kind];
  const active = fillActive(done, log.active.filter((a) => a.kind !== kind), now);
  return { log: { done, active }, completed: MISSION_BY_KIND[kind], changed: true };
}
