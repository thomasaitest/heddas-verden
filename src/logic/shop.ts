import { HOUSES, ITEM_BY_ID } from './catalog.ts';
import { newHouse } from './house.ts';
import { ownsHouseStyle, type SaveData } from './save.ts';

export type BuyResult =
  | { ok: true; save: SaveData }
  | { ok: false; reason: 'unknown' | 'too-expensive' | 'owned'; save: SaveData };

export function canAfford(save: SaveData, itemId: string): boolean {
  const item = ITEM_BY_ID[itemId];
  return !!item && save.points >= item.price;
}

/** Houses are bought once and become a new home; everything else goes to the inventory. */
export function buy(save: SaveData, itemId: string, now = Date.now()): BuyResult {
  const item = ITEM_BY_ID[itemId];
  if (!item) return { ok: false, reason: 'unknown', save };
  if (item.kind === 'house' && ownsHouseStyle(save, itemId)) return { ok: false, reason: 'owned', save };
  if (save.points < item.price) return { ok: false, reason: 'too-expensive', save };
  const points = save.points - item.price;
  if (item.kind === 'house') {
    const style = HOUSES.find((h) => h.id === itemId)!.style;
    const house = newHouse(style, save.playerId, now);
    return { ok: true, save: { ...save, points, houses: [...save.houses, house], activeHouseId: house.id } };
  }
  return { ok: true, save: { ...save, points, inventory: { ...save.inventory, [itemId]: (save.inventory[itemId] ?? 0) + 1 } } };
}

export function addPoints(save: SaveData, amount: number): SaveData {
  return { ...save, points: Math.max(0, save.points + Math.floor(amount)) };
}
