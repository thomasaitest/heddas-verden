import * as THREE from 'three';
import { HOUSE_BY_STYLE, type HouseStyle } from '../logic/catalog.ts';
import type { CircleCollider, RectCollider } from '../logic/collision.ts';
import { collectColliders, solid } from './colliders.ts';
import { fillHospital, fillShop } from './buildings.ts';
import { box, cone, cyl, G, mergeStatic, part, rbox, sph, textTexture } from './kit.ts';

export type ZoneKind = 'home' | 'shop' | 'vet' | 'eggs' | 'doors' | 'play';
export interface Zone {
  kind: ZoneKind;
  x: number;
  z: number;
  r: number;
  label: string;
}
export type { CircleCollider, RectCollider } from '../logic/collision.ts';

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
  /** Animate; roofs of the shop and the hospital are lifted off while the player is inside. */
  update(t: number, px?: number, pz?: number, camX?: number, camZ?: number): void;
  /** Centre and radius of the walk-in building the point is inside (the camera must not be pushed in by its walls). */
  buildingAt(x: number, z: number): { kind: 'shop' | 'vet'; x: number; z: number; r: number } | null;
  /** Which walk-in building the point is inside, if any. */
  insideBuilding(x: number, z: number): 'shop' | 'vet' | null;
  size: number;
}

const GRASS = '#7fd36a';
const ROAD = '#f2dfb8';
const SIZE = 200;

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
  const info = HOUSE_BY_STYLE[style];
  const g = new THREE.Group();
  const w = style === 'slott' ? 18 : style === 'gard' ? 16 : style === 'villa' ? 15 : 12;
  const d = w * 0.75;
  const h = style === 'slott' ? 9 : 7;
  solid(box(g, '#e8d8c4', [0, 0.25, 0], [w + 1, 0.5, d + 1]), 'rect', 0, 14);
  solid(box(g, info.wall, [0, h / 2 + 0.5, 0], [w, h, d]), 'rect', 0, 14);
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
    const roof = cone(g, info.roof, [0, h + 2.3, 0], [w * 0.9, 4, d * 1.05], [0, Math.PI / 4, 0]);
    roof.scale.set(w * 1.05, 4, w * 1.05);
    roof.geometry = new THREE.ConeGeometry(0.5, 1, 4);
    roof.scale.set(w * 1.45, 4.2, d * 1.45);
    if (style === 'gard') for (const s of [-1, 1]) box(g, '#ffffff', [s * 3, 3.2, d / 2 + 0.02], [2.4, 0.3, 0.1], [0, 0, s * 0.8]);
    cyl(g, '#b46a50', [w / 4, h + 3, -d / 6], [1, 3, 1]);
  }
  // door + windows
  rbox(g, '#a0632f', [0, 2.2, d / 2 + 0.05], [2.6, 3.6, 0.3]);
  sph(g, '#ffd23f', [0.8, 2.2, d / 2 + 0.25], [0.25, 0.25, 0.2]);
  for (const s of [-1, 1]) {
    box(g, '#ffffff', [s * (w / 2 - 2.6), 4, d / 2 + 0.05], [2.4, 2.2, 0.2]);
    box(g, '#bfe9ff', [s * (w / 2 - 2.6), 4, d / 2 + 0.12], [2, 1.8, 0.1], undefined, 0.3);
    rbox(g, '#7ccf6a', [s * (w / 2 - 2.6), 2.8, d / 2 + 0.5], [2.6, 0.6, 0.7]);
    for (let i = 0; i < 3; i++) sph(g, ['#ff8fb1', '#ffe066', '#ff6f6f'][i], [s * (w / 2 - 2.6) + (i - 1) * 0.7, 3.2, d / 2 + 0.55], [0.4, 0.4, 0.4]);
  }
  // path + mailbox
  box(g, ROAD, [0, 0.03, d / 2 + 3], [3, 0.06, 5]);
  solid(cyl(g, '#a0632f', [3.5, 0.8, d / 2 + 3], [0.2, 1.6, 0.2]), 'circle', 0.3);
  rbox(g, '#ff6f6f', [3.5, 1.8, d / 2 + 3], [0.7, 0.6, 1.0]);
  sign(g, 'Hjem', 5.9, d / 2 + 0.12, '#ff8fb1', 3.6);
  g.userData.size = { w: w + 1, d: d + 1 };
  return g;
}

function tree(g: THREE.Group, x: number, z: number, s: number, kind: number, collide = false) {
  const trunk = cyl(g, '#a0703f', [x, 1.2 * s, z], [0.7 * s, 2.4 * s, 0.7 * s]);
  // the solid part is the trunk plus a bit of the low foliage, so you can't stand inside the leaves
  if (collide) solid(trunk, 'circle', 0.65 * s, 7 * s);
  if (kind === 0) {
    sph(g, '#4fbf55', [x, 3.4 * s, z], [3.6 * s, 3.2 * s, 3.6 * s]);
    sph(g, '#66d06a', [x + 0.8 * s, 4.2 * s, z + 0.4 * s], [2.2 * s, 2 * s, 2.2 * s]);
  } else if (kind === 1) {
    cone(g, '#3fae5a', [x, 3.6 * s, z], [3.4 * s, 3.6 * s, 3.4 * s]);
    cone(g, '#4fbf65', [x, 5.2 * s, z], [2.4 * s, 2.6 * s, 2.4 * s]);
  } else {
    sph(g, '#ff9fc8', [x, 3.4 * s, z], [3.4 * s, 3 * s, 3.4 * s]);
    sph(g, '#ffc2dc', [x - 0.7 * s, 4.1 * s, z], [2 * s, 1.8 * s, 2 * s]);
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
  };

  // plaza + fountain
  cyl(stat, ROAD, [0, 0.04, 0], [26, 0.08, 26]);
  solid(cyl(stat, '#e6ecff', [0, 0.6, 0], [9, 1.2, 9]), 'circle', 0, 6);
  cyl(stat, '#7fd8ff', [0, 1.1, 0], [8, 0.2, 8]);
  cyl(stat, '#e6ecff', [0, 2.2, 0], [1.2, 3, 1.2]);
  cyl(stat, '#e6ecff', [0, 3.6, 0], [4, 0.5, 4]);
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
  const walkIns: { kind: 'shop' | 'vet'; x: number; z: number; rot: number; hw: number; hd: number; roof: THREE.Group; shell: Shell }[] = [];
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
  {
    const g = new THREE.Group();
    cyl(g, '#ffe8a8', [0, 0.05, 0], [22, 0.1, 22]);
    // slide
    for (const x of [-0.8, 0.8]) solid(box(g, '#ff6f6f', [x - 4, 2, -3], [0.3, 4, 0.3]), 'rect', 0.1);
    box(g, '#5cc3f2', [-4, 3.8, -3], [2.2, 0.3, 2]);
    cone(g, '#ff6f6f', [-4, 5.2, -3], [3, 2, 3], [0, Math.PI / 4, 0]);
    solid(box(g, '#ffe066', [-4, 2, 0.2], [1.6, 0.25, 5.6], [0.62, 0, 0]));
    // swings
    for (const x of [1.5, 6.5]) for (const z of [-4, -2]) solid(box(g, '#7ccf6a', [x, 2.5, z], [0.3, 5, 0.3], [z === -4 ? 0.2 : -0.2, 0, 0]), 'rect', 0.15);
    box(g, '#7ccf6a', [4, 5, -3], [5.6, 0.3, 0.3]);
    for (const x of [2.8, 5.2]) {
      for (const s of [-0.5, 0.5]) box(g, '#c0c6d6', [x + s, 3.4, -3], [0.05, 3.2, 0.05]);
      solid(rbox(g, '#ff8fb1', [x, 1.8, -3], [1.3, 0.2, 0.7]));
    }
    // sandbox + seesaw + merry-go-round
    solid(rbox(g, '#c98a55', [4, 0.3, 4], [5, 0.6, 5]));
    box(g, '#ffe0a0', [4, 0.5, 4], [4.4, 0.2, 4.4]);
    cone(g, '#ff6f6f', [3.2, 1, 3.4], [0.8, 0.9, 0.8]);
    solid(box(g, '#c88bff', [-4, 0.9, 5.5], [6, 0.25, 0.8], [0, 0, 0.2]));
    cone(g, '#555a75', [-4, 0.4, 5.5], [1, 0.8, 1]);
    solid(cyl(g, '#ffb84d', [0, 0.6, 7.5], [4, 0.3, 4]), 'circle', 0, 3);
    cyl(g, '#ff6f6f', [0, 1.6, 7.5], [0.3, 2, 0.3]);
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
    zones.push({ kind: 'play', x: P.play.x, z: P.play.z, r: 10.5, label: 'Lekeplassen ⚽' });
    const pp = front(P.play, 0);
    entrances.play = { x: pp.x, z: pp.z, yaw: f.rot + Math.PI };
  }

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
    tree(stat, x, z, s, Math.floor(rnd() * 3), true);
  }
  // a ring of trees on the edge
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2;
    const r = SIZE / 2 + 4 + (i % 3) * 3;
    tree(stat, Math.cos(a) * r, Math.sin(a) * r, 1.3, i % 3);
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
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    const x = Math.cos(a) * 15;
    const z = Math.sin(a) * 15;
    solid(cyl(stat, '#555a75', [x, 2.5, z], [0.25, 5, 0.25]), 'circle', 0.2);
    sph(stat, '#fff4c2', [x, 5.2, z], [0.8, 0.8, 0.8], undefined, 0.6);
    if (i % 2 === 0) {
      const bx = Math.cos(a + 0.2) * 14;
      const bz = Math.sin(a + 0.2) * 14;
      const rot = -a + Math.PI / 2;
      solid(box(stat, '#c98a55', [bx, 0.9, bz], [3, 0.2, 1], [0, rot, 0]), 'rect', 0.1, 2);
      solid(box(stat, '#c98a55', [bx - Math.cos(a) * 0.4, 1.5, bz - Math.sin(a) * 0.4], [3, 0.8, 0.15], [0, rot, 0]), 'rect', 0.1);
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

  // home exterior (changes with the house style)
  const homeHolder = new THREE.Group();
  const homeRot = faceCenter(P.home.x, P.home.z);
  homeHolder.position.set(P.home.x, 0, P.home.z);
  homeHolder.rotation.y = homeRot;
  group.add(homeHolder);
  let homeRects: RectCollider[] = [];
  let homeCircles: CircleCollider[] = [];
  const homeZone: Zone = { kind: 'home', x: 0, z: 0, r: 3.5, label: 'Gå inn 🏠' };
  zones.push(homeZone);

  function setHomeStyle(style: HouseStyle) {
    homeHolder.clear();
    const ext = homeExterior(style);
    const size = ext.userData.size as { w: number; d: number };
    // derive the house colliders from its solid parts (needs the holder's transform)
    homeHolder.add(ext);
    const hc = collectColliders(ext);
    for (const r of homeRects) rects.splice(rects.indexOf(r), 1);
    for (const c of homeCircles) circles.splice(circles.indexOf(c), 1);
    homeRects = hc.rects;
    homeCircles = hc.circles;
    rects.push(...homeRects);
    circles.push(...homeCircles);
    homeHolder.remove(ext);
    homeHolder.add(mergeStatic(ext, { cast: true, receive: true }));
    const dist = size.d / 2 + 2.2;
    homeZone.x = P.home.x + Math.sin(homeRot) * dist;
    homeZone.z = P.home.z + Math.cos(homeRot) * dist;
    entrances.home = { x: P.home.x + Math.sin(homeRot) * (dist + 2), z: P.home.z + Math.cos(homeRot) * (dist + 2), yaw: homeRot };
  }
  setHomeStyle('hytte');

  function buildingAt(x: number, z: number) {
    for (const b of walkIns) {
      const lx = (x - b.x) * Math.cos(b.rot) - (z - b.z) * Math.sin(b.rot);
      const lz = (x - b.x) * Math.sin(b.rot) + (z - b.z) * Math.cos(b.rot);
      if (Math.abs(lx) < b.hw - 0.3 && Math.abs(lz) < b.hd - 0.3) return { kind: b.kind, x: b.x, z: b.z, r: Math.hypot(b.hw, b.hd) + 1.5 };
    }
    return null;
  }
  function insideBuilding(x: number, z: number): 'shop' | 'vet' | null {
    return buildingAt(x, z)?.kind ?? null;
  }

  return {
    group,
    zones,
    rects,
    circles,
    get spawn() {
      return { x: entrances.home.x, z: entrances.home.z, yaw: entrances.home.yaw };
    },
    entrances,
    vetBeds,
    setHomeStyle,
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
      mergedClouds.position.x = Math.sin(t * 0.02) * 20;
      water.position.y = 4.2 + Math.sin(t * 3) * 0.15;
    },
  };
}
