import { FLIGHT_LESSONS, SPECIES_BY_ID, type OwnedPet } from './pets.ts';
import { pickWeighted, type Rng } from './rng.ts';

export type NeedKind = 'sulten' | 'torst' | 'trott' | 'skitten' | 'kjedelig' | 'syk' | 'tur';
/** Where or how a need is fixed. */
export type CareWhere = 'mat' | 'drikke' | 'seng' | 'bad' | 'lek' | 'dyrlege' | 'tur';

export interface Need {
  kind: NeedKind;
  since: number;
  /** 0–1 */
  progress: number;
}

export interface PetState extends OwnedPet {
  xp: number;
  /** Highest-priority need (kept so older saves and care prompts stay simple). */
  need: Need | null;
  /** Every current need. Sick, dirty and tired can be true together. */
  needs?: Need[];
  /** Wing practice for a pet that has wings but cannot fly yet. Full means it has learned, or was already able to fly. */
  flyLessons?: number;
  nextNeedAt: number;
  lastNeed: NeedKind | null;
  /** How happy the pet is, 0–1 right after `joyAt` (playing with toys raises it; it fades over 10 minutes). Missing = 0. */
  joy?: number;
  joyAt?: number;
}

export const JOY_FADE_MS = 10 * 60_000;
/** Happiness right now (0–1). */
export function joyNow(pet: Pick<PetState, 'joy' | 'joyAt'>, now: number): number {
  const j = pet.joy ?? 0;
  if (j <= 0) return 0;
  return Math.max(0, Math.min(1, j - Math.max(0, now - (pet.joyAt ?? now)) / JOY_FADE_MS));
}
export function addJoy<T extends PetState>(pet: T, amount: number, now: number): T {
  return { ...pet, joy: Math.max(0, Math.min(1, joyNow(pet, now) + amount)), joyAt: now };
}

export const NEED_INFO: Record<NeedKind, { label: string; emoji: string; where: CareWhere; hint: string; reward: number; weight: number }> = {
  sulten: { label: 'Sulten', emoji: '🍎', where: 'mat', hint: 'Kjøp mat i Butikken og gi den til dyret', reward: 20, weight: 4 },
  torst: { label: 'Tørst', emoji: '🥤', where: 'drikke', hint: 'Kjøp drikke i Butikken og gi den til dyret', reward: 20, weight: 4 },
  trott: { label: 'Trøtt', emoji: '💤', where: 'seng', hint: 'Gå hjem og stå ved en seng', reward: 25, weight: 3 },
  skitten: { label: 'Skitten', emoji: '🫧', where: 'bad', hint: 'Gå hjem til badekaret eller dusjen', reward: 25, weight: 3 },
  kjedelig: { label: 'Kjeder seg', emoji: '⚽', where: 'lek', hint: 'Lek på Lekeplassen (eller med leker hjemme)', reward: 25, weight: 3 },
  tur: { label: 'Vil på tur', emoji: '🌳', where: 'tur', hint: 'Gå en tur ute i byen', reward: 25, weight: 2 },
  syk: { label: 'Syk!', emoji: '🤒', where: 'dyrlege', hint: 'Ta dyret med til Dyrlegen!', reward: 35, weight: 0 },
};

/** Seconds standing at the right place (or meters walked for a walk). */
export const CARE_AMOUNT: Record<CareWhere, number> = { mat: 1, drikke: 1, seng: 6, bad: 5, lek: 6, dyrlege: 5, tur: 40 };

/** A need left alone this long turns into sickness. */
export const SICK_AFTER = 4 * 60_000;
export const RANDOM_SICK_CHANCE = 0.08;
export const NEED_DELAY_MIN = 20_000;
export const NEED_DELAY_MAX = 50_000;
export const GROW_BONUS = 60;

export const STAGES = [
  { name: 'Nyfødt', at: 0, scale: 0.7 },
  { name: 'Baby', at: 2, scale: 0.8 },
  { name: 'Barn', at: 5, scale: 0.9 },
  { name: 'Tenåring', at: 9, scale: 1.0 },
  { name: 'Ungdom', at: 14, scale: 1.1 },
  { name: 'Voksen', at: 20, scale: 1.2 },
] as const;

export function stageIndex(xp: number): number {
  let idx = 0;
  STAGES.forEach((s, i) => {
    if (xp >= s.at) idx = i;
  });
  return idx;
}
export function stageOf(xp: number) {
  return STAGES[stageIndex(xp)];
}
export function stageProgress(xp: number): number {
  const i = stageIndex(xp);
  const next = STAGES[i + 1];
  if (!next) return 1;
  return (xp - STAGES[i].at) / (next.at - STAGES[i].at);
}

/** How many needs a pet may carry at once. Badges only show the first three. */
export const MAX_NEEDS = 4;
export const MAX_STATUS_BADGES = 3;

/** Lower number = shown and cared about first. */
export const NEED_RANK: Record<NeedKind, number> = {
  syk: 0,
  sulten: 1,
  torst: 2,
  trott: 3,
  skitten: 4,
  kjedelig: 5,
  tur: 6,
};

export function allNeeds(pet: { need?: Need | null; needs?: Need[] | null }): Need[] {
  const listed = Array.isArray(pet.needs) ? pet.needs.filter((n) => !!n && !!NEED_INFO[n.kind]) : [];
  if (listed.length) return listed;
  return pet.need && NEED_INFO[pet.need.kind] ? [pet.need] : [];
}

/** Store needs in priority order and mirror the top one on `need`. */
export function syncNeeds<T extends PetState>(pet: T, needs: Need[]): T {
  const sorted = needs
    .filter((n) => !!NEED_INFO[n.kind])
    .slice(0, MAX_NEEDS)
    .sort((a, b) => NEED_RANK[a.kind] - NEED_RANK[b.kind] || a.since - b.since);
  return { ...pet, needs: sorted, need: sorted[0] ?? null };
}

/** Up to three badges, highest priority first. Extra needs stay in the save but are not drawn. */
export function badgeNeeds(pet: { need?: Need | null; needs?: Need[] | null }, limit = MAX_STATUS_BADGES): Need[] {
  return [...allNeeds(pet)].sort((a, b) => NEED_RANK[a.kind] - NEED_RANK[b.kind] || a.since - b.since).slice(0, limit);
}

export function newPetState(pet: OwnedPet, now: number): PetState {
  return {
    ...pet,
    xp: 0,
    need: null,
    needs: [],
    flyLessons: pet.flyable ? FLIGHT_LESSONS : 0,
    nextNeedAt: now + 4_000,
    lastNeed: null,
  };
}

export function nextDelay(rng: Rng): number {
  return NEED_DELAY_MIN + Math.floor(rng() * (NEED_DELAY_MAX - NEED_DELAY_MIN));
}

export function rollNeed(last: NeedKind | null, rng: Rng, allowSick = true): NeedKind {
  if (allowSick && rng() < RANDOM_SICK_CHANCE) return 'syk';
  const kinds = (Object.keys(NEED_INFO) as NeedKind[]).filter((k) => k !== last && NEED_INFO[k].weight > 0);
  return pickWeighted(kinds, (k) => NEED_INFO[k].weight, rng);
}

function withSickness(needs: Need[], now: number): Need[] {
  const overdue = needs.some((n) => n.kind !== 'syk' && now - n.since > SICK_AFTER);
  if (!overdue || needs.some((n) => n.kind === 'syk')) return needs;
  return [...needs, { kind: 'syk', since: now, progress: 0 }];
}

/**
 * Advance time for one pet.
 * Several needs can be active together. One that is ignored too long adds sickness
 * without erasing the others. A brand-new pet does not start out sick.
 */
export function tickPet(pet: PetState, now: number, rng: Rng): PetState {
  let needs = allNeeds(pet);
  const sick = withSickness(needs, now);
  const legacy = !Array.isArray(pet.needs);
  if (needs.length === 0) {
    if (now < pet.nextNeedAt) return pet;
    const kind = rollNeed(pet.lastNeed, rng, pet.xp >= 2);
    return syncNeeds({ ...pet, nextNeedAt: now + nextDelay(rng) }, [{ kind, since: now, progress: 0 }]);
  }
  // Older saves stored a single need. Don't pile extras on the first load; just schedule the next one.
  if (legacy) {
    const nextAt = now >= pet.nextNeedAt ? now + nextDelay(rng) : pet.nextNeedAt;
    const normalized = syncNeeds({ ...pet, nextNeedAt: nextAt }, sick);
    return normalized.need?.kind === pet.need?.kind && sick.length === needs.length && nextAt === pet.nextNeedAt ? pet : normalized;
  }
  if (sick.length !== needs.length) needs = sick;
  if (needs.length < MAX_NEEDS && now >= pet.nextNeedAt) {
    const have = new Set(needs.map((n) => n.kind));
    let kind = rollNeed(pet.lastNeed, rng, false);
    for (let i = 0; i < 6 && (have.has(kind) || kind === 'syk'); i++) kind = rollNeed(needs[needs.length - 1]?.kind ?? pet.lastNeed, rng, false);
    if (!have.has(kind)) needs = [...needs, { kind, since: now, progress: 0 }];
    return syncNeeds({ ...pet, nextNeedAt: now + nextDelay(rng) }, needs);
  }
  if (needs !== sick || sick.length !== allNeeds(pet).length) return syncNeeds(pet, needs);
  return pet;
}

/** Add care at a place. Any matching need counts, not only the top badge. */
export function addCare(pet: PetState, where: CareWhere, amount: number): { pet: PetState; done: boolean } {
  const needs = allNeeds(pet);
  const idx = needs.findIndex((n) => NEED_INFO[n.kind].where === where);
  if (idx < 0 || amount <= 0) return { pet, done: false };
  const progress = Math.min(1, needs[idx].progress + amount / CARE_AMOUNT[where]);
  const next = needs.map((n, i) => (i === idx ? { ...n, progress } : n));
  return { pet: syncNeeds(pet, next), done: progress >= 1 };
}

export interface CompleteResult {
  pet: PetState;
  reward: number;
  grewUp: boolean;
  /** A winged pet just finished flight practice. */
  learnedFly: boolean;
  flyLessons: number;
}

/** Finish the need that reached the end. Other needs stay. Winged pets practice flying this way. */
export function completeNeed(pet: PetState, now: number, rng: Rng): CompleteResult {
  const needs = allNeeds(pet);
  const done = needs.find((n) => n.progress >= 1) ?? null;
  if (!done) return { pet, reward: 0, grewUp: false, learnedFly: false, flyLessons: pet.flyLessons ?? 0 };
  const before = stageIndex(pet.xp);
  const xp = pet.xp + 1;
  const grewUp = stageIndex(xp) > before;
  const reward = NEED_INFO[done.kind].reward + (grewUp ? GROW_BONUS : 0);
  const rest = needs.filter((n) => n.kind !== done.kind);
  const winged = !!SPECIES_BY_ID[pet.speciesId]?.wings;
  let flyLessons = pet.flyLessons ?? (pet.flyable ? FLIGHT_LESSONS : 0);
  let learnedFly = false;
  let flyable = pet.flyable;
  if (winged && !flyable) {
    flyLessons = Math.min(FLIGHT_LESSONS, flyLessons + 1);
    if (flyLessons >= FLIGHT_LESSONS) {
      flyable = true;
      learnedFly = true;
    }
  }
  const next = syncNeeds(
    { ...pet, xp, flyable, flyLessons, lastNeed: done.kind, nextNeedAt: now + nextDelay(rng) },
    rest,
  );
  return { pet: next, reward, grewUp, learnedFly, flyLessons };
}
