import * as THREE from 'three';
import { HOUSE_BY_STYLE, type HouseStyle } from '../logic/catalog.ts';
import type { CircleCollider, RectCollider, Surface } from '../logic/collision.ts';
import { collectColliders, solid } from './colliders.ts';
import { fillCarShop, fillHospital, fillPetShop, fillShop } from './buildings.ts';
import { EQUIPMENT, MERRY, SEESAW, SLIDE, SWING_PIVOT_Y, SWING_ROPE, SWING_XS, SWING_Z, TRAMP, merryAngle, seatAt, seesawAngle, swingAngle, type EquipDef, type Seat } from '../logic/playground.ts';
import { box, cone, cyl, G, mergeStatic, part, rbox, shadowAll, sph, textTexture } from './kit.ts';

export type ZoneKind = 'home' | 'shop' | 'vet' | 'eggs' | 'doors' | 'play' | 'cars' | 'pets';
export interface Zone {
  kind: ZoneKind;
  x: number;
  z: number;
  r: number;
  label: string;
}
export type { CircleCollider, RectCollider } from '../logic/collision.ts';

export interface WorldEquip extends EquipDef {
  /** World position of the middle and of the spot where you step down. */
  wx: number;
  wz: number;
  exitX: number;
  exitZ: number;
  exitYaw: number;
}

export interface Town {
  group: THREE.Group;
  zones: Zone[];
  rects: RectCollider[];
  circles: CircleCollider[];
  spawn: { x: number; z: number; yaw: number };
  entrances: Record<ZoneKind, { x: number; z: number; yaw: number }>;
  /** World positions where a sick animal can lie down in the hospital. */
  vetBeds: { x: number; z: number; y: number }[];
  setHomeStyle(style: HouseStyle): void;
  /** Playground equipment in world coordinates (you can sit on these). */
  equipment: WorldEquip[];
  /** The meshes you can tap to climb on (userData.equip holds the id). */
  equipTargets: THREE.Object3D[];
  /** Which piece is in use and for how long; it moves while someone is on it and rests otherwise. */
  setEquipUse(use: { id: string; u: number } | null): void;
  /** Where the avatar sits on a piece `u` seconds after climbing on (world coordinates). */
  seatWorld(id: string, u: number): Seat;
  /** Animate; roofs of the shop and the hospital are lifted off while the player is inside. */
  update(t: number, px?: number, pz?: number, camX?: number, camZ?: number): void;
  /** Centre and radius of the walk-in building the point is inside (the camera must not be pushed in by its walls). */
  buildingAt(x: number, z: number): { kind: 'shop' | 'vet' | 'cars' | 'pets'; x: number; z: number; r: number } | null;
  /** Which walk-in building the point is inside, if any. */
  insideBuilding(x: number, z: number): 'shop' | 'vet' | 'cars' | 'pets' | null;
  /** Tops you can land on after a jump (fountain, etc.). */
  surfaces: Surface[];
  /** Outdoor benches you can sit on to rest. */
  benches: { x: number; z: number; yaw: number }[];
  /** Neighbourhood house plots (each multiplayer player gets one). */
  housePlots: { x: number; z: number; rot: number }[];
  /** Show a remote player's house exterior on a plot (style + label). */
  setPlotHouse(plot: number, style: HouseStyle | null, label?: string): void;
  size: number;
}

const GRASS = '#7fd36a';
const ROAD = '#f2dfb8';
const SIZE = 240;

function faceCenter(x: number, z: number) {
  return Math.atan2(-x, -z);
}

/** Put a sign with text above a building front. */
function sign(parent: THREE.Object3D, text: string, y: number, z: number, bg: string, w = 7) {
  const tex = textTexture(text, { bg, fg: '#ffffff', stroke: '#00000033', w: 512, h: 128 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  m.position.set(0, y, z);
  parent.add(m);
  return m;
}

function awning(g: THREE.Group, w: number, y: number, z: number, a: string, b: string) {
  const n = Math.round(w / 1.2);
  for (let i = 0; i < n; i++) box(g, i % 2 ? a : b, [-w / 2 + (i + 0.5) * (w / n), y, z], [w / n, 0.25, 2.4], [0.35, 0, 0]).userData.noCast = true;
}

/** Open-front building (shop, vet, egg shop): back + side walls, roof, sign. With `door` it gets a front wall you walk in through. */
function openBuilding(w: number, d: number, h: number, wall: string, roof: string, trim: string, opts: { solidFloor?: boolean; door?: number; roofSeparate?: boolean } = {}) {
  const g = new THREE.Group();
  const roofG = opts.roofSeparate ? new THREE.Group() : g;
  const walkIn = opts.door !== undefined;
  // a walk-in building keeps its walls in separate groups, so the ones between the camera and you can be hidden
  const shell = { back: new THREE.Group(), left: new THREE.Group(), right: new THREE.Group(), front: new THREE.Group() };
  const W = walkIn ? shell : { back: g, left: g, right: g, front: g };
  if (walkIn) {
    // a thin slab, so the player's feet are on it
    box(g, '#f4e9dc', [0, 0.01, 0], [w, 0.06, d]).userData.noCast = true;
  } else {
    const floor = box(g, '#f4e9dc', [0, 0.1, 0], [w, 0.2, d]);
    if (opts.solidFloor !== false) solid(floor, 'rect', 0, h + 1);
  }
  solid(box(W.back, wall, [0, h / 2, -d / 2 + 0.3], [w, h, 0.6]));
  solid(box(W.left, wall, [-(w / 2 - 0.3), h / 2, 0], [0.6, h, d]));
  solid(box(W.right, wall, [w / 2 - 0.3, h / 2, 0], [0.6, h, d]));
  if (walkIn) {
    const door = opts.door!;
    const seg = (w - door) / 2;
    for (const s of [-1, 1]) {
      const cx = s * (door / 2 + seg / 2);
      solid(box(W.front, wall, [cx, h / 2, d / 2 - 0.25], [seg, h, 0.5]));
      // door frame and a window in each front segment
      box(W.front, trim, [s * (door / 2 + 0.2), h / 2, d / 2 - 0.1], [0.4, h, 0.7]);
      const win = new THREE.Mesh(G.box(), new THREE.MeshLambertMaterial({ color: '#bfe9ff', transparent: true, opacity: 0.45, depthWrite: false }));
      win.position.set(cx, 3.1, d / 2 + 0.03);
      win.scale.set(Math.min(3.4, seg - 1.4), 1.8, 0.12);
      W.front.add(win);
      box(W.front, '#ffffff', [cx, 3.1, d / 2 + 0.0], [Math.min(3.4, seg - 1.4) + 0.3, 2.1, 0.08]);
      box(W.front, trim, [s * (w / 2 - 0.3), h / 2, d / 2 - 0.2], [0.9, h, 0.9]);
    }
    g.userData.shell = shell;
  } else for (const s of [-1, 1]) solid(box(g, trim, [s * (w / 2 - 0.3), h / 2, d / 2 - 0.2], [0.9, h, 0.9]));
  rbox(roofG, roof, [0, h + 0.4, 0], [w + 1.2, 0.8, d + 1.2]).userData.noCast = true;
  box(roofG, trim, [0, h - 0.4, d / 2 - 0.1], [w, 0.8, 0.4]).userData.noCast = true;
  g.userData.roof = roofG;
  return g;
}

function homeExterior(style: HouseStyle): THREE.Group {
  const info = HOUSE_BY_STYLE[style] ?? HOUSE_BY_STYLE.hytte;
  const g = new THREE.Group();
  // Match catalog footprint (tests and door zone use the same numbers).
  const w = Math.min(22, info.w * 0.65);
  const d = Math.min(18, info.d * 0.7);
  const h = style === 'slott' ? 14 : 12; // two floors

  solid(box(g, '#e8d8c4', [0, 0.25, 0], [w + 1, 0.5, d + 1]), 'rect', 0, 18);
  solid(box(g, info.wall, [0, h / 2 + 0.5, 0], [w, h, d]), 'rect', 0, 18);
  box(g, '#ffffff', [0, 6.9, 0], [w + 0.3, 0.4, d + 0.3]); // the line between the two floors
  box(g, '#ffffff', [0, 0.7, 0], [w + 0.2, 0.4, d + 0.2]);
  // roof
  if (style === 'slott') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      solid(cyl(g, info.wall, [sx * w / 2, h / 2 + 1.5, sz * d / 2], [3, h + 2, 3]), 'circle', 0, 14);
      cone(g, info.roof, [sx * w / 2, h + 4.2, sz * d / 2], [3.6, 3.5, 3.6]);
    }
    for (let i = 0; i < 7; i++) box(g, info.wall, [-w / 2 + 1 + i * ((w - 2) / 6), h + 0.9, d / 2], [1, 0.8, 0.8]);
    part(g, G.heart(), '#ff8fb1', [0, h - 0.8, d / 2 + 0.1], [2, 2, 0.6]);
  } else {
    // Clean pyramid roof sized to the footprint (no z-fighting with the upper floor).
    const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 4), new THREE.MeshLambertMaterial({ color: info.roof }));
    roofMesh.position.set(0, h + 2.6, 0);
    roofMesh.rotation.y = Math.PI / 4;
    roofMesh.scale.set(w * 1.15, 4.0, d * 1.15);
    roofMesh.castShadow = true;
    g.add(roofMesh);
    // thin ceiling slab under the roof so the 2nd floor is closed
    box(g, info.wall, [0, h + 0.15, 0], [w + 0.2, 0.3, d + 0.2]).userData.noCast = true;
    if (style === 'gard' || style === 'trehus') for (const s of [-1, 1]) box(g, '#ffffff', [s * 3, 3.2, d / 2 + 0.02], [2.4, 0.3, 0.1], [0, 0, s * 0.8]);
    if (style !== 'moderne') cyl(g, '#b46a50', [w / 4, h + 3.2, -d / 6], [0.9, 2.6, 0.9]);
  }
  // door + windows
  rbox(g, '#a0632f', [0, 2.2, d / 2 + 0.05], [2.6, 3.6, 0.3]);
  sph(g, '#ffd23f', [0.8, 2.2, d / 2 + 0.25], [0.25, 0.25, 0.2]);
  for (const s of [-1, 1]) {
    box(g, '#ffffff', [s * (w / 2 - 2.6), 4, d / 2 + 0.05], [2.4, 2.2, 0.2]);
    box(g, '#bfe9ff', [s * (w / 2 - 2.6), 4, d / 2 + 0.12], [2, 1.8, 0.1], undefined, 0.3);
    box(g, '#ffffff', [s * (w / 2 - 2.6), 9.6, d / 2 + 0.05], [2.4, 2.4, 0.2]);
    box(g, '#bfe9ff', [s * (w / 2 - 2.6), 9.6, d / 2 + 0.12], [2, 2, 0.1], undefined, 0.3);
    rbox(g, '#7ccf6a', [s * (w / 2 - 2.6), 2.8, d / 2 + 0.5], [2.6, 0.6, 0.7]);
    for (let i = 0; i < 3; i++) sph(g, ['#ff8fb1', '#ffe066', '#ff6f6f'][i], [s * (w / 2 - 2.6) + (i - 1) * 0.7, 3.2, d / 2 + 0.55], [0.4, 0.4, 0.4]);
  }
  // path + mailbox
  box(g, ROAD, [0, 0.03, d / 2 + 3], [3, 0.06, 5]);
  solid(cyl(g, '#a0632f', [3.5, 0.8, d / 2 + 3], [0.2, 1.6, 0.2]), 'circle', 0.3);
  rbox(g, '#ff6f6f', [3.5, 1.8, d / 2 + 3], [0.7, 0.6, 1.0]);
  sign(g, 'Hjem', 8.0, d / 2 + 0.12, '#ff8fb1', 3.6);
  g.userData.size = { w: w + 1, d: d + 1 };
  return g;
}

function tree(g: THREE.Group, x: number, z: number, s: number, kind: number, collide = false) {
  const trunk = cyl(g, '#8a5a3c', [x, 1.35 * s, z], [0.55 * s, 2.7 * s, 0.55 * s]);
  if (collide) solid(trunk, 'circle', 0.85 * s, 8 * s);
  const puff = (col: string, ox: number, oy: number, oz: number, sx: number, sy: number, sz: number) =>
    sph(g, col, [x + ox * s, oy * s, z + oz * s], [sx * s, sy * s, sz * s]);
  if (kind === 0) {
    // fluffy deciduous
    puff('#3fae5a', 0, 3.6, 0, 3.8, 3.2, 3.8);
    puff('#66d06a', 0.9, 4.4, 0.5, 2.6, 2.4, 2.6);
    puff('#4fbf55', -0.8, 4.2, -0.4, 2.4, 2.2, 2.4);
    puff('#7ccf6a', 0.2, 5.2, -0.2, 2.0, 1.8, 2.0);
    puff('#5cc36b', -0.3, 3.2, 0.9, 1.8, 1.6, 1.8);
  } else if (kind === 1) {
    // layered fir
    cone(g, '#2f8a45', [x, 3.2 * s, z], [3.6 * s, 3.2 * s, 3.6 * s]);
    cone(g, '#3fae5a', [x, 4.6 * s, z], [2.8 * s, 2.6 * s, 2.8 * s]);
    cone(g, '#4fbf65', [x, 5.8 * s, z], [1.8 * s, 2.0 * s, 1.8 * s]);
  } else if (kind === 2) {
    // pink blossom
    puff('#ff9fc8', 0, 3.5, 0, 3.5, 3.1, 3.5);
    puff('#ffc2dc', -0.7, 4.3, 0.3, 2.2, 2.0, 2.2);
    puff('#ffa6d5', 0.8, 4.0, -0.5, 2.0, 1.8, 2.0);
  } else {
    // pastel purple
    puff('#c9a0ff', 0, 3.6, 0, 3.6, 3.2, 3.6);
    puff('#e0c6ff', 0.7, 4.4, 0.4, 2.4, 2.2, 2.4);
    puff('#b78bff', -0.8, 4.1, -0.3, 2.2, 2.0, 2.2);
    puff('#d8b4ff', 0.1, 5.1, 0.1, 1.8, 1.6, 1.8);
  }
}

export function buildTown(): Town {
  const group = new THREE.Group();
  const stat = new THREE.Group();
  const zones: Zone[] = [];
  const rects: RectCollider[] = [];
  const circles: CircleCollider[] = [];

  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 2, SIZE * 2), new THREE.MeshLambertMaterial({ color: GRASS }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const P = {
    home: { x: -38, z: -34 },
    shop: { x: 38, z: -34 },
    eggs: { x: 0, z: -50 },
    vet: { x: 46, z: 12 },
    play: { x: -44, z: 16 },
    doors: { x: 4, z: 46 },
    cars: { x: 52, z: -8 },
    pets: { x: -52, z: -8 },
  };
  const surfaces: Surface[] = [];
  const benches: { x: number; z: number; yaw: number }[] = [];

  // plaza + fountain (outer wall jumpable; rim and upper bowl are landable)
  cyl(stat, ROAD, [0, 0.04, 0], [26, 0.08, 26]);
  solid(cyl(stat, '#e6ecff', [0, 0.55, 0], [9, 1.1, 9]), 'circle', 0, 1.15);
  cyl(stat, '#7fd8ff', [0, 1.1, 0], [8, 0.2, 8]);
  solid(cyl(stat, '#e6ecff', [0, 2.2, 0], [1.2, 3, 1.2]), 'circle', 0.1, 4.5);
  solid(cyl(stat, '#e6ecff', [0, 3.6, 0], [4, 0.5, 4]), 'circle', 0, 3.9);
  surfaces.push({ x: 0, z: 0, r: 4.2, top: 1.15 }); // rim
  surfaces.push({ x: 0, z: 0, r: 1.9, top: 3.85 }); // upper bowl
  const water = sph(group, '#bff0ff', [0, 4.2, 0], [1.6, 1.6, 1.6], undefined, 0.3);

  // roads from the plaza to each place
  for (const p of Object.values(P)) {
    const len = Math.hypot(p.x, p.z);
    const ang = Math.atan2(p.x, p.z);
    box(stat, ROAD, [p.x / 2, 0.05, p.z / 2], [6, 0.06, len], [0, ang, 0]);
  }

  const entrances = {} as Town["entrances"];
  const front = (p: { x: number; z: number }, dist: number) => {
    const rot = faceCenter(p.x, p.z);
    return { x: p.x + Math.sin(rot) * dist, z: p.z + Math.cos(rot) * dist, rot };
  };

  // walk-in buildings: the roof lifts off while you are inside, so you can see what is there
  type Shell = { back: THREE.Group; left: THREE.Group; right: THREE.Group; front: THREE.Group };
  const walkIns: { kind: 'shop' | 'vet' | 'cars' | 'pets'; x: number; z: number; rot: number; hw: number; hd: number; roof: THREE.Group; shell: Shell }[] = [];
  /** Put a walk-in building's walls and roof in the world (they are not merged, since they hide and show). */
  const mountShell = (g: THREE.Group, roofG: THREE.Group, p: { x: number; z: number }, rot: number): Shell => {
    const shell = g.userData.shell as Shell;
    for (const o of [g, roofG, ...Object.values(shell)]) {
      o.position.set(p.x, 0, p.z);
      o.rotation.y = rot;
    }
    for (const o of Object.values(shell)) {
      group.add(o);
      const c = collectColliders(o);
      rects.push(...c.rects);
      circles.push(...c.circles);
    }
    return shell;
  };
  const toWorld = (p: { x: number; z: number }, rot: number, lx: number, lz: number) => ({ x: p.x + lx * Math.cos(rot) + lz * Math.sin(rot), z: p.z - lx * Math.sin(rot) + lz * Math.cos(rot) });
  const vetBeds: Town['vetBeds'] = [];
  // shop: you walk in through the door and shop at the counter
  {
    const g = openBuilding(14, 10, 6, '#ffe8a8', '#ff6f6f', '#ffffff', { door: 4.4, roofSeparate: true });
    const roofG = g.userData.roof as THREE.Group;
    awning(roofG, 14, 5.4, 5.6, '#ff6f6f', '#ffffff');
    sign(roofG, 'Butikk', 7.5, 5.8, '#ff6f6f');
    const inside = fillShop(g);
    const f = front(P.shop, 0);
    stat.add(g);
    group.add(roofG);
    const shell = mountShell(g, roofG, P.shop, f.rot);
    walkIns.push({ kind: 'shop', x: P.shop.x, z: P.shop.z, rot: f.rot, hw: 7, hd: 5, roof: roofG, shell });
    const z = toWorld(P.shop, f.rot, inside.counter.x, inside.counter.z);
    zones.push({ kind: 'shop', x: z.x, z: z.z, r: 3.2, label: 'Handle mat 🛒' });
    const door = front(P.shop, 8.5);
    entrances.shop = { x: door.x, z: door.z, yaw: f.rot };
  }
  // animal hospital: a walk-in building with beds
  {
    const g = openBuilding(14, 11, 6.5, '#ffffff', '#5cc3f2', '#9ad8ff', { door: 5, roofSeparate: true });
    const roofG = g.userData.roof as THREE.Group;
    sign(roofG, 'Dyrlegen', 8, 6.2, '#3fa4ff');
    box(roofG, '#ff4b4b', [0, 9.6, 0], [0.8, 2.4, 0.8]);
    box(roofG, '#ff4b4b', [0, 9.6, 0], [2.4, 0.8, 0.8]);
    const inside = fillHospital(g);
    const f = front(P.vet, 0);
    stat.add(g);
    group.add(roofG);
    const shell = mountShell(g, roofG, P.vet, f.rot);
    walkIns.push({ kind: 'vet', x: P.vet.x, z: P.vet.z, rot: f.rot, hw: 7, hd: 5.5, roof: roofG, shell });
    for (const b of inside.beds) vetBeds.push({ ...toWorld(P.vet, f.rot, b.x, b.z), y: b.y });
    const p = toWorld(P.vet, f.rot, 0, 1.0);
    zones.push({ kind: 'vet', x: p.x, z: p.z, r: 3.2, label: 'Dyrlegen 🩺' });
    const door = front(P.vet, 9);
    entrances.vet = { x: door.x, z: door.z, yaw: f.rot + Math.PI };
  }
  // egg shop
  {
    const g = openBuilding(12, 9, 6, '#e2c6ff', '#ffd23f', '#ffffff');
    awning(g, 12, 5.4, 5.1, '#c88bff', '#ffffff');
    sign(g, 'Eggbutikk', 7.5, 5.2, '#b05cff');
    sph(g, '#fff4c2', [0, 9.8, 0], [3, 3.8, 3]);
    for (let i = 0; i < 5; i++) sph(g, '#ff8fc7', [Math.cos(i * 1.26) * 1.4, 9.8 + Math.sin(i * 2) * 0.8, Math.sin(i * 1.26) * 1.4], [0.7, 0.7, 0.4]);
    solid(rbox(g, '#ffd23f', [0, 1, 1.2], [7, 2, 1.6]));
    const eggs = ['#bfe9ff', '#ffe8a8', '#e2c6ff', '#ffd23f'];
    eggs.forEach((c, i) => {
      cyl(g, '#ffffff', [-2.7 + i * 1.8, 2.1, 1.2], [1, 0.2, 1]);
      sph(g, c, [-2.7 + i * 1.8, 2.8, 1.2], [1.0, 1.3, 1.0]);
    });
    const f = front(P.eggs, 0);
    g.position.set(P.eggs.x, 0, P.eggs.z);
    g.rotation.y = f.rot;
    stat.add(g);
    const z = front(P.eggs, 6.8);
    zones.push({ kind: 'eggs', x: z.x, z: z.z, r: 4, label: 'Kjøp egg 🥚' });
    entrances.eggs = { x: z.x, z: z.z, yaw: f.rot + Math.PI };
  }
  // car shop (bilbutikk)
  {
    const g = openBuilding(18, 13, 7, '#dfe8ff', '#3fa4ff', '#ffffff', { door: 5.2, roofSeparate: true });
    const roofG = g.userData.roof as THREE.Group;
    awning(roofG, 18, 6.0, 7.2, '#3fa4ff', '#ffffff');
    sign(roofG, 'Bilbutikk', 8.2, 7.4, '#3fa4ff', 8);
    const inside = fillCarShop(g);
    const f = front(P.cars, 0);
    stat.add(g);
    group.add(roofG);
    const shell = mountShell(g, roofG, P.cars, f.rot);
    walkIns.push({ kind: 'cars', x: P.cars.x, z: P.cars.z, rot: f.rot, hw: 9, hd: 6.5, roof: roofG, shell });
    const z = toWorld(P.cars, f.rot, inside.counter.x, inside.counter.z);
    zones.push({ kind: 'cars', x: z.x, z: z.z, r: 3.2, label: 'Se på biler 🚗' });
    const door = front(P.cars, 10);
    entrances.cars = { x: door.x, z: door.z, yaw: f.rot };
  }
  // pet shop (dyrebutikk)
  {
    const g = openBuilding(16, 12, 6.5, '#ffe0ef', '#ff8fb1', '#ffffff', { door: 4.8, roofSeparate: true });
    const roofG = g.userData.roof as THREE.Group;
    awning(roofG, 16, 5.6, 6.6, '#ff8fb1', '#ffffff');
    sign(roofG, 'Dyrebutikk', 7.8, 6.8, '#ff8fb1', 8);
    const inside = fillPetShop(g);
    const f = front(P.pets, 0);
    stat.add(g);
    group.add(roofG);
    const shell = mountShell(g, roofG, P.pets, f.rot);
    walkIns.push({ kind: 'pets', x: P.pets.x, z: P.pets.z, rot: f.rot, hw: 8, hd: 6, roof: roofG, shell });
    const z = toWorld(P.pets, f.rot, inside.counter.x, inside.counter.z);
    zones.push({ kind: 'pets', x: z.x, z: z.z, r: 3.2, label: 'Dyrebutikk 🐾' });
    const door = front(P.pets, 9.5);
    entrances.pets = { x: door.x, z: door.z, yaw: f.rot };
  }
  // door game hut
  {
    const g = new THREE.Group();
    solid(rbox(g, '#c88bff', [0, 3, 0], [10, 6, 6]), 'rect', 0, 9);
    cone(g, '#ff8fc7', [0, 7.5, 0], [12, 3, 8], [0, Math.PI / 4, 0]).scale.set(13, 3, 9);
    const doorCols = ['#ff6f6f', '#ffe066', '#5cc3f2'];
    doorCols.forEach((c, i) => {
      rbox(g, c, [-3 + i * 3, 1.8, 3.05], [2, 3.4, 0.3]);
      sph(g, '#ffffff', [-2.5 + i * 3, 1.8, 3.25], [0.25, 0.25, 0.2]);
      part(g, G.star(), '#ffffff', [-3 + i * 3, 4.3, 3.1], [0.6, 0.6, 0.3]);
    });
    sign(g, 'Dørspillet', 7.6, 3.6, '#ff4fa8', 6);
    const f = front(P.doors, 0);
    g.position.set(P.doors.x, 0, P.doors.z);
    g.rotation.y = f.rot;
    stat.add(g);
    const z = front(P.doors, 6);
    zones.push({ kind: 'doors', x: z.x, z: z.z, r: 3.5, label: 'Spill Dørspillet 🚪' });
    entrances.doors = { x: z.x, z: z.z, yaw: f.rot + Math.PI };
  }
  // playground
  const equipTargets: THREE.Object3D[] = [];
  const swingGroups: THREE.Group[] = [];
  const seesawGroup = new THREE.Group();
  const merryGroup = new THREE.Group();
  let playRot = 0;
  let equipUse: { id: string; u: number } | null = null;
  {
    const g = new THREE.Group();
    cyl(g, '#ffe8a8', [0, 0.05, 0], [22, 0.1, 22]);
    // slide: tower is fixed, the ramp is a separate (tappable) piece
    for (const x of [-0.8, 0.8]) solid(box(g, '#ff6f6f', [x - 4, 2, -3], [0.3, 4, 0.3]), 'rect', 0.1);
    box(g, '#5cc3f2', [-4, 3.8, -3], [2.2, 0.3, 2]);
    cone(g, '#ff6f6f', [-4, 5.2, -3], [3, 2, 3], [0, Math.PI / 4, 0]);
    // swing frame (the seats are animated pieces below)
    for (const x of [1.5, 6.5]) for (const z of [-4, -2]) solid(box(g, '#7ccf6a', [x, 2.5, z], [0.3, 5, 0.3], [z === -4 ? 0.2 : -0.2, 0, 0]), 'rect', 0.15);
    box(g, '#7ccf6a', [4, SWING_PIVOT_Y, SWING_Z], [5.6, 0.3, 0.3]);
    // sandbox
    solid(rbox(g, '#c98a55', [4, 0.3, 4], [5, 0.6, 5]));
    box(g, '#ffe0a0', [4, 0.5, 4], [4.4, 0.2, 4.4]);
    cone(g, '#ff6f6f', [3.2, 1, 3.4], [0.8, 0.9, 0.8]);
    cone(g, '#555a75', [SEESAW.x, 0.4, SEESAW.z], [1, 0.8, 1]); // seesaw support

    // the pieces that move while somebody is on them
    const anim = new THREE.Group();
    equipTargets.length = 0;
    const tag = (o: THREE.Object3D, id: string) => {
      o.userData.equip = id;
      equipTargets.push(o);
      return o;
    };
    const rampMesh = solid(box(anim, '#ffe066', [SLIDE.x, SLIDE.y, SLIDE.z], [1.6, SLIDE.thick, SLIDE.len], [SLIDE.tilt, 0, 0]));
    tag(rampMesh, 'slide');
    for (const sx of [-0.85, 0.85]) {
      const rail = box(anim, '#ff9f4a', [SLIDE.x + sx, SLIDE.y + 0.25, SLIDE.z], [0.12, 0.3, SLIDE.len], [SLIDE.tilt, 0, 0]);
      rail.userData.equip = 'slide';
      equipTargets.push(rail);
    }
    swingGroups.length = 0;
    SWING_XS.forEach((x, i) => {
      const sg = new THREE.Group();
      sg.position.set(x, SWING_PIVOT_Y, SWING_Z);
      for (const sx of [-0.5, 0.5]) box(sg, '#c0c6d6', [sx, -SWING_ROPE / 2, 0], [0.05, SWING_ROPE, 0.05]);
      solid(rbox(sg, '#ff8fb1', [0, -SWING_ROPE, 0], [1.3, 0.2, 0.7]));
      anim.add(sg);
      tag(sg, `swing${i + 1}`);
      swingGroups.push(sg);
    });
    // seesaw: the plank turns about its middle
    seesawGroup.position.set(SEESAW.x, SEESAW.y, SEESAW.z);
    solid(box(seesawGroup, '#c88bff', [0, 0, 0], [SEESAW.len, SEESAW.thick, 0.8]));
    for (const sx of [-1, 1]) box(seesawGroup, '#ffe066', [sx * 1.7, 0.45, 0], [0.12, 0.7, 0.5]);
    anim.add(seesawGroup);
    tag(seesawGroup, 'seesaw');
    // merry-go-round: a coloured disc that spins
    merryGroup.position.set(MERRY.x, MERRY.y, MERRY.z);
    solid(cyl(merryGroup, '#ffb84d', [0, 0, 0], [MERRY.radius * 2, MERRY.thick, MERRY.radius * 2]), 'circle', 0, 3);
    cyl(merryGroup, '#ff6f6f', [0, 1, 0], [0.3, 2, 0.3]);
    ['#ff6f6f', '#5cc3f2', '#ffe066', '#7ccf6a'].forEach((c, i) => {
      const a = (i / 4) * Math.PI * 2;
      box(merryGroup, c, [Math.cos(a) * 1.5, 0.4, Math.sin(a) * 1.5], [0.9, 0.5, 0.9], [0, -a, 0]);
    });
    anim.add(merryGroup);
    tag(merryGroup, 'merry');
    // trampoline
    const trampGroup = new THREE.Group();
    trampGroup.position.set(TRAMP.x, TRAMP.y, TRAMP.z);
    solid(cyl(trampGroup, '#5a6a7a', [0, 0, 0], [TRAMP.radius * 2.1, TRAMP.thick, TRAMP.radius * 2.1]), 'circle', 0, 2);
    cyl(trampGroup, '#c88bff', [0, 0.06, 0], [TRAMP.radius * 1.85, 0.08, TRAMP.radius * 1.85]);
    for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      box(trampGroup, '#ff8fb1', [Math.cos(a) * TRAMP.radius, 0.55, Math.sin(a) * TRAMP.radius], [0.12, 1.1, 0.12]);
    }
    anim.add(trampGroup);
    tag(trampGroup, 'tramp');
    // fence: posts joined by rails, with a gap (gate) facing the plaza
    const inGate = (a: number) => Math.abs(Math.atan2(Math.sin(a - faceCenter(P.play.x, P.play.z) + Math.PI / 2), Math.cos(a - faceCenter(P.play.x, P.play.z) + Math.PI / 2))) < 0.35;
    const FENCE_N = 28;
    for (let i = 0; i < FENCE_N; i++) {
      const a = (i / FENCE_N) * Math.PI * 2;
      if (inGate(a)) continue;
      solid(rbox(g, '#ffffff', [Math.cos(a) * 11, 0.7, Math.sin(a) * 11], [0.4, 1.4, 0.4]));
      const a2 = ((i + 0.5) / FENCE_N) * Math.PI * 2;
      if (inGate(a) || inGate(((i + 1) / FENCE_N) * Math.PI * 2)) continue;
      // rail between this post and the next
      const len = 2 * 11 * Math.sin(Math.PI / FENCE_N);
      const r = 11 * Math.cos(Math.PI / FENCE_N);
      solid(box(g, '#f2f2f8', [Math.cos(a2) * r, 0.95, Math.sin(a2) * r], [len, 0.18, 0.14], [0, -a2 + Math.PI / 2, 0]));
      box(g, '#f2f2f8', [Math.cos(a2) * r, 0.45, Math.sin(a2) * r], [len, 0.14, 0.12], [0, -a2 + Math.PI / 2, 0]);
    }
    sign(g, 'Lekeplass', 3, 11.5, '#54c45e', 6).rotation.y = 0;
    const f = front(P.play, 0);
    g.position.set(P.play.x, 0, P.play.z);
    g.rotation.y = f.rot;
    stat.add(g);
    anim.position.copy(g.position);
    anim.rotation.y = f.rot;
    group.add(anim);
    shadowAll(anim, true, true);
    const ac = collectColliders(anim);
    rects.push(...ac.rects);
    circles.push(...ac.circles);
    playRot = f.rot;
    zones.push({ kind: 'play', x: P.play.x, z: P.play.z, r: 10.5, label: 'Lekeplassen ⚽' });
    const pp = front(P.play, 0);
    entrances.play = { x: pp.x, z: pp.z, yaw: f.rot + Math.PI };
  }

  const playToWorld = (lx: number, lz: number) => ({
    x: P.play.x + lx * Math.cos(playRot) + lz * Math.sin(playRot),
    z: P.play.z - lx * Math.sin(playRot) + lz * Math.cos(playRot),
  });
  const equipment: WorldEquip[] = EQUIPMENT.map((e) => {
    const c = playToWorld(e.x, e.z);
    const x = playToWorld(e.exit.x, e.exit.z);
    return { ...e, wx: c.x, wz: c.z, exitX: x.x, exitZ: x.z, exitYaw: e.exit.yaw + playRot };
  });

  // trees, bushes, flowers, lamps, benches (deterministic positions)
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const blocked = (x: number, z: number) =>
    Math.hypot(x, z) < 16 ||
    Object.values(P).some((p) => Math.hypot(x - p.x, z - p.z) < 16) ||
    Object.values(P).some((p) => {
      // near the road line
      const len = Math.hypot(p.x, p.z);
      const t = Math.max(0, Math.min(1, (x * p.x + z * p.z) / (len * len)));
      return Math.hypot(x - p.x * t, z - p.z * t) < 6;
    });
  for (let i = 0; i < 140; i++) {
    const x = (rnd() - 0.5) * SIZE * 0.95;
    const z = (rnd() - 0.5) * SIZE * 0.95;
    if (blocked(x, z)) continue;
    const s = 0.8 + rnd() * 0.6;
    tree(stat, x, z, s, Math.floor(rnd() * 4), true);
  }
  // a ring of trees on the edge
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2;
    const r = SIZE / 2 + 4 + (i % 3) * 3;
    tree(stat, Math.cos(a) * r, Math.sin(a) * r, 1.3, i % 4);
  }
  const flowerCols = ['#ff8fb1', '#ffe066', '#ffffff', '#c88bff', '#ff6f6f'];
  for (let i = 0; i < 160; i++) {
    const x = (rnd() - 0.5) * SIZE * 0.9;
    const z = (rnd() - 0.5) * SIZE * 0.9;
    if (blocked(x, z)) continue;
    if (i % 4 === 0) solid(sph(stat, '#5cc36b', [x, 0.5, z], [2, 1.4, 2]), 'circle', 0.1);
    else {
      box(stat, '#3fbf5a', [x, 0.3, z], [0.08, 0.6, 0.08]);
      sph(stat, flowerCols[i % 5], [x, 0.65, z], [0.35, 0.3, 0.35]);
    }
  }
  // lamps sit OFF the roads (between road wedges), benches have legs and are sit-targets
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    // place between plaza and buildings, but offset from road spokes
    const x = Math.cos(a + 0.22) * 18;
    const z = Math.sin(a + 0.22) * 18;
    solid(cyl(stat, '#555a75', [x, 2.5, z], [0.25, 5, 0.25]), 'circle', 0.25, 5.5);
    sph(stat, '#fff4c2', [x, 5.2, z], [0.8, 0.8, 0.8], undefined, 0.6);
    if (i % 2 === 0) {
      const ba = a + 0.55;
      const bx = Math.cos(ba) * 16;
      const bz = Math.sin(ba) * 16;
      const rot = -ba + Math.PI / 2;
      // legs
      for (const sx of [-1.1, 1.1]) for (const sz of [-0.35, 0.35]) {
        const lx = bx + Math.cos(rot) * sx - Math.sin(rot) * sz;
        const lz = bz - Math.sin(rot) * sx + Math.cos(rot) * sz;
        solid(cyl(stat, '#8a5a3c', [lx, 0.35, lz], [0.16, 0.7, 0.16]), 'circle', 0.05, 0.8);
      }
      // seat + back
      solid(box(stat, '#c98a55', [bx, 0.85, bz], [2.8, 0.18, 0.95], [0, rot, 0]), 'rect', 0.05, 1.0);
      solid(box(stat, '#c98a55', [bx - Math.sin(rot) * 0.45, 1.35, bz - Math.cos(rot) * 0.45], [2.8, 0.7, 0.14], [0, rot, 0]), 'rect', 0.05, 1.8);
      benches.push({ x: bx, z: bz, yaw: rot + Math.PI });
    }
  }
  // hills at the edge
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    sph(stat, '#6cc65a', [Math.cos(a) * (SIZE / 2 + 25), 0, Math.sin(a) * (SIZE / 2 + 25)], [50, 26, 50]);
  }

  // colliders come from the real meshes that were marked solid()
  const fixed = collectColliders(stat);
  rects.push(...fixed.rects);
  circles.push(...fixed.circles);

  const merged = mergeStatic(stat, { cast: true, receive: true });
  group.add(merged);

  // clouds (separate so they can drift)
  const clouds = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 4; j++) sph(c, '#ffffff', [j * 2.4 - 3.6, Math.sin(j) * 0.8, (j % 2) * 1.2], [4 - Math.abs(j - 1.5), 3 - Math.abs(j - 1.5) * 0.6, 3]);
    c.position.set((rnd() - 0.5) * SIZE * 1.2, 30 + rnd() * 12, (rnd() - 0.5) * SIZE * 1.2);
    clouds.add(c);
  }
  const mergedClouds = mergeStatic(clouds);
  group.add(mergedClouds);

  // neighbourhood: several house plots (plot 0 = local player)
  const housePlots: { x: number; z: number; rot: number }[] = [
    { x: P.home.x, z: P.home.z, rot: faceCenter(P.home.x, P.home.z) },
    { x: P.home.x - 28, z: P.home.z + 6, rot: faceCenter(P.home.x - 28, P.home.z + 6) },
    { x: P.home.x - 14, z: P.home.z - 28, rot: faceCenter(P.home.x - 14, P.home.z - 28) },
    { x: P.home.x + 14, z: P.home.z - 30, rot: faceCenter(P.home.x + 14, P.home.z - 30) },
    { x: P.home.x + 30, z: P.home.z + 4, rot: faceCenter(P.home.x + 30, P.home.z + 4) },
    { x: P.home.x - 36, z: P.home.z - 18, rot: faceCenter(P.home.x - 36, P.home.z - 18) },
  ];
  // short roads from plaza toward each plot (after merge: add to group)
  for (const plot of housePlots.slice(1)) {
    const len = Math.hypot(plot.x, plot.z);
    const ang = Math.atan2(plot.x, plot.z);
    const road = box(group, ROAD, [plot.x / 2, 0.04, plot.z / 2], [4.5, 0.05, len], [0, ang, 0]);
    road.receiveShadow = true;
  }
  type PlotState = { holder: THREE.Group; rects: RectCollider[]; circles: CircleCollider[]; zone: Zone | null };
  const plots: PlotState[] = housePlots.map((plot, i) => {
    const holder = new THREE.Group();
    holder.position.set(plot.x, 0, plot.z);
    holder.rotation.y = plot.rot;
    group.add(holder);
    // empty lot pad
    box(holder, '#cfe8b8', [0, 0.02, 0], [16, 0.04, 12]).userData.noCast = true;
    return { holder, rects: [], circles: [], zone: i === 0 ? ({ kind: 'home', x: 0, z: 0, r: 3.5, label: 'Gå inn 🏠' } as Zone) : null };
  });
  if (plots[0].zone) zones.push(plots[0].zone);

  function mountHouseOn(plotIdx: number, style: HouseStyle | null, label?: string) {
    const plot = housePlots[plotIdx];
    const st = plots[plotIdx];
    if (!plot || !st) return;
    for (const r of st.rects) {
      const i = rects.indexOf(r);
      if (i >= 0) rects.splice(i, 1);
    }
    for (const c of st.circles) {
      const i = circles.indexOf(c);
      if (i >= 0) circles.splice(i, 1);
    }
    st.rects = [];
    st.circles = [];
    st.holder.clear();
    box(st.holder, '#cfe8b8', [0, 0.02, 0], [16, 0.04, 12]).userData.noCast = true;
    if (!style) {
      if (st.zone && plotIdx !== 0) {
        const zi = zones.indexOf(st.zone);
        if (zi >= 0) zones.splice(zi, 1);
        st.zone = null;
      }
      return;
    }
    const ext = homeExterior(style);
    if (label) sign(ext, label.slice(0, 10), 8.0, (ext.userData.size as { d: number }).d / 2 + 0.12, '#54c45e', 3.6);
    const size = ext.userData.size as { w: number; d: number };
    st.holder.add(ext);
    const hc = collectColliders(ext);
    st.rects = hc.rects;
    st.circles = hc.circles;
    rects.push(...st.rects);
    circles.push(...st.circles);
    st.holder.remove(ext);
    st.holder.add(mergeStatic(ext, { cast: true, receive: true }));
    const dist = size.d / 2 + 2.2;
    if (plotIdx === 0) {
      const zone = plots[0].zone!;
      zone.x = plot.x + Math.sin(plot.rot) * dist;
      zone.z = plot.z + Math.cos(plot.rot) * dist;
      entrances.home = { x: plot.x + Math.sin(plot.rot) * (dist + 2), z: plot.z + Math.cos(plot.rot) * (dist + 2), yaw: plot.rot };
    }
  }
  function setHomeStyle(style: HouseStyle) {
    mountHouseOn(0, style);
  }
  function setPlotHouse(plot: number, style: HouseStyle | null, label?: string) {
    if (plot <= 0 || plot >= housePlots.length) return;
    mountHouseOn(plot, style, label);
  }
  setHomeStyle('hytte');

  function buildingAt(x: number, z: number) {
    for (const b of walkIns) {
      const lx = (x - b.x) * Math.cos(b.rot) - (z - b.z) * Math.sin(b.rot);
      const lz = (x - b.x) * Math.sin(b.rot) + (z - b.z) * Math.cos(b.rot);
      if (Math.abs(lx) < b.hw - 0.3 && Math.abs(lz) < b.hd - 0.3) return { kind: b.kind as 'shop' | 'vet' | 'cars' | 'pets', x: b.x, z: b.z, r: Math.hypot(b.hw, b.hd) + 1.5 };
    }
    return null;
  }
  function insideBuilding(x: number, z: number): 'shop' | 'vet' | 'cars' | 'pets' | null {
    return buildingAt(x, z)?.kind ?? null;
  }

  return {
    group,
    zones,
    rects,
    circles,
    surfaces,
    benches,
    housePlots,
    get spawn() {
      return { x: entrances.home.x, z: entrances.home.z, yaw: entrances.home.yaw };
    },
    entrances,
    vetBeds,
    setHomeStyle,
    setPlotHouse,
    equipment,
    equipTargets,
    setEquipUse(use) {
      equipUse = use;
      if (!use) {
        swingGroups.forEach((sg) => (sg.rotation.x = 0));
        seesawGroup.rotation.z = 0;
      }
    },
    seatWorld(id, u) {
      const l = seatAt(id, u);
      const w = playToWorld(l.x, l.z);
      const f = playToWorld(l.focus.x, l.focus.z);
      return { ...l, x: w.x, z: w.z, yaw: l.yaw + playRot, focus: { x: f.x, y: l.focus.y, z: f.z } };
    },
    insideBuilding,
    buildingAt,
    size: SIZE,
    update(t: number, px?: number, pz?: number, camX?: number, camZ?: number) {
      for (const b of walkIns) {
        const inside = px !== undefined && pz !== undefined && insideBuilding(px, pz) === b.kind;
        b.roof.visible = !inside;
        // walls between the camera and the player are hidden, the others stay
        const cx = camX ?? b.x;
        const cz = camZ ?? b.z;
        const lx = (cx - b.x) * Math.cos(b.rot) - (cz - b.z) * Math.sin(b.rot);
        const lz = (cx - b.x) * Math.sin(b.rot) + (cz - b.z) * Math.cos(b.rot);
        b.shell.back.visible = !inside || lz > -b.hd + 0.5;
        b.shell.front.visible = !inside || lz < b.hd - 0.5;
        b.shell.left.visible = !inside || lx > -b.hw + 0.5;
        b.shell.right.visible = !inside || lx < b.hw - 0.5;
      }
      if (equipUse) {
        const u = equipUse.u;
        if (equipUse.id.startsWith('swing')) swingGroups[Number(equipUse.id.slice(5)) - 1].rotation.x = -swingAngle(u);
        else if (equipUse.id === 'seesaw') seesawGroup.rotation.z = seesawAngle(u);
        else if (equipUse.id === 'merry') merryGroup.rotation.y = -merryAngle(u);
      }
      mergedClouds.position.x = Math.sin(t * 0.02) * 20;
      water.position.y = 4.2 + Math.sin(t * 3) * 0.15;
    },
  };
}
