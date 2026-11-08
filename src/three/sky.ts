/** Visual Skyverden. Collision numbers live in logic/sky.ts; this file only draws them. */

import * as THREE from 'three';
import {
  CLOUD_FLOOR_Y,
  CLOUDS,
  RAIN_COIN_COUNT,
  SKY_GATE,
  rainCoinWorld,
  type CloudId,
} from '../logic/sky.ts';
import { box, cone, cyl, rbox, sph, textTexture } from './kit.ts';

export interface SkyWorld {
  group: THREE.Group;
  coins: THREE.Object3D[];
  /** Water that bobs while you are in the park. */
  water: THREE.Object3D | null;
  update(t: number, rain: { active: boolean; collected: readonly number[] }): void;
}

const RAINBOW = ['#ff5b6e', '#ff9a3c', '#ffe14d', '#7dff8a', '#5cc3f2', '#8f7bff', '#ff8ad8'];

function puff(g: THREE.Object3D, radius: number, tint: string) {
  // Belly stays below the deck so the camera and the activities are not inside the cotton.
  sph(g, '#ffffff', [0, -2.6, 0], [radius * 2.3, 3.4, radius * 2.0], undefined, 0.18);
  sph(g, tint, [-radius * 0.4, -2.3, 0.6], [radius * 1.2, 2.6, radius * 1.1], undefined, 0.22);
  sph(g, '#ffffff', [radius * 0.45, -2.5, -0.5], [radius * 1.1, 2.4, radius * 1.0], undefined, 0.16);
  cyl(g, '#f7fbff', [0, 0.14, 0], [radius * 2.05, 0.28, radius * 2.05]);
}

function sign(parent: THREE.Object3D, text: string, y: number, z: number, bg: string) {
  const tex = textTexture(text, { bg, fg: '#ffffff', w: 512, h: 128 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  m.position.set(0, y, z);
  parent.add(m);
}

function cloudGroup(id: CloudId): THREE.Group {
  const g = new THREE.Group();
  const c = CLOUDS.find((x) => x.id === id)!;
  g.position.set(c.x, CLOUD_FLOOR_Y, c.z);
  return g;
}

function badeland(parent: THREE.Group): THREE.Mesh {
  const g = cloudGroup('badeland');
  puff(g, 13, '#9ef0ff');
  // pool
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: '#5cc3f2', transparent: true, opacity: 0.82, emissive: '#5cc3f2', emissiveIntensity: 0.25 }),
  );
  water.position.set(3.2, 0.22, 2.6);
  water.scale.set(6.4, 0.28, 5.2);
  g.add(water);
  rbox(g, '#ffffff', [3.2, 0.35, 2.6], [6.8, 0.4, 5.6]);
  box(g, '#7fd8ff', [3.2, 0.16, 2.6], [6.2, 0.08, 5.0]);
  // slide tower + chute
  box(g, '#ff8fb1', [-5.6, 1.7, -1.6], [1.6, 3.4, 1.6]);
  box(g, '#ffe066', [-5.6, 3.5, -1.6], [1.9, 0.25, 1.9]);
  box(g, '#5cc3f2', [-1.2, 1.7, 0.6], [7.2, 0.35, 1.5], [0.35, 0, 0]);
  for (const z of [-0.1, 1.3]) box(g, '#ffffff', [-1.2, 1.95, z], [7.0, 0.12, 0.12], [0.35, 0, 0]);
  // sprinkler
  cyl(g, '#c88bff', [-2.2, 0.8, 4.2], [0.25, 1.6, 0.25]);
  sph(g, '#e8d4ff', [-2.2, 1.7, 4.2], [0.7, 0.7, 0.7], undefined, 0.3);
  sign(g, 'Badeland', 4.2, -6, '#3fa4ff');
  parent.add(g);
  return water;
}

function eggShop(parent: THREE.Group) {
  const g = cloudGroup('egg');
  puff(g, 12, '#ffd0f0');
  // stall
  rbox(g, '#ffffff', [0, 0.7, 2.4], [3.6, 1.3, 1.5]);
  rbox(g, '#ff8ad8', [0, 1.5, 2.4], [4.2, 0.2, 2.2]);
  for (const [x, col] of [[-1.1, '#ff5b6e'], [0, '#ffe14d'], [1.1, '#7cf0ff']] as const) {
    sph(g, col, [x, 1.85, 2.2], [0.7, 0.9, 0.7]);
    sph(g, '#ffffff', [x + 0.15, 2.05, 2.45], [0.18, 0.18, 0.12]);
  }
  sign(g, 'Regnbueegg', 4.4, -5.2, '#ff4fa8');
  parent.add(g);
}

function mountain(parent: THREE.Group) {
  const g = cloudGroup('fjell');
  puff(g, 14, '#e7eef8');
  // peak behind the cave
  cone(g, '#8d97a8', [0, 4.2, 8.2], [7.5, 8, 7.5]);
  cone(g, '#ffffff', [0, 7.4, 8.2], [3.2, 2.4, 3.2]);
  // cave mouth and room
  box(g, '#6b5344', [0, 1.5, 2.3], [3.2, 2.6, 0.4]);
  box(g, '#2b241f', [0, 1.15, 2.55], [2.2, 1.8, 0.5]);
  box(g, '#c4a484', [0, 0.12, 4.8], [7.2, 0.12, 5.2]);
  rbox(g, '#d9a066', [0, 0.7, 6.4], [2.6, 1.2, 1.1]);
  cyl(g, '#8a5a3c', [-0.8, 1.5, 6.2], [0.12, 1.1, 0.12]);
  cyl(g, '#e6b15a', [0, 1.55, 6.15], [0.16, 0.9, 0.16], [0, 0, Math.PI / 2]);
  // climb cliff
  box(g, '#9aa4b5', [-5.2, 1.6, 2.2], [1.4, 3.2, 2.8]);
  box(g, '#ffe066', [-5.2, 3.3, 2.2], [0.3, 0.3, 2.4]);
  sign(g, 'Fjellskyen', 5.2, -6, '#6b7c93');
  parent.add(g);
}

function forest(parent: THREE.Group, coins: THREE.Object3D[]) {
  const g = cloudGroup('skog');
  puff(g, 15, '#d9ffd0');
  const spots: [number, number][] = [
    [-6, -4], [-2, -6], [3, -5], [7, -2],
    [-8, 1], [8, 2], [-7, 5], [-3, 7],
    [2, 6], [6, 5], [-4, 2], [4, -1],
    [0, -3], [5, 3],
  ];
  spots.forEach(([x, z], i) => {
    cyl(g, '#8a5a3c', [x, 1.1, z], [0.45, 2.2, 0.45]);
    const col = RAINBOW[i % RAINBOW.length];
    sph(g, col, [x, 2.6, z], [1.7, 1.5, 1.7], undefined, 0.12);
    sph(g, RAINBOW[(i + 3) % RAINBOW.length], [x + 0.4, 3.3, z + 0.2], [1.1, 0.9, 1.1], undefined, 0.18);
  });
  for (let i = 0; i < RAIN_COIN_COUNT; i++) {
    const local = rainCoinWorld(i);
    const c = CLOUDS.find((x) => x.id === 'skog')!;
    const coin = sph(g, '#ffd23f', [local.x - c.x, 0.7, local.z - c.z], [0.7, 0.7, 0.18], undefined, 0.45);
    coin.visible = false;
    coin.name = `rain-coin-${i}`;
    coins.push(coin);
  }
  sign(g, 'Regnbueskog', 5.4, -6.5, '#7dff8a');
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
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.35), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  plate.position.set(0, 4.6, 0.15);
  g.add(plate);
  parent.add(g);
}

export function buildSky(): SkyWorld {
  const group = new THREE.Group();
  group.name = 'skyverden';
  const coins: THREE.Object3D[] = [];
  const water = badeland(group);
  eggShop(group);
  mountain(group);
  forest(group, coins);
  gate(group);
  return {
    group,
    coins,
    water,
    update(t, rain) {
      water.position.y = 0.22 + Math.sin(t * 2.2) * 0.06;
      coins.forEach((c, i) => {
        const show = rain.active && !rain.collected.includes(i);
        c.visible = show;
        if (show) c.position.y = 0.7 + Math.sin(t * 3 + i) * 0.15;
      });
    },
  };
}
