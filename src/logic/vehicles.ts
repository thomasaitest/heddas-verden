/** Cars and prams (vogner): ownership helpers and movement speeds. */

import { AVATAR_BODY_R } from './avatar.ts';
import { CAR_BY_ID, PET_SHOP_BY_ID, type CarItem, type PetShopItem } from './catalog.ts';
import { SPECIES_BY_ID, type BodyType } from './pets.ts';
import type { SaveData } from './save.ts';

export const DRIVE_SPEED = 18;
export const PRAM_SPEED = 7;
export const WALK_SPEED = 9;

export function ownedCars(save: SaveData): CarItem[] {
  return Object.keys(save.bag)
    .filter((id) => CAR_BY_ID[id] && (save.bag[id] ?? 0) > 0)
    .map((id) => CAR_BY_ID[id]);
}

export function ownedPrams(save: SaveData): PetShopItem[] {
  return Object.keys(save.bag)
    .filter((id) => {
      const it = PET_SHOP_BY_ID[id];
      return it && it.kind === 'vogn' && (save.bag[id] ?? 0) > 0;
    })
    .map((id) => PET_SHOP_BY_ID[id]);
}

export function canDrive(save: SaveData, carId: string | null | undefined): boolean {
  return !!carId && !!CAR_BY_ID[carId] && (save.bag[carId] ?? 0) > 0;
}

export function canPram(save: SaveData, pramId: string | null | undefined): boolean {
  if (!pramId) return false;
  const it = PET_SHOP_BY_ID[pramId];
  return !!it && it.kind === 'vogn' && (save.bag[pramId] ?? 0) > 0;
}

/** First owned car, or null. */
export function defaultCar(save: SaveData): string | null {
  return ownedCars(save)[0]?.id ?? null;
}

/** First owned pram, or null. */
export function defaultPram(save: SaveData): string | null {
  return ownedPrams(save)[0]?.id ?? null;
}

export function vehicleSpeed(opts: { driving: boolean; pramming: boolean; riding: boolean; flying: boolean }): number {
  if (opts.flying) return 18;
  if (opts.driving) return DRIVE_SPEED;
  if (opts.riding) return 15;
  if (opts.pramming) return PRAM_SPEED;
  return WALK_SPEED;
}


/** Collision radius in town: cars need a wide body so shops/benches/props block them. */
export function vehicleBodyRadius(opts: { driving: boolean; pramming: boolean; riding: boolean }): number {
  if (opts.driving) return 2.45;
  if (opts.pramming) return 1.35;
  if (opts.riding) return 1.3;
  // Arms stick out past the old 0.55 circle, so limbs stayed inside rocks.
  return AVATAR_BODY_R;
}

/** Convertible / family cabin: pets must stay inside the door line on the seat cushion. */
export const CAR_CABIN = {
  /** Max |local X| for a passenger before the door pillar (body ~±1.15). */
  doorLine: 0.72,
  /** Seat cushion height (matches buildCar purple seat). */
  seatY: 0.78,
  /** Local forward of the seat row (car +Z = forward). */
  seatForward: 0.12,
  /** Lateral offset from car center for the passenger (left of driver). */
  passengerLat: 0.55,
  /** Driver lateral (right) — keep pets clear of this. */
  driverLat: 0.38,
} as const;

/** Max world scale so a body type fits on the passenger seat (legs under door line). */
const CABIN_FIT: Record<BodyType, number> = {
  dog: 0.5,
  cat: 0.5,
  fox: 0.48,
  bunny: 0.46,
  bear: 0.44,
  pig: 0.48,
  horse: 0.36,
  bird: 0.5,
  penguin: 0.48,
  dragon: 0.38,
  dino: 0.38,
  turtle: 0.46,
  bug: 0.48,
};

export function carCabinPetScale(speciesId: string, stageScale: number): number {
  const body = SPECIES_BY_ID[speciesId]?.body ?? 'dog';
  const max = CABIN_FIT[body] ?? 0.5;
  return Math.min(max, Math.max(0.32, stageScale * 0.4));
}

/** World position of a passenger seat inside the cabin (never on hood/deck/outside door). */
export function carPassengerSeat(
  carX: number,
  carZ: number,
  yaw: number,
  seatIndex: number,
): { x: number; y: number; z: number; lat: number; forward: number } {
  const side = seatIndex % 2 === 0 ? -1 : 1; // first pet = left (passenger)
  const row = Math.floor(seatIndex / 2);
  const lat = side * CAR_CABIN.passengerLat;
  // Stay inside door line
  const clampedLat = Math.sign(lat) * Math.min(Math.abs(lat), CAR_CABIN.doorLine - 0.08);
  const forward = CAR_CABIN.seatForward - row * 0.5;
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  // forward dir (sin, cos), right dir (cos, -sin)
  return {
    x: carX + sin * forward + cos * clampedLat,
    y: CAR_CABIN.seatY,
    z: carZ + cos * forward - sin * clampedLat,
    lat: clampedLat,
    forward,
  };
}
