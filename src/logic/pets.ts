import { pick, pickWeighted, uid, type Rng } from './rng.ts';

export type PetCategory = 'common' | 'insect' | 'fantasy' | 'extinct';
export type Rarity = 'vanlig' | 'uvanlig' | 'sjelden';

export interface PetSpecies {
  id: string;
  name: string;
  emoji: string;
  category: PetCategory;
  /** Species that can become flyable with a lucky roll. */
  canFly?: boolean;
  /** Species that can become rideable with a lucky roll. */
  canRide?: boolean;
  /** Draw small wings on the emoji (winged unicorn). */
  wings?: boolean;
}

export interface OwnedPet {
  uid: string;
  speciesId: string;
  flyable: boolean;
  rideable: boolean;
  obtainedAt: number;
}

export const CATEGORY_INFO: Record<PetCategory, { label: string; rarity: Rarity; weight: number; color: string }> = {
  common: { label: 'Vanlige dyr', rarity: 'vanlig', weight: 56, color: '#7ccf6a' },
  insect: { label: 'Småkryp', rarity: 'uvanlig', weight: 28, color: '#5cc3f2' },
  fantasy: { label: 'Fantasidyr', rarity: 'sjelden', weight: 8, color: '#c88bff' },
  extinct: { label: 'Utdødde dyr', rarity: 'sjelden', weight: 8, color: '#ffae4f' },
};

export const RARITY_LABEL: Record<Rarity, string> = {
  vanlig: 'Vanlig',
  uvanlig: 'Uvanlig',
  sjelden: 'Sjelden!',
};

/** Chance that a species able to fly or be ridden actually gets that power. */
export const LUCK_CHANCE = 0.2;

export const SPECIES: PetSpecies[] = [
  // Common animals
  { id: 'valp', name: 'Valpen Vimse', emoji: '🐶', category: 'common' },
  { id: 'katt', name: 'Pusen Pjokk', emoji: '🐱', category: 'common' },
  { id: 'kanin', name: 'Kaninen Hoppsa', emoji: '🐰', category: 'common' },
  { id: 'hamster', name: 'Hamsteren Nøtt', emoji: '🐹', category: 'common' },
  { id: 'panda', name: 'Pandaen Bambus', emoji: '🐼', category: 'common' },
  { id: 'koala', name: 'Koalaen Kos', emoji: '🐨', category: 'common' },
  { id: 'rev', name: 'Reven Rufsi', emoji: '🦊', category: 'common' },
  { id: 'gris', name: 'Grisen Rosa', emoji: '🐷', category: 'common' },
  { id: 'pingvin', name: 'Pingvinen Vagge', emoji: '🐧', category: 'common' },
  { id: 'skilpadde', name: 'Skilpadden Sakte', emoji: '🐢', category: 'common' },
  { id: 'hest', name: 'Hesten Galopp', emoji: '🐴', category: 'common', canRide: true },
  { id: 'ugle', name: 'Ugla Klokis', emoji: '🦉', category: 'common', canFly: true },
  // Insects
  { id: 'bie', name: 'Bien Summe', emoji: '🐝', category: 'insect', canFly: true },
  { id: 'sommerfugl', name: 'Sommerfuglen Flagre', emoji: '🦋', category: 'insect', canFly: true },
  { id: 'marihone', name: 'Marihøna Prikk', emoji: '🐞', category: 'insect', canFly: true },
  { id: 'larve', name: 'Larven Lange', emoji: '🐛', category: 'insect' },
  { id: 'gresshoppe', name: 'Gresshoppa Sprett', emoji: '🦗', category: 'insect' },
  { id: 'maur', name: 'Mauren Sterk', emoji: '🐜', category: 'insect' },
  { id: 'snegl', name: 'Sneglen Slim', emoji: '🐌', category: 'insect' },
  // Fantasy animals
  { id: 'enhjorning', name: 'Enhjørningen Glitter', emoji: '🦄', category: 'fantasy', canRide: true },
  { id: 'vingehjorning', name: 'Vinge-enhjørningen Stjerne', emoji: '🦄', category: 'fantasy', canFly: true, wings: true },
  { id: 'drage', name: 'Dragen Gnist', emoji: '🐲', category: 'fantasy', canFly: true },
  { id: 'sjodrage', name: 'Sjødragen Bølge', emoji: '🐉', category: 'fantasy', canFly: true },
  // Extinct animals
  { id: 'trex', name: 'T-rex Brøl', emoji: '🦖', category: 'extinct', canRide: true },
  { id: 'langhals', name: 'Langhalsen Lilla', emoji: '🦕', category: 'extinct', canRide: true },
  { id: 'mammut', name: 'Mammuten Lodden', emoji: '🦣', category: 'extinct', canRide: true },
  { id: 'dronte', name: 'Dronten Dodo', emoji: '🦤', category: 'extinct' },
];

export const SPECIES_BY_ID: Record<string, PetSpecies> = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

export function rarityOf(species: PetSpecies): Rarity {
  return CATEGORY_INFO[species.category].rarity;
}

/** Roll which category the next pet comes from. */
export function rollCategory(rng: Rng, categories: readonly PetCategory[] = Object.keys(CATEGORY_INFO) as PetCategory[]): PetCategory {
  return pickWeighted(categories, (c) => CATEGORY_INFO[c].weight, rng);
}

/**
 * Pick a species for a new pet. Rolls a category by rarity weight, then picks a
 * species the player doesn't own yet. If every species in that category is owned,
 * re-rolls among categories that still have unowned species. Duplicates only happen
 * when the whole collection is complete.
 */
export function rollSpecies(ownedSpeciesIds: Iterable<string>, rng: Rng, species: readonly PetSpecies[] = SPECIES): PetSpecies {
  const owned = new Set(ownedSpeciesIds);
  const unowned = species.filter((s) => !owned.has(s.id));
  const pool = unowned.length > 0 ? unowned : species;
  const categories = [...new Set(pool.map((s) => s.category))];
  const category = rollCategory(rng, categories);
  return pick(pool.filter((s) => s.category === category), rng);
}

/** Lucky roll: a species that can fly or be ridden gets that power with LUCK_CHANCE. */
export function rollLuck(species: PetSpecies, rng: Rng, chance = LUCK_CHANCE): { flyable: boolean; rideable: boolean } {
  return {
    flyable: !!species.canFly && rng() < chance,
    rideable: !!species.canRide && rng() < chance,
  };
}

export function adoptPet(ownedSpeciesIds: Iterable<string>, rng: Rng, now = Date.now()): OwnedPet {
  const species = rollSpecies(ownedSpeciesIds, rng);
  const luck = rollLuck(species, rng);
  return { uid: uid('pet'), speciesId: species.id, ...luck, obtainedAt: now };
}
