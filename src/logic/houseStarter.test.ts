import { describe, expect, it } from 'vitest';
import { ensureStarterFurniture, hasHumanBed, hasTable, newHouse } from './house.ts';
import { freshSave, parseSave } from './save.ts';

describe('starter furniture', () => {
  it('new houses include a bed and a table', () => {
    const h = newHouse('hytte', 'p1');
    expect(hasHumanBed(h.items)).toBe(true);
    expect(hasTable(h.items)).toBe(true);
    expect(h.items.some((i) => i.itemId === 'seng')).toBe(true);
    expect(h.items.some((i) => i.itemId === 'spisebord')).toBe(true);
  });

  it('ensureStarterFurniture adds missing bed/table once only', () => {
    const h = newHouse('hytte', 'p1');
    const stripped = { ...h, items: h.items.filter((i) => i.itemId !== 'seng' && i.itemId !== 'spisebord') };
    expect(hasHumanBed(stripped.items)).toBe(false);
    const fixed = ensureStarterFurniture(stripped);
    expect(hasHumanBed(fixed.items)).toBe(true);
    expect(hasTable(fixed.items)).toBe(true);
    const again = ensureStarterFurniture(fixed);
    expect(again.items.filter((i) => i.itemId === 'seng').length).toBe(1);
    expect(again.items.filter((i) => i.itemId === 'spisebord').length).toBe(1);
  });

  it('parseSave migrates old houses without duplicating', () => {
    const s = freshSave();
    const bare = {
      ...s,
      houses: s.houses.map((h) => ({
        ...h,
        items: h.items.filter((i) => i.itemId !== 'seng' && i.itemId !== 'spisebord'),
      })),
    };
    const json = JSON.stringify(bare);
    const loaded = parseSave(json);
    const house = loaded.houses[0];
    expect(hasHumanBed(house.items)).toBe(true);
    expect(hasTable(house.items)).toBe(true);
    const again = parseSave(JSON.stringify(loaded));
    expect(again.houses[0].items.filter((i) => i.itemId === 'seng').length).toBe(1);
  });
});
