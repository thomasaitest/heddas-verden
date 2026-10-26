import { pick, type Rng } from './rng.ts';
import type { OwnedPet } from './pets.ts';

export type NeedKind = 'hungry' | 'thirsty' | 'sleepy' | 'dirty' | 'play' | 'walk';
export type CareAction = 'food' | 'water' | 'sleep' | 'bath' | 'toy' | 'walk';
export type GrowthStage = 'baby' | 'child' | 'teen' | 'adult';

export interface PetState extends OwnedPet {
  need: NeedKind | null;
  /** When the next need shows up (ms epoch). */
  nextNeedAt: number;
  /** Number of needs fulfilled; drives the growth stage. */
  growth: number;
}

export const NEED_INFO: Record<NeedKind, { emoji: string; text: string; action: CareAction }> = {
  hungry: { emoji: '🍎', text: 'Jeg er sulten!', action: 'food' },
  thirsty: { emoji: '💧', text: 'Jeg er tørst!', action: 'water' },
  sleepy: { emoji: '💤', text: 'Jeg er trøtt …', action: 'sleep' },
  dirty: { emoji: '🫧', text: 'Jeg vil bade!', action: 'bath' },
  play: { emoji: '🧸', text: 'Skal vi leke?', action: 'toy' },
  walk: { emoji: '🌳', text: 'Vil gå på tur!', action: 'walk' },
};

export const CARE_INFO: Record<CareAction, { emoji: string; name: string }> = {
  food: { emoji: '🍎', name: 'Mat' },
  water: { emoji: '💧', name: 'Vann' },
  sleep: { emoji: '🛏️', name: 'Sove' },
  bath: { emoji: '🛁', name: 'Bad' },
  toy: { emoji: '🧸', name: 'Leke' },
  walk: { emoji: '🦮', name: 'Tur' },
};

/** Furniture that fulfils a need when a pet is dropped on it. */
export const FURNITURE_ACTION: Record<string, CareAction> = {
  bed: 'sleep',
  starbed: 'sleep',
  canopybed: 'sleep',
  sofa: 'sleep',
  bathtub: 'bath',
  dancefloor: 'toy',
  beanbag: 'toy',
  table: 'food',
};

export const STAGES: { id: GrowthStage; name: string; at: number; scale: number }[] = [
  { id: 'baby', name: 'Baby', at: 0, scale: 0.75 },
  { id: 'child', name: 'Barn', at: 3, scale: 0.88 },
  { id: 'teen', name: 'Tenåring', at: 8, scale: 1 },
  { id: 'adult', name: 'Voksen', at: 15, scale: 1.12 },
];

export const NEED_POINTS = 5;
export const GROW_UP_BONUS = 15;
export const NEED_DELAY_MIN = 15_000;
export const NEED_DELAY_MAX = 40_000;

export function stageOf(growth: number): (typeof STAGES)[number] {
  let stage = STAGES[0];
  for (const s of STAGES) if (growth >= s.at) stage = s;
  return stage;
}

/** Progress (0–1) toward the next stage; 1 when fully grown. */
export function growthProgress(growth: number): number {
  const i = STAGES.indexOf(stageOf(growth));
  const next = STAGES[i + 1];
  if (!next) return 1;
  return (growth - STAGES[i].at) / (next.at - STAGES[i].at);
}

export function nextNeedDelay(rng: Rng): number {
  return NEED_DELAY_MIN + Math.floor(rng() * (NEED_DELAY_MAX - NEED_DELAY_MIN));
}

export function toPetState(pet: OwnedPet, now: number, firstNeedSoon = true): PetState {
  return { ...pet, need: null, nextNeedAt: now + (firstNeedSoon ? 2_000 : NEED_DELAY_MIN), growth: 0 };
}

/** Give a pet a new need when its timer is up. Pets don't repeat the need they just had. */
export function tickNeed(pet: PetState, now: number, rng: Rng, lastNeed?: NeedKind): PetState {
  if (pet.need || now < pet.nextNeedAt) return pet;
  const kinds = (Object.keys(NEED_INFO) as NeedKind[]).filter((k) => k !== lastNeed);
  return { ...pet, need: pick(kinds, rng) };
}

export interface CareResult {
  pet: PetState;
  ok: boolean;
  points: number;
  grewUp: boolean;
}

/** Try to fulfil the pet's current need with an action. Wrong or no need: nothing happens. */
export function care(pet: PetState, action: CareAction, now: number, rng: Rng): CareResult {
  if (!pet.need || NEED_INFO[pet.need].action !== action) return { pet, ok: false, points: 0, grewUp: false };
  const before = stageOf(pet.growth);
  const growth = pet.growth + 1;
  const grewUp = stageOf(growth).id !== before.id;
  return {
    pet: { ...pet, need: null, growth, nextNeedAt: now + nextNeedDelay(rng) },
    ok: true,
    points: NEED_POINTS + (grewUp ? GROW_UP_BONUS : 0),
    grewUp,
  };
}
