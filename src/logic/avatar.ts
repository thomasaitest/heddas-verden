import { pick, type Rng } from './rng.ts';

export const SKIN = ['#ffe0c7', '#f9d1b0', '#eab48c', '#d79a6b', '#b77a4f', '#8d5a3b', '#5e3b26', '#ffd84d'];
export const HAIR_STYLES = [
  { id: 'ingen', name: 'Skallet' },
  { id: 'kort', name: 'Kort' },
  { id: 'lang', name: 'Langt' },
  { id: 'hestehale', name: 'Hestehale' },
  { id: 'fletter', name: 'Musefletter' },
  { id: 'bob', name: 'Pasje' },
  { id: 'krus', name: 'Krøller' },
  { id: 'piggete', name: 'Piggete' },
] as const;
export const HAIR_COLORS = ['#2b2118', '#5b3a29', '#a0632f', '#e0a64f', '#fff0a8', '#ff6f6f', '#ff8fc7', '#c88bff', '#5cc3f2', '#7ccf6a', '#ffffff'];
export const FACES = [
  { id: 'smil', name: 'Smil' },
  { id: 'glad', name: 'Glad' },
  { id: 'blunk', name: 'Blunk' },
  { id: 'katt', name: 'Kattemunn' },
  { id: 'rodme', name: 'Rødmer' },
  { id: 'kul', name: 'Kul' },
  { id: 'wow', name: 'Wow' },
  { id: 'tunge', name: 'Tunge ut' },
] as const;
export const CLOTH_COLORS = ['#ff6f6f', '#ff8fb1', '#ffa6d5', '#ffb84d', '#ffe066', '#7ccf6a', '#9ad8c8', '#5cc3f2', '#3f6fd8', '#c88bff', '#ffffff', '#555a75', '#2b2b38', '#8a5a3c'];
export const SHIRT_PRINTS = [
  { id: 'ingen', name: 'Glatt' },
  { id: 'striper', name: 'Striper' },
  { id: 'hjerte', name: 'Hjerte' },
  { id: 'stjerne', name: 'Stjerne' },
  { id: 'pote', name: 'Pote' },
] as const;
export const HATS = [
  { id: 'ingen', name: 'Ingen' },
  { id: 'caps', name: 'Caps' },
  { id: 'krone', name: 'Krone' },
  { id: 'lue', name: 'Lue' },
  { id: 'katteorer', name: 'Katteører' },
  { id: 'kaninorer', name: 'Kaninører' },
  { id: 'cowboy', name: 'Cowboyhatt' },
  { id: 'blomster', name: 'Blomsterkrans' },
  { id: 'trollmann', name: 'Trollmannshatt' },
] as const;
export const ACCESSORIES = [
  { id: 'ingen', name: 'Ingen' },
  { id: 'briller', name: 'Briller' },
  { id: 'vinger', name: 'Feevinger' },
  { id: 'sekk', name: 'Ryggsekk' },
  { id: 'skjerf', name: 'Skjerf' },
  { id: 'kappe', name: 'Kappe' },
  { id: 'glorie', name: 'Glorie' },
] as const;

export interface Avatar {
  skin: string;
  hair: (typeof HAIR_STYLES)[number]['id'];
  hairColor: string;
  face: (typeof FACES)[number]['id'];
  shirt: string;
  print: (typeof SHIRT_PRINTS)[number]['id'];
  pants: string;
  shoes: string;
  hat: (typeof HATS)[number]['id'];
  accessory: (typeof ACCESSORIES)[number]['id'];
}

export const DEFAULT_AVATAR: Avatar = {
  skin: SKIN[1],
  hair: 'hestehale',
  hairColor: HAIR_COLORS[3],
  face: 'smil',
  shirt: '#ff8fb1',
  print: 'hjerte',
  pants: '#3f6fd8',
  shoes: '#ffffff',
  hat: 'ingen',
  accessory: 'ingen',
};

export function randomAvatar(rng: Rng): Avatar {
  return {
    skin: pick(SKIN.slice(0, 7), rng),
    hair: pick(HAIR_STYLES.slice(1), rng).id,
    hairColor: pick(HAIR_COLORS, rng),
    face: pick(FACES, rng).id,
    shirt: pick(CLOTH_COLORS, rng),
    print: pick(SHIRT_PRINTS, rng).id,
    pants: pick(CLOTH_COLORS, rng),
    shoes: pick(CLOTH_COLORS, rng),
    hat: rng() < 0.5 ? 'ingen' : pick(HATS, rng).id,
    accessory: rng() < 0.6 ? 'ingen' : pick(ACCESSORIES, rng).id,
  };
}

const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const oneOf = <T extends { id: string }>(list: readonly T[], v: unknown, fallback: T['id']): T['id'] => (list.some((o) => o.id === v) ? (v as T['id']) : fallback);

/** Repair an avatar from storage; unknown parts fall back to defaults. */
export function cleanAvatar(raw: unknown): Avatar {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_AVATAR;
  return {
    skin: isColor(a.skin) ? a.skin : d.skin,
    hair: oneOf(HAIR_STYLES, a.hair, d.hair),
    hairColor: isColor(a.hairColor) ? a.hairColor : d.hairColor,
    face: oneOf(FACES, a.face, d.face),
    shirt: isColor(a.shirt) ? a.shirt : d.shirt,
    print: oneOf(SHIRT_PRINTS, a.print, d.print),
    pants: isColor(a.pants) ? a.pants : d.pants,
    shoes: isColor(a.shoes) ? a.shoes : d.shoes,
    hat: oneOf(HATS, a.hat, d.hat),
    accessory: oneOf(ACCESSORIES, a.accessory, d.accessory),
  };
}
