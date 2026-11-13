/** Visual Skyverden. Collision numbers live in logic/sky.ts; this file only draws them. */

import * as THREE from 'three';
import {
  CLOUD_FLOOR_Y,
  CLOUDS,
  FOREST_TREES,
  LADDER_BASE,
  PLATFORM_TOP,
  RAIN_COIN_COUNT,
  SKY_GATE,
  SLIDE_START,
  SUNBEDS,
  cloudById,
  rainCoinWorld,
  slidePose,
  type CloudId,
} from '../logic/sky.ts';
import { G, box, cone, cyl, part, rbox, sph, textTexture } from './kit.ts';

export interface SkyWorld {
  group: THREE.Group;
  coins: THREE.Object3D[];
  /** Water that bobs while you are in the park. */
  water: THREE.Object3D | null;
  update(t: number, rain: { active: boolean; collected: readonly number[] }): void;
}

const RAINBOW = ['#ff5b6e', '#ff9a3c', '#ffe14d', '#7dff8a', '#5cc3f2', '#8f7bff', '#ff8ad8'];

let rainbowEggMat: THREE.MeshLambertMaterial | null = null;
function eggMaterial(): THREE.MeshLambertMaterial {
  if (rainbowEggMat) return rainbowEggMat;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  RAINBOW.forEach((col, i) => {
    ctx.fillStyle = col;
    const y = (i / RAINBOW.length) * canvas.height;
    ctx.fillRect(0, y, canvas.width, canvas.height / RAINBOW.length + 1);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(24, 28, 8, 12, -0.4, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  rainbowEggMat = new THREE.MeshLambertMaterial({ map: tex });
  return rainbowEggMat;
}

function rainbowEgg(parent: THREE.Object3D, pos: [number, number, number], scale = 1) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), eggMaterial());
  mesh.scale.set(0.62 * scale, 0.86 * scale, 0.62 * scale);
  mesh.position.set(pos[0], pos[1], pos[2]);
  parent.add(mesh);
  return mesh;
}

/** Cotton under and around a coloured deck, so the island reads as a cloud from below and from the side. */
function cloudMass(g: THREE.Object3D, radius: number, tint: string, deck: string) {
  sph(g, '#ffffff', [0, -3.2, 0], [radius * 0.95, 2.6, radius * 0.85], undefined, 0.05);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    const rr = radius * (0.42 + (i % 3) * 0.08);
    sph(g, i % 2 ? '#ffffff' : tint, [Math.cos(a) * rr, -2.2 - (i % 3) * 0.35, Math.sin(a) * rr], [radius * 0.42, 2.15, radius * 0.36], undefined, 0.07);
  }
  // Low cotton around the rim. No single disc: each cloud adds its own activity floor.
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.15;
    const reach = radius * (0.48 + (i % 3) * 0.12);
    const puffR = 2.2 + (i % 4) * 0.55;
    sph(g, i % 2 ? '#ffffff' : tint, [Math.cos(a) * reach, 0.28, Math.sin(a) * reach], [puffR * 1.45, 1.35, puffR * 1.15], undefined, 0.06);
  }
  void deck;
}

function sign(parent: THREE.Object3D, text: string, y: number, z: number, bg: string) {
  const tex = textTexture(text, { bg, fg: '#ffffff', w: 512, h: 128 });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 1.1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }),
  );
  m.position.set(0, y, z);
  m.rotation.y = Math.PI;
  parent.add(m);
}

function cloudGroup(id: CloudId): THREE.Group {
  const g = new THREE.Group();
  const c = CLOUDS.find((x) => x.id === id)!;
  g.position.set(c.x, CLOUD_FLOOR_Y, c.z);
  return g;
}

function stripedRing(parent: THREE.Object3D, pos: [number, number, number]) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  const bands = ['#ff5b6e', '#ffe14d', '#5cc3f2', '#ffffff'];
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = bands[i % bands.length];
    ctx.fillRect((i * canvas.width) / 16, 0, canvas.width / 16 + 1, canvas.height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.22, 12, 32), new THREE.MeshLambertMaterial({ map: tex }));
  mesh.position.set(...pos);
  mesh.rotation.x = Math.PI / 2;
  parent.add(mesh);
}

function sunbed(parent: THREE.Object3D, x: number, z: number, rot: number) {
  const fx = Math.sin(rot);
  const fz = Math.cos(rot);
  rbox(parent, '#f4fbff', [x, 0.32, z], [2.15, 0.16, 0.95], [0, rot, 0]);
  rbox(parent, '#ff5b8a', [x + fx * 0.15, 0.46, z + fz * 0.15], [1.7, 0.1, 0.78], [0, rot, 0]);
  rbox(parent, '#ffe14d', [x - fx * 0.72, 0.58, z - fz * 0.72], [0.55, 0.16, 0.7], [0, rot, 0]);
  box(parent, '#3fa4ff', [x - fx * 0.95, 0.85, z - fz * 0.95], [0.16, 0.7, 0.95], [0.4, rot, 0]);
}

function badeland(parent: THREE.Group): THREE.Mesh {
  const g = cloudGroup('badeland');
  cloudMass(g, cloudById('badeland').r, '#b9f4ff', '#ffe7c2');
  cyl(g, '#ffe7c2', [1.2, 0.06, 0.6], [12.5, 0.12, 10.5]);
  const px = 3.2;
  const pz = 2.6;
  const pw = 7.4;
  const pd = 5.6;
  box(g, '#1d6fbe', [px, -0.02, pz], [pw, 0.45, pd]);
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: '#3ec4ff', transparent: true, opacity: 0.78, emissive: '#7ae1ff', emissiveIntensity: 0.35 }),
  );
  water.position.set(px, 0.22, pz);
  water.scale.set(pw - 0.45, 0.18, pd - 0.45);
  g.add(water);
  box(g, '#ffffff', [px, 0.28, pz - pd / 2], [pw + 0.55, 0.38, 0.38]);
  box(g, '#ffffff', [px, 0.28, pz + pd / 2], [pw + 0.55, 0.38, 0.38]);
  box(g, '#ffffff', [px - pw / 2, 0.28, pz], [0.38, 0.38, pd]);
  box(g, '#ffffff', [px + pw / 2, 0.28, pz], [0.38, 0.38, pd]);
  cyl(g, '#ffe08a', [px - 2.6, 0.45, pz + 0.4], [0.12, 0.9, 0.12]);
  for (const y of [0.15, 0.45, 0.75]) box(g, '#ffffff', [px - 2.35, y, pz + 0.4], [0.45, 0.08, 0.28]);
  stripedRing(g, [px, 0.42, pz]);
  sph(g, '#ffe14d', [px - 1.2, 0.4, pz + 1.5], [0.55, 0.55, 0.55], undefined, 0.15);
  sph(g, '#ff5b6e', [px - 1.05, 0.48, pz + 1.65], [0.22, 0.22, 0.22]);

  rbox(g, '#3f7fd6', [-7.05, 1.7, -3.15], [1.05, 3.4, 1.05]);
  rbox(g, '#ffe066', [SLIDE_START.lx, PLATFORM_TOP + 0.08, SLIDE_START.lz], [2.3, 0.2, 2.05]);
  cyl(g, '#ffffff', [LADDER_BASE.lx - 0.55, 1.6, LADDER_BASE.lz], [0.16, 3.3, 0.16]);
  cyl(g, '#ffffff', [LADDER_BASE.lx + 0.55, 1.6, LADDER_BASE.lz], [0.16, 3.3, 0.16]);
  for (let i = 0; i < 7; i++) box(g, '#ff9a1a', [LADDER_BASE.lx, 0.28 + i * 0.42, LADDER_BASE.lz], [1.15, 0.12, 0.22]);
  {
    const a = slidePose(0.08);
    const b = slidePose(0.62);
    const dx = b.lx - a.lx;
    const dy = b.ly - a.ly;
    const dz = b.lz - a.lz;
    const len = Math.hypot(dx, dy, dz);
    const yaw = Math.atan2(dx, dz);
    const pitch = Math.atan2(-dy, Math.hypot(dx, dz));
    rbox(g, '#1aa2f0', [(a.lx + b.lx) / 2, (a.ly + b.ly) / 2 + 0.05, (a.lz + b.lz) / 2], [1.35, 0.22, len], [pitch, yaw, 0]);
    box(g, '#ffffff', [(a.lx + b.lx) / 2, (a.ly + b.ly) / 2 + 0.22, (a.lz + b.lz) / 2], [1.55, 0.08, len], [pitch, yaw, 0]);
  }

  cyl(g, '#ffffff', [6.2, 1.15, -0.4], [0.08, 2.3, 0.08]);
  cone(g, '#ff5b6e', [6.2, 2.35, -0.4], [1.7, 0.55, 1.7]);
  cyl(g, '#ffffff', [-1.4, 0.7, 5.4], [0.08, 1.4, 0.08]);
  cone(g, '#ffe14d', [-1.4, 1.5, 5.4], [1.35, 0.4, 1.35]);
  for (const bed of SUNBEDS) sunbed(g, bed.lx, bed.lz, bed.rot);
  cyl(g, '#c88bff', [-2.4, 0.85, 4.6], [0.18, 1.7, 0.18]);
  sph(g, '#e8d4ff', [-2.4, 1.8, 4.6], [0.55, 0.55, 0.55], undefined, 0.25);
  sign(g, 'Badeland', 4.6, -7.2, '#3fa4ff');
  parent.add(g);
  return water;
}

function eggShop(parent: THREE.Group) {
  const g = cloudGroup('egg');
  cloudMass(g, cloudById('egg').r, '#ffd0f4', '#ffe4f6');
  cyl(g, '#ffe4f6', [0, 0.06, 0.8], [8.5, 0.12, 7.2]);
  rbox(g, '#fff7fb', [0, 0.7, 1.6], [4.2, 1.35, 1.35]);
  rbox(g, '#ff4fa8', [0, 1.55, 1.6], [4.8, 0.22, 1.9]);
  for (let i = 0; i < 7; i++) {
    const x = -2.1 + i * 0.7;
    box(g, RAINBOW[i], [x, 1.78, 1.15], [0.62, 0.18, 1.7]);
  }
  rainbowEgg(g, [-1.15, 2.15, 1.7], 1.15);
  rainbowEgg(g, [0.05, 2.2, 1.55], 1.25);
  rainbowEgg(g, [1.2, 2.1, 1.75], 1.05);
  cyl(g, '#ffffff', [-1.7, 0.55, 1.6], [0.12, 1.1, 0.12]);
  cyl(g, '#ffffff', [1.7, 0.55, 1.6], [0.12, 1.1, 0.12]);
  for (const [x, z, col] of [[-3.2, -1.2, '#7dff8a'], [3.4, -0.6, '#5cc3f2'], [-2.4, 4.2, '#ffe14d'], [2.8, 4.4, '#ff8ad8']] as const) {
    cyl(g, '#8a5a3c', [x, 0.45, z], [0.12, 0.9, 0.12]);
    sph(g, col, [x, 1.15, z], [0.7, 0.55, 0.7], undefined, 0.1);
  }
  sign(g, 'Regnbueegg', 4.4, -6.4, '#ff4fa8');
  parent.add(g);
}

function mountain(parent: THREE.Group) {
  const g = cloudGroup('fjell');
  cloudMass(g, cloudById('fjell').r, '#e7eef8', '#d5dbe6');
  cyl(g, '#d7dee8', [0, 0.06, 1.2], [14, 0.12, 12]);
  const rock = '#7e8794';
  const rockDark = '#5e6774';
  // One sloping mass. The mouth is a gap in the front slope, not a hut stood in front.
  const lobes: [number, number, number, number, number, number, string][] = [
    [-4.8, 2.6, 4.2, 5.6, 5.2, 6.8, rock],
    [5.1, 2.8, 4.8, 5.8, 5.6, 7.0, rockDark],
    [0.1, 4.7, 3.5, 4.4, 2.0, 2.6, rock],
    [0.4, 4.6, 9.2, 9.2, 8.2, 7.6, '#6d7684'],
    [-2.2, 6.2, 11.0, 5.4, 6.4, 5.2, rock],
    [3.2, 6.8, 11.6, 4.8, 7.4, 4.6, '#8b93a0'],
    [-0.4, 9.4, 12.2, 3.2, 3.6, 3.0, '#f7fbff'],
    [-2.6, 8.2, 11.6, 2.4, 2.2, 2.2, '#ffffff'],
    [2.8, 8.6, 12.4, 2.2, 2.0, 2.0, '#f4f7fb'],
  ];
  cone(g, rock, [-1.6, 6.5, 8.5], [6.5, 13, 6.2]);
  cone(g, rockDark, [3.4, 5.2, 9.2], [5.2, 10.5, 5]);
  cone(g, '#f7fbff', [-1.6, 12.2, 8.5], [2.4, 2.6, 2.2]);
  cone(g, '#ffffff', [3.4, 9.8, 9.2], [1.8, 2.2, 1.8]);
  for (const [x, y, z, sx, sy, sz, col] of lobes) sph(g, col, [x, y, z], [sx, sy, sz]);
  // Stone shelves you can walk up, west of the mouth.
  rbox(g, '#9aa3b0', [-3.4, 0.42, -4.4], [3.6, 0.85, 2.8]);
  rbox(g, '#8b93a0', [-2.4, 0.82, -2.3], [3.4, 1.65, 2.6]);
  // Tunnel and room dug into the slope. Walls sit where the colliders are.
  box(g, '#c4a574', [0, 0.08, 6.4], [3.1, 0.12, 9.2], undefined, 0.08);
  box(g, rockDark, [-2.35, 1.45, 4.3], [1.1, 2.9, 3.8]);
  box(g, rockDark, [2.35, 1.45, 4.3], [1.1, 2.9, 3.8]);
  box(g, rock, [-3.9, 1.55, 8.7], [1.0, 3.1, 4.3]);
  box(g, rock, [3.9, 1.55, 8.7], [1.0, 3.1, 4.3]);
  box(g, rockDark, [0, 1.6, 11.15], [8.2, 3.2, 0.9]);
  box(g, '#4a4038', [0, 2.55, 4.3], [3.0, 0.28, 3.6]);
  box(g, '#4a4038', [0, 2.8, 8.6], [6.4, 0.28, 4.4]);
  for (const [x, z] of [[-1.35, 3.2], [1.35, 5.4], [-2.6, 7.6], [2.6, 9.4]] as const) {
    cyl(g, '#6a4a32', [x, 1.15, z], [0.08, 1.1, 0.08]);
    sph(g, '#ff9a3c', [x, 1.85, z], [0.22, 0.28, 0.22], undefined, 0.85);
  }
  sph(g, '#9af6ff', [-1.6, 0.55, 8.2], [0.35, 0.55, 0.35], undefined, 0.55);
  sph(g, '#d7b4ff', [1.7, 0.4, 9.6], [0.28, 0.42, 0.28], undefined, 0.45);
  sph(g, '#fff4c2', [0.4, 0.35, 7.4], [0.22, 0.32, 0.22], undefined, 0.4);
  rbox(g, '#e0a15c', [0, 0.62, 9.3], [2.3, 1.15, 0.95], undefined, 0.08);
  for (const x of [-0.65, 0, 0.65]) {
    part(g, G.torus(), '#f0b14a', [x, 1.35, 9.05], [0.8, 0.8, 0.55], [Math.PI / 2, 0, 0], 0.25);
  }
  const lamp = new THREE.PointLight('#ffd2a1', 2.8, 18, 1.2);
  lamp.position.set(0, 2.1, 8.4);
  g.add(lamp);
  const mouth = new THREE.PointLight('#ffb26b', 1.2, 8, 1.4);
  mouth.position.set(0, 1.6, 2.4);
  g.add(mouth);
  // Climbing face with holds, outside the cave. Matches the solid in logic/sky.ts.
  box(g, '#9aa4b5', [-7.3, 2.1, 0.3], [1.2, 4.2, 2.6]);
  for (const [x, y, z, col] of [
    [-5.7, 1.1, -0.5, '#ff5b6e'],
    [-5.7, 1.9, 0.4, '#ffe14d'],
    [-5.7, 2.7, 1.2, '#5cc3f2'],
    [-5.7, 3.5, 0.1, '#7dff8a'],
  ] as const) {
    sph(g, col, [x + 0.5, y, z], [0.28, 0.22, 0.28]);
  }
  cyl(g, '#e6b15a', [-6.7, 2.4, 0.3], [0.08, 3.2, 0.08]);
  sign(g, 'Fjellskyen', 5.4, -7.4, '#6b7c93');
  parent.add(g);
}

function forest(parent: THREE.Group, coins: THREE.Object3D[], sparks: THREE.Object3D[]) {
  const g = cloudGroup('skog');
  cloudMass(g, cloudById('skog').r, '#d9ffd0', '#b6f0a8');
  cyl(g, '#c6f2b4', [0, 0.05, 0], [8, 0.1, 8]);
  FOREST_TREES.forEach(([x, z], i) => {
    const h = 1.8 + (i % 4) * 0.45;
    cyl(g, '#8a5a3c', [x, h * 0.5, z], [0.32 + (i % 3) * 0.06, h, 0.32]);
    const col = RAINBOW[i % RAINBOW.length];
    sph(g, col, [x, h + 0.7, z], [1.35, 1.15, 1.35], undefined, 0.08);
    sph(g, RAINBOW[(i + 3) % RAINBOW.length], [x + 0.35, h + 1.35, z + 0.15], [0.9, 0.75, 0.9], undefined, 0.12);
  });
  const bushes: [number, number, string][] = [
    [6.2, -6.2, '#ff8ad8'], [-6.4, 6.2, '#ffe14d'], [7.2, 0.2, '#5cc3f2'], [-1.5, 3.4, '#7dff8a'], [3.6, 4.2, '#ff9a3c'],
  ];
  bushes.forEach(([x, z, col]) => {
    sph(g, col, [x, 0.45, z], [0.8, 0.5, 0.8], undefined, 0.08);
    sph(g, '#ffffff', [x + 0.2, 0.7, z], [0.28, 0.22, 0.28]);
  });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const rad = 4.5 + (i % 5) * 1.4;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    sph(g, RAINBOW[i % RAINBOW.length], [x, 0.22, z], [0.22, 0.28, 0.22], undefined, 0.15);
  }
  const c = CLOUDS.find((x) => x.id === 'skog')!;
  for (let i = 0; i < RAIN_COIN_COUNT; i++) {
    const local = rainCoinWorld(i);
    const coin = cyl(g, '#ffd23f', [local.x - c.x, 4, local.z - c.z], [0.55, 0.12, 0.55], [Math.PI / 2, 0, 0], 0.35);
    coin.visible = false;
    coin.name = `rain-coin-${i}`;
    coins.push(coin);
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.4;
    const rad = 2.4 + (i % 4) * 2.2;
    const spark = sph(g, RAINBOW[i % RAINBOW.length], [Math.cos(a) * rad, 3, Math.sin(a) * rad], [0.18, 0.28, 0.18], undefined, 0.4);
    spark.visible = false;
    sparks.push(spark);
  }
  sign(g, 'Regnbueskog', 5.2, -8, '#3caf4a');
  parent.add(g);
}

function gate(parent: THREE.Group) {
  const g = new THREE.Group();
  g.position.set(SKY_GATE.x, 0, SKY_GATE.z);
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * (0.08 + (i / 7) * 0.84);
    box(g, RAINBOW[i % RAINBOW.length], [Math.cos(a) * 3.4, 0.6 + Math.sin(a) * 4.2, 0], [0.55, 0.55, 0.55]);
  }
  cyl(g, '#ffffff', [-3.4, 2.2, 0], [0.35, 4.4, 0.35]);
  cyl(g, '#ffffff', [3.4, 2.2, 0], [0.35, 4.4, 0.35]);
  const tex = textTexture('Skyverden', { bg: '#7b8cff', fg: '#ffffff', w: 512, h: 128 });
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 1.05),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }),
  );
  plate.position.set(0, 4.6, 0.15);
  plate.rotation.y = Math.PI;
  g.add(plate);
  parent.add(g);
}

export function buildSky(): SkyWorld {
  const group = new THREE.Group();
  group.name = 'skyverden';
  const coins: THREE.Object3D[] = [];
  const sparks: THREE.Object3D[] = [];
  const water = badeland(group);
  eggShop(group);
  mountain(group);
  forest(group, coins, sparks);
  gate(group);
  return {
    group,
    coins,
    water,
    update(t, rain) {
      water.position.y = 0.22 + Math.sin(t * 2.2) * 0.04;
      coins.forEach((c, i) => {
        const show = rain.active && !rain.collected.includes(i);
        c.visible = show;
        if (!show) return;
        const fall = (t * 0.45 + i * 0.17) % 1;
        c.position.y = 0.8 + (1 - fall) * 7.4;
        c.rotation.y = t * 2 + i;
      });
      sparks.forEach((s, i) => {
        s.visible = rain.active;
        if (!rain.active) return;
        const fall = (t * 0.7 + i * 0.13) % 1;
        s.position.y = 0.4 + (1 - fall) * 8;
      });
    },
  };
}
