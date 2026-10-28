import { describe, expect, it } from 'vitest';
import { newHouse } from './house.ts';
import { guestHouseFromWire, houseToWire, parseHouseWire } from './houseWire.ts';

describe('house wire', () => {
  it('roundtrips style and furniture', () => {
    const h = newHouse('villa', 'owner', 0);
    const w = houseToWire(h);
    expect(w.style).toBe('villa');
    expect(w.items.length).toBeGreaterThan(0);
    const back = parseHouseWire(w);
    expect(back?.style).toBe('villa');
    const guest = guestHouseFromWire('owner', back!);
    expect(guest.ownerId).toBe('owner');
    expect(guest.items[0].itemId).toBe(w.items[0].id);
  });
});
