import { describe, expect, it } from 'vitest';
import { freshSave } from './save.ts';
import { canDrive, canPram, carCabinPetScale, carPassengerSeat, CAR_CABIN, defaultCar, defaultPram, ownedCars, vehicleBodyRadius, vehicleSpeed } from './vehicles.ts';
import { SPECIES } from './pets.ts';

describe('vehicles', () => {
  it('detects owned cars and prams from the bag', () => {
    let s = freshSave(0);
    expect(ownedCars(s)).toHaveLength(0);
    s = { ...s, bag: { ...s.bag, 'bil-rosa': 1, 'vogn-rosa': 1 } };
    expect(defaultCar(s)).toBe('bil-rosa');
    expect(defaultPram(s)).toBe('vogn-rosa');
    expect(canDrive(s, 'bil-rosa')).toBe(true);
    expect(canPram(s, 'vogn-rosa')).toBe(true);
  });
  it('picks drive speed over walk', () => {
    expect(vehicleSpeed({ driving: true, pramming: false, riding: false, flying: false })).toBeGreaterThan(
      vehicleSpeed({ driving: false, pramming: false, riding: false, flying: false }),
    );
  });
  it('uses a wide body radius while driving so props and shops block the car', () => {
    expect(vehicleBodyRadius({ driving: true, pramming: false, riding: false })).toBeGreaterThan(2);
    expect(vehicleBodyRadius({ driving: true, pramming: false, riding: false })).toBeGreaterThan(
      vehicleBodyRadius({ driving: false, pramming: false, riding: false }),
    );
  });
});

describe('car cabin passenger seats', () => {
  it('keeps the first passenger inside the door line on the seat row', () => {
    const s = carPassengerSeat(0, 0, 0, 0);
    expect(Math.abs(s.lat)).toBeLessThan(CAR_CABIN.doorLine);
    expect(s.lat).toBeLessThan(0); // left / passenger side
    expect(s.forward).toBeGreaterThan(0); // seat row, not rear deck
    expect(s.y).toBe(CAR_CABIN.seatY);
  });
  it('scales every species down to fit the cabin', () => {
    for (const sp of SPECIES) {
      const sc = carCabinPetScale(sp.id, 1.8);
      expect(sc).toBeLessThanOrEqual(0.52);
      expect(sc).toBeGreaterThanOrEqual(0.32);
    }
  });
});
