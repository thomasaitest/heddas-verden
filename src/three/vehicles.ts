/** Simple low-poly car and pram meshes for driving / pulling pets. */
import * as THREE from 'three';
import { CAR_BY_ID, PET_SHOP_BY_ID } from '../logic/catalog.ts';
import { box, cyl } from './kit.ts';

export function buildCar(carId: string): THREE.Group {
  const def = CAR_BY_ID[carId];
  const color = def?.color ?? '#ff8fb1';
  const g = new THREE.Group();
  box(g, color, [0, 0.55, 0], [2.4, 0.55, 4.2]);
  box(g, '#ffffff', [0, 1.05, -0.35], [2.1, 0.7, 2.2]);
  box(g, '#9ad8ff', [0, 1.1, 0.55], [1.9, 0.55, 0.08]);
  for (const [x, z] of [
    [-1.1, 1.3],
    [1.1, 1.3],
    [-1.1, -1.3],
    [1.1, -1.3],
  ] as const) {
    cyl(g, '#2f3550', [x, 0.35, z], [0.7, 0.28, 0.7], [0, 0, Math.PI / 2]);
  }
  g.userData.carId = carId;
  return g;
}

export function buildPram(pramId: string): THREE.Group {
  const color = pramId.includes('gull') ? '#ffd76a' : pramId.includes('blaa') ? '#5cc3f2' : '#ff8fb1';
  const g = new THREE.Group();
  box(g, color, [0, 0.85, 0], [1.3, 0.55, 1.8]);
  box(g, '#fff6fb', [0, 1.15, -0.15], [1.1, 0.15, 1.3]);
  box(g, '#6b5a7a', [0, 1.35, 1.15], [0.12, 0.12, 1.1], [0.55, 0, 0]);
  for (const [x, z] of [
    [-0.55, 0.55],
    [0.55, 0.55],
    [-0.55, -0.55],
    [0.55, -0.55],
  ] as const) {
    cyl(g, '#2f3550', [x, 0.25, z], [0.44, 0.18, 0.44], [0, 0, Math.PI / 2]);
  }
  g.userData.pramId = pramId;
  void PET_SHOP_BY_ID;
  return g;
}
