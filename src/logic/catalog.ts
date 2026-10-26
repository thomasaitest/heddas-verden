export type ShopKind = 'house' | 'furniture' | 'decor';
export type HouseStyle = 'cottage' | 'apartment' | 'farmhouse' | 'treehouse';

export interface ShopItem {
  id: string;
  kind: ShopKind;
  name: string;
  price: number;
  /** Default colour for recolourable items. */
  color?: string;
  /** Lies flat on the floor (rugs, dance floor) and is drawn behind other things. */
  flat?: boolean;
  /** Hangs on the wall. */
  wall?: boolean;
  /** Base width in % of the room width. */
  size: number;
  note?: boolean;
}

export const HOUSES: (ShopItem & { style: HouseStyle; wall: boolean; description: string })[] = [
  { id: 'house-cottage', kind: 'house', style: 'cottage', name: 'Koselig hytte', price: 0, size: 30, wall: false, description: 'En liten hytte med rundt vindu og blomster.' },
  { id: 'house-apartment', kind: 'house', style: 'apartment', name: 'Byleilighet', price: 60, size: 30, wall: false, description: 'Store vinduer og utsikt over byen.' },
  { id: 'house-farmhouse', kind: 'house', style: 'farmhouse', name: 'Gårdshus', price: 80, size: 30, wall: false, description: 'Rødt gårdshus med jorder og høy.' },
  { id: 'house-treehouse', kind: 'house', style: 'treehouse', name: 'Trehytte', price: 120, size: 30, wall: false, description: 'Høyt oppe i et stort tre!' },
];

export const FURNITURE: ShopItem[] = [
  { id: 'plant', kind: 'furniture', name: 'Potteplante', price: 3, color: '#5cc36b', size: 9 },
  { id: 'picture', kind: 'furniture', name: 'Bilde', price: 3, color: '#ffb84d', size: 10, wall: true },
  { id: 'lamp', kind: 'furniture', name: 'Lampe', price: 4, color: '#ffd84d', size: 8 },
  { id: 'rug', kind: 'furniture', name: 'Rundt teppe', price: 4, color: '#ff9ccf', size: 26, flat: true },
  { id: 'chair', kind: 'furniture', name: 'Stol', price: 5, color: '#7fc8ff', size: 10 },
  { id: 'beanbag', kind: 'furniture', name: 'Saccosekk', price: 5, color: '#b78bff', size: 12 },
  { id: 'table', kind: 'furniture', name: 'Bord', price: 6, color: '#d9a066', size: 16 },
  { id: 'bookshelf', kind: 'furniture', name: 'Bokhylle', price: 8, color: '#c98a55', size: 14 },
  { id: 'sofa', kind: 'furniture', name: 'Sofa', price: 10, color: '#ff8fb1', size: 24 },
  { id: 'wardrobe', kind: 'furniture', name: 'Klesskap', price: 10, color: '#9ad8c8', size: 14 },
  { id: 'bed', kind: 'furniture', name: 'Seng', price: 12, color: '#8fb8ff', size: 24 },
  { id: 'bathtub', kind: 'furniture', name: 'Badekar', price: 12, color: '#ffffff', size: 22 },
];

export const DECOR: ShopItem[] = [
  { id: 'balloons', kind: 'decor', name: 'Ballonger', price: 5, color: '#ff6fa8', size: 10 },
  { id: 'notebook', kind: 'decor', name: 'Skriveplate med notatbok', price: 8, color: '#ffcf5c', size: 9, note: true },
  { id: 'lights', kind: 'decor', name: 'Lysslynge', price: 12, color: '#fff27a', size: 40, wall: true },
  { id: 'discoball', kind: 'decor', name: 'Discokule', price: 15, color: '#d8e6ff', size: 10, wall: true },
  { id: 'dancefloor', kind: 'decor', name: 'Dansegulv', price: 30, color: '#c88bff', size: 32, flat: true },
  { id: 'starbed', kind: 'decor', name: 'Stjerneseng', price: 30, color: '#7b8cff', size: 26 },
  { id: 'canopybed', kind: 'decor', name: 'Himmelseng', price: 35, color: '#ffa6d5', size: 26 },
];

export const ALL_ITEMS: ShopItem[] = [...HOUSES, ...FURNITURE, ...DECOR];
export const ITEM_BY_ID: Record<string, ShopItem> = Object.fromEntries(ALL_ITEMS.map((i) => [i.id, i]));

export const PALETTE = ['#ff8fb1', '#ffb84d', '#ffe066', '#7ccf6a', '#5cc3f2', '#8fa8ff', '#c88bff', '#ffffff', '#c98a55', '#555a75'];

export const WALL_COLORS = ['#fff1e0', '#ffe0ef', '#e4f4ff', '#e8ffe4', '#f3e8ff', '#fff9c9', '#ffd6c4', '#d6f5ef'];
export const WALL_PATTERNS = [
  { id: 'plain', name: 'Glatt' },
  { id: 'stripes', name: 'Striper' },
  { id: 'dots', name: 'Prikker' },
  { id: 'hearts', name: 'Hjerter' },
  { id: 'stars', name: 'Stjerner' },
] as const;
export const FLOORS = [
  { id: 'wood', name: 'Tregulv' },
  { id: 'tiles', name: 'Fliser' },
  { id: 'carpet', name: 'Teppe' },
  { id: 'grass', name: 'Gress' },
  { id: 'clouds', name: 'Skyer' },
] as const;
export type WallPattern = (typeof WALL_PATTERNS)[number]['id'];
export type FloorType = (typeof FLOORS)[number]['id'];
