import { describe, expect, it } from 'vitest';
import { seeded } from './rng.ts';
import { CATEGORY_INFO, SPECIES, SPECIES_BY_ID, rollCategory, rollLuck, rollSpecies } from './pets.ts';
import { POINTS, START_LIVES, levelShape, makeDoors, newGame, openDoor, useMagnifier, type DoorGame } from './doors.ts';
import { NEED_INFO, NEED_POINTS, GROW_UP_BONUS, care, stageOf, tickNeed, toPetState, growthProgress } from './needs.ts';
import { buy } from './shop.ts';
import { freshSave, parseSave } from './save.ts';
import { canEdit, deserializeHouse, grantEdit, newHouse, placeItem, removeItem, requestEdit, revokeEdit, serializeHouse, updateItem } from './house.ts';

describe('pet rarity', () => {
  it('rolls common most, insects next, fantasy and extinct rarely', () => {
    const rng = seeded(1);
    const counts = { common: 0, insect: 0, fantasy: 0, extinct: 0 };
    for (let i = 0; i < 20000; i++) counts[rollCategory(rng)]++;
    expect(counts.common).toBeGreaterThan(counts.insect);
    expect(counts.insect).toBeGreaterThan(counts.fantasy * 2);
    expect(counts.insect).toBeGreaterThan(counts.extinct * 2);
    const total = Object.values(CATEGORY_INFO).reduce((s, c) => s + c.weight, 0);
    expect(counts.fantasy / 20000).toBeCloseTo(CATEGORY_INFO.fantasy.weight / total, 1);
  });

  it('includes the required species', () => {
    for (const id of ['enhjorning', 'vingehjorning', 'drage', 'trex', 'langhals', 'mammut', 'dronte', 'hest']) expect(SPECIES_BY_ID[id]).toBeTruthy();
  });

  it('gives a pet the player does not own while possible', () => {
    const rng = seeded(7);
    const owned: string[] = [];
    for (let i = 0; i < SPECIES.length; i++) {
      const s = rollSpecies(owned, rng);
      expect(owned).not.toContain(s.id);
      owned.push(s.id);
    }
    expect(new Set(owned).size).toBe(SPECIES.length);
    // Full collection: duplicates are allowed now.
    expect(SPECIES_BY_ID[rollSpecies(owned, rng).id]).toBeTruthy();
  });

  it('falls back to another category when one is complete', () => {
    const owned = SPECIES.filter((s) => s.category === 'common').map((s) => s.id);
    const rng = seeded(3);
    for (let i = 0; i < 200; i++) expect(rollSpecies(owned, rng).category).not.toBe('common');
  });

  it('only flying or riding species get luck, and luck is rare', () => {
    const rng = seeded(11);
    const cat = SPECIES_BY_ID.katt;
    for (let i = 0; i < 500; i++) expect(rollLuck(cat, rng)).toEqual({ flyable: false, rideable: false });
    let fly = 0;
    for (let i = 0; i < 5000; i++) if (rollLuck(SPECIES_BY_ID.drage, rng).flyable) fly++;
    expect(fly / 5000).toBeGreaterThan(0.1);
    expect(fly / 5000).toBeLessThan(0.3);
    expect(rollLuck(SPECIES_BY_ID.hest, () => 0).rideable).toBe(true);
    expect(rollLuck(SPECIES_BY_ID.hest, () => 0).flyable).toBe(false);
  });
});

describe('door game', () => {
  it('builds levels with the right number of doors and traps', () => {
    const rng = seeded(5);
    for (let level = 0; level < 5; level++) {
      const doors = makeDoors(level, rng);
      const shape = levelShape(level);
      expect(doors).toHaveLength(shape.doors);
      expect(doors.filter((d) => d.content.type === 'trap')).toHaveLength(shape.traps);
      expect(doors.filter((d) => d.content.type === 'item').length).toBeLessThanOrEqual(1);
    }
  });

  const withDoors = (game: DoorGame, contents: DoorGame['doors'][number]['content'][]): DoorGame => ({
    ...game,
    doors: contents.map((content) => ({ content, opened: false, revealed: false })),
  });

  it('starts with 3 lives; a trap costs a life and keeps the level', () => {
    const rng = seeded(2);
    let g = withDoors(newGame(rng), [{ type: 'trap' }, { type: 'safe' }, { type: 'safe' }]);
    expect(g.lives).toBe(START_LIVES);
    g = openDoor(g, 0, rng);
    expect(g.lives).toBe(2);
    expect(g.level).toBe(0);
    expect(g.doors[0].opened).toBe(true);
    expect(openDoor(g, 0, rng)).toBe(g); // can't reopen
    g = openDoor(g, 1, rng);
    expect(g.level).toBe(1);
    expect(g.points).toBe(POINTS.perLevel);
  });

  it('items help: extra life, key blocks a trap, magnifier reveals a trap', () => {
    const rng = seeded(4);
    let g = withDoors(newGame(rng), [{ type: 'item', item: 'life' }, { type: 'safe' }, { type: 'trap' }]);
    g = openDoor(g, 0, rng);
    expect(g.lives).toBe(4);
    g = withDoors(g, [{ type: 'item', item: 'key' }, { type: 'trap' }, { type: 'safe' }]);
    g = openDoor(g, 0, rng);
    expect(g.keys).toBe(1);
    g = withDoors(g, [{ type: 'trap' }, { type: 'item', item: 'magnifier' }, { type: 'safe' }]);
    g = openDoor(g, 0, rng);
    expect(g.lives).toBe(4);
    expect(g.keys).toBe(0);
    expect(g.lastEvent).toEqual({ type: 'trap-blocked' });
    g = openDoor(g, 1, rng);
    expect(g.magnifiers).toBe(1);
    g = withDoors(g, [{ type: 'safe' }, { type: 'trap' }, { type: 'safe' }]);
    g = useMagnifier(g, rng);
    expect(g.magnifiers).toBe(0);
    expect(g.doors[1].revealed).toBe(true);
    expect(openDoor(g, 1, rng)).toBe(g); // revealed door can't be picked
  });

  it('winning all levels pays the win bonus plus lives', () => {
    const rng = seeded(9);
    let g = newGame(rng, 2);
    for (let i = 0; i < 2; i++) g = openDoor(withDoors(g, [{ type: 'safe' }, { type: 'trap' }]), 0, rng);
    expect(g.status).toBe('won');
    expect(g.points).toBe(2 * POINTS.perLevel + POINTS.winBonus + 3 * POINTS.perLifeLeft);
  });

  it('losing all lives ends with consolation points', () => {
    const rng = seeded(10);
    let g = newGame(rng);
    for (let i = 0; i < 3; i++) g = openDoor(withDoors(g, [{ type: 'trap' }, { type: 'safe' }]), 0, rng);
    expect(g.status).toBe('lost');
    expect(g.lives).toBe(0);
    expect(g.points).toBe(POINTS.consolation);
    expect(openDoor(g, 1, rng)).toBe(g);
  });

  it('a run of random choices always ends', () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = seeded(seed);
      let g = newGame(rng);
      let steps = 0;
      while (g.status === 'playing' && steps++ < 100) {
        const open = g.doors.findIndex((d) => !d.opened && !d.revealed);
        g = openDoor(g, open, rng);
      }
      expect(g.status).not.toBe('playing');
      expect(g.points).toBeGreaterThan(0);
    }
  });
});

describe('pet needs and growth', () => {
  const pet = () => toPetState({ uid: 'p1', speciesId: 'katt', flyable: false, rideable: false, obtainedAt: 0 }, 0);

  it('gets a need when the timer is up', () => {
    const rng = seeded(1);
    expect(tickNeed(pet(), 0, rng).need).toBeNull();
    const p = tickNeed(pet(), 5000, rng);
    expect(Object.keys(NEED_INFO)).toContain(p.need);
    expect(tickNeed(pet(), 5000, rng, 'hungry').need).not.toBe('hungry');
  });

  it('the right care fulfils the need, gives points and growth', () => {
    const rng = seeded(1);
    const p = { ...pet(), need: 'hungry' as const };
    expect(care(p, 'water', 0, rng).ok).toBe(false);
    const r = care(p, 'food', 1000, rng);
    expect(r.ok).toBe(true);
    expect(r.points).toBe(NEED_POINTS);
    expect(r.pet.need).toBeNull();
    expect(r.pet.growth).toBe(1);
    expect(r.pet.nextNeedAt).toBeGreaterThan(1000);
    expect(care(r.pet, 'food', 0, rng).ok).toBe(false);
  });

  it('grows baby → child → teen → adult with a bonus', () => {
    expect(stageOf(0).id).toBe('baby');
    expect(stageOf(3).id).toBe('child');
    expect(stageOf(8).id).toBe('teen');
    expect(stageOf(99).id).toBe('adult');
    expect(growthProgress(99)).toBe(1);
    const r = care({ ...pet(), growth: 2, need: 'sleepy' }, 'sleep', 0, seeded(1));
    expect(r.grewUp).toBe(true);
    expect(r.points).toBe(NEED_POINTS + GROW_UP_BONUS);
  });
});

describe('shop', () => {
  it('buys furniture into the inventory and subtracts points', () => {
    const s = { ...freshSave(), points: 10 };
    const r = buy(s, 'sofa');
    expect(r.ok).toBe(true);
    expect(r.save.points).toBe(0);
    expect(r.save.inventory.sofa).toBe(1);
    const again = buy(r.save, 'chair');
    expect(again).toMatchObject({ ok: false, reason: 'too-expensive' });
  });

  it('furniture is cheap compared with a win', () => {
    for (const id of ['plant', 'chair', 'table', 'lamp', 'sofa']) expect(buy({ ...freshSave(), points: POINTS.winBonus }, id).ok).toBe(true);
  });

  it('buys a house once and moves in', () => {
    const s = { ...freshSave(), points: 200 };
    const r = buy(s, 'house-treehouse');
    expect(r.ok).toBe(true);
    expect(r.save.houses).toHaveLength(2);
    expect(r.save.houses.find((h) => h.id === r.save.activeHouseId)!.style).toBe('treehouse');
    expect(buy(r.save, 'house-treehouse')).toMatchObject({ ok: false, reason: 'owned' });
    expect(buy(s, 'house-cottage')).toMatchObject({ ok: false, reason: 'owned' });
    expect(buy(s, 'nope')).toMatchObject({ ok: false, reason: 'unknown' });
  });
});

describe('houses and permissions', () => {
  it('only the owner and granted editors can build', () => {
    let h = newHouse('cottage', 'me');
    expect(canEdit(h, 'me')).toBe(true);
    expect(canEdit(h, 'friend')).toBe(false);
    expect(placeItem(h, 'friend', 'sofa').placed).toBeNull();
    h = requestEdit(h, 'friend');
    expect(h.permissions.requests).toEqual(['friend']);
    expect(grantEdit(h, 'friend', 'friend')).toBe(h); // can't grant yourself
    h = grantEdit(h, 'me', 'friend');
    expect(canEdit(h, 'friend')).toBe(true);
    expect(h.permissions.requests).toEqual([]);
    const placed = placeItem(h, 'friend', 'sofa');
    expect(placed.placed).not.toBeNull();
    h = revokeEdit(placed.house, 'me', 'friend');
    expect(canEdit(h, 'friend')).toBe(false);
    expect(removeItem(h, 'friend', placed.placed!.uid).removed).toBeNull();
  });

  it('places, recolours, resizes and removes items', () => {
    let h = newHouse('apartment', 'me');
    const { house, placed } = placeItem(h, 'me', 'lights', 50, 90);
    expect(placed!.y).toBeLessThanOrEqual(40); // wall items stay on the wall
    h = updateItem(house, 'me', placed!.uid, { color: '#000000', scale: 9, x: 120 });
    expect(h.items[0]).toMatchObject({ color: '#000000', scale: 2.5, x: 100 });
    expect(removeItem(h, 'me', placed!.uid).house.items).toHaveLength(0);
  });

  it('round-trips through JSON and drops unknown items', () => {
    const { house } = placeItem(newHouse('farmhouse', 'me'), 'me', 'notebook');
    house.items[0].note = 'Hei!';
    const back = deserializeHouse(serializeHouse(house))!;
    expect(back).toEqual(house);
    const broken = JSON.parse(serializeHouse(house));
    broken.items.push({ uid: 'x', itemId: 'does-not-exist' });
    expect(deserializeHouse(JSON.stringify(broken))!.items).toHaveLength(1);
    expect(deserializeHouse('not json')).toBeNull();
  });
});

describe('save', () => {
  it('starts fresh with a free cottage and some points', () => {
    const s = parseSave(null);
    expect(s.houses[0].style).toBe('cottage');
    expect(s.points).toBeGreaterThan(0);
    expect(parseSave('garbage').version).toBe(1);
  });

  it('repairs a stored save', () => {
    const s = freshSave();
    const stored = JSON.stringify({ ...s, points: -5, pets: [{ uid: 'a', speciesId: 'gone' }], inventory: { sofa: 2, ghost: 1 }, followerUid: 'missing' });
    const back = parseSave(stored);
    expect(back.points).toBe(0);
    expect(back.pets).toHaveLength(0);
    expect(back.inventory).toEqual({ sofa: 2 });
    expect(back.followerUid).toBeNull();
    expect(back.playerId).toBe(s.playerId);
  });
});
