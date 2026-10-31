/** Cute low-poly cars and prams. Avatar sits inside the cabin (seatY). */
import * as THREE from 'three';
import { CAR_BY_ID, PET_SHOP_BY_ID } from '../logic/catalog.ts';
import { box, cyl, rbox, sph } from './kit.ts';

/** Transparent window pane (Lambert materials in kit are opaque). */
function glassPanel(
  parent: THREE.Object3D,
  pos: [number, number, number],
  scale: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
): void {
  const mat = new THREE.MeshLambertMaterial({
    color: '#8ec8e8',
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
  m.position.set(...pos);
  m.scale.set(...scale);
  m.rotation.set(...rot);
  parent.add(m);
}

/** How high the avatar root should sit when driving (feet near the floor of the cabin). */
/** Avatar root Y while driving – sunk so hips sit on the bench and only chest/head fill the windows. */
export const CAR_SEAT_Y = 0.48;
export const PRAM_PULL_BACK = 1.45;

function hexMix(a: string, b: string, t: number): string {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const A = p(a);
  const B = p(b);
  const m = (i: number) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0');
  return `#${m(0)}${m(1)}${m(2)}`;
}

/** Per-car silhouette tweaks so the shop variants feel distinct. */
function carShape(carId: string): { bodyLen: number; bodyW: number; cabinH: number; sporty: boolean; pickup: boolean } {
  // Tall bubble cabins so a seated kid avatar fits with head under the roof.
  if (carId.includes('lilla')) return { bodyLen: 4.0, bodyW: 2.2, cabinH: 1.55, sporty: true, pickup: false };
  if (carId.includes('gronn')) return { bodyLen: 4.5, bodyW: 2.3, cabinH: 1.7, sporty: false, pickup: true };
  if (carId.includes('bla')) return { bodyLen: 4.6, bodyW: 2.4, cabinH: 1.85, sporty: false, pickup: false };
  return { bodyLen: 4.3, bodyW: 2.3, cabinH: 1.7, sporty: false, pickup: false };
}

export function buildCar(carId: string): THREE.Group {
  const def = CAR_BY_ID[carId];
  const color = def?.color ?? '#ff8fb1';
  const dark = hexMix(color, '#2b2b38', 0.45);
  const light = hexMix(color, '#ffffff', 0.35);
  const { bodyLen, bodyW, cabinH, sporty, pickup } = carShape(carId);
  const g = new THREE.Group();

  // rounded chassis
  rbox(g, color, [0, 0.48, 0], [bodyW, 0.55, bodyLen]);
  // lower skirt
  rbox(g, dark, [0, 0.22, 0], [bodyW + 0.08, 0.18, bodyLen - 0.15]);
  // front bumper + headlights
  rbox(g, light, [0, 0.42, bodyLen / 2 - 0.12], [bodyW - 0.25, 0.28, 0.35]);
  for (const s of [-1, 1]) {
    sph(g, '#fff4c2', [s * (bodyW / 2 - 0.45), 0.55, bodyLen / 2 - 0.05], [0.38, 0.38, 0.22], undefined, 0.55);
    sph(g, '#ffffff', [s * (bodyW / 2 - 0.45), 0.55, bodyLen / 2 + 0.05], [0.22, 0.22, 0.1], undefined, 0.7);
  }
  // rear lights
  for (const s of [-1, 1]) {
    rbox(g, '#ff4b4b', [s * (bodyW / 2 - 0.5), 0.55, -bodyLen / 2 + 0.08], [0.4, 0.22, 0.12], undefined, 0.4);
  }

  // Hollow cabin: pillars + roof only (so the seated avatar shows through the glass)
  const cabinZ = sporty ? -0.15 : pickup ? 0.35 : 0.05;
  const cabinLen = sporty ? 2.0 : pickup ? 1.9 : 2.35;
  const cabinBase = 0.78;
  const roofY = cabinBase + cabinH;
  // A-pillars / B-pillars (four corners)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pz = cabinZ + sz * (cabinLen / 2 - 0.12);
      rbox(g, color, [sx * (bodyW / 2 - 0.22), cabinBase + cabinH / 2, pz], [0.22, cabinH, 0.28]);
    }
  }
  // side sills under the windows
  for (const s of [-1, 1]) {
    rbox(g, color, [s * (bodyW / 2 - 0.14), cabinBase + 0.12, cabinZ], [0.18, 0.28, cabinLen - 0.35]);
  }
  // roof (rounded bubble)
  rbox(g, light, [0, roofY + 0.06, cabinZ - (sporty ? 0.1 : 0)], [bodyW - 0.35, 0.2, cabinLen - 0.25]);
  rbox(g, color, [0, roofY - 0.02, cabinZ], [bodyW - 0.5, 0.12, cabinLen - 0.45]);

  // windshield + rear + side glass (real transparency so avatar shows through)
  glassPanel(g, [0, cabinBase + cabinH * 0.52, cabinZ + cabinLen / 2 - 0.04], [bodyW - 0.55, cabinH * 0.85, 0.06], [-0.28, 0, 0]);
  glassPanel(g, [0, cabinBase + cabinH * 0.48, cabinZ - cabinLen / 2 + 0.06], [bodyW - 0.55, cabinH * 0.75, 0.06], [0.18, 0, 0]);
  for (const s of [-1, 1] as const) {
    glassPanel(g, [s * (bodyW / 2 - 0.1), cabinBase + cabinH * 0.5, cabinZ], [0.06, cabinH * 0.8, cabinLen - 0.55]);
  }

  // interior: seat bench + steering wheel (avatar sits here)
  rbox(g, '#6b5a7a', [0, 0.7, cabinZ + 0.1], [bodyW - 0.75, 0.2, 0.75]);
  rbox(g, '#5a4a68', [0, 0.95, cabinZ - 0.18], [bodyW - 0.9, 0.55, 0.18]); // backrest
  // steering wheel
  cyl(g, '#2b2b38', [0.32, 1.0, cabinZ + 0.55], [0.5, 0.07, 0.5], [Math.PI / 2, 0, 0]);
  box(g, '#2b2b38', [0.32, 0.82, cabinZ + 0.38], [0.07, 0.32, 0.07]);

  // grille
  rbox(g, '#2b2b38', [0, 0.48, bodyLen / 2 - 0.02], [bodyW * 0.45, 0.28, 0.1]);

  // wheels + cute hubcaps
  const wheelZ = bodyLen * 0.32;
  for (const [wx, wz] of [
    [-bodyW / 2 + 0.15, wheelZ],
    [bodyW / 2 - 0.15, wheelZ],
    [-bodyW / 2 + 0.15, -wheelZ],
    [bodyW / 2 - 0.15, -wheelZ],
  ] as const) {
    cyl(g, '#2b2b38', [wx, 0.38, wz], [0.85, 0.32, 0.85], [0, 0, Math.PI / 2]);
    cyl(g, '#ffffff', [wx, 0.38, wz], [0.4, 0.34, 0.4], [0, 0, Math.PI / 2]);
  }

  if (pickup) {
    // open bed at the back
    rbox(g, dark, [0, 0.85, -bodyLen / 2 + 0.7], [bodyW - 0.3, 0.45, 1.4]);
  }
  if (sporty) {
    // spoiler
    rbox(g, dark, [0, 1.35 + cabinH * 0.5, -bodyLen / 2 + 0.4], [bodyW - 0.4, 0.12, 0.35]);
  }

  g.userData.carId = carId;
  g.userData.seatY = CAR_SEAT_Y;
  return g;
}

export function buildPram(pramId: string): THREE.Group {
  const color = pramId.includes('gull') ? '#ffd76a' : pramId.includes('blaa') ? '#5cc3f2' : '#ff8fb1';
  const g = new THREE.Group();
  rbox(g, color, [0, 0.85, 0], [1.35, 0.6, 1.85]);
  rbox(g, '#fff6fb', [0, 1.2, -0.1], [1.15, 0.18, 1.35]);
  // canopy
  rbox(g, color, [0, 1.45, -0.35], [1.2, 0.35, 0.9], [-0.4, 0, 0]);
  box(g, '#6b5a7a', [0, 1.4, 1.15], [0.12, 0.12, 1.15], [0.55, 0, 0]);
  for (const [x, z] of [
    [-0.55, 0.55],
    [0.55, 0.55],
    [-0.55, -0.55],
    [0.55, -0.55],
  ] as const) {
    cyl(g, '#2f3550', [x, 0.28, z], [0.48, 0.2, 0.48], [0, 0, Math.PI / 2]);
    cyl(g, '#ffffff', [x, 0.28, z], [0.22, 0.22, 0.22], [0, 0, Math.PI / 2]);
  }
  g.userData.pramId = pramId;
  void PET_SHOP_BY_ID;
  return g;
}
