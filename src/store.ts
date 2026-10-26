import { loadSave, writeSave, type SaveData } from './logic/save.ts';
import { adoptPet, SPECIES, type OwnedPet } from './logic/pets.ts';
import { toPetState } from './logic/needs.ts';
import { pick } from './logic/rng.ts';
import { setSoundEnabled } from './audio.ts';

type Listener = (s: SaveData) => void;
const listeners = new Set<Listener>();

export let save: SaveData = loadSave(localStorage);
setSoundEnabled(save.sound);

export function update(fn: (s: SaveData) => SaveData): SaveData {
  save = fn(save);
  writeSave(localStorage, save);
  listeners.forEach((l) => l(save));
  return save;
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function activeHouse() {
  return save.houses.find((h) => h.id === save.activeHouseId) ?? save.houses[0];
}

/** Adds a freshly adopted pet waiting in an egg and returns it. */
export function addEggPet(starter = false): OwnedPet {
  const now = Date.now();
  const pet: OwnedPet = starter
    ? { uid: `pet-${now.toString(36)}`, speciesId: pick(SPECIES.filter((s) => s.category === 'common' && !s.canRide && !s.canFly), Math.random).id, flyable: false, rideable: false, obtainedAt: now }
    : adoptPet(save.pets.map((p) => p.speciesId), Math.random, now);
  update((s) => ({
    ...s,
    pets: [...s.pets, toPetState(pet, now)],
    pendingReveal: pet.uid,
    starterGiven: true,
    followerUid: s.followerUid ?? pet.uid,
  }));
  return pet;
}
