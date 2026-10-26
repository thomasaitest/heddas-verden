import { CATEGORY_INFO, SPECIES_BY_ID, type OwnedPet } from '../logic/pets.ts';
import { stageOf, type PetState } from '../logic/needs.ts';

/** Emoji pet with optional wings; size follows the growth stage. */
export function petFace(speciesId: string, extraClass = ''): string {
  const s = SPECIES_BY_ID[speciesId];
  return `<span class="pet-face ${s.wings ? 'winged' : ''} ${extraClass}" style="--cat:${CATEGORY_INFO[s.category].color}"><span class="emo">${s.emoji}</span>${s.wings ? '<span class="wing wl"></span><span class="wing wr"></span>' : ''}</span>`;
}

export function petBadges(p: OwnedPet): string {
  return `${p.flyable ? '<span class="badge fly">🪽 Kan fly</span>' : ''}${p.rideable ? '<span class="badge ride">🐎 Kan ri</span>' : ''}`;
}

export function petName(p: OwnedPet): string {
  return SPECIES_BY_ID[p.speciesId].name;
}

export function stageScale(p: PetState): number {
  return stageOf(p.growth).scale;
}
