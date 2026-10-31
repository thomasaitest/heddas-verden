/** Cute low-poly cars and prams. Each car id has a distinct body style; avatar sits inside. */
import * as THREE from 'three';
import { CAR_BY_ID, PET_SHOP_BY_ID } from '../logic/catalog.ts';
import { cyl, rbox, sph } from './kit.ts';

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

/** Avatar root Y while driving – sunk so hips sit on the bench. */
export const CAR_SEAT_Y = 0.48;
export const PRAM_PULL_BACK = 1.45;

function hexMix(a: string, b: string, t: number): string {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const A = p(a);
  const B = p(b);
  const m = (i: number) => Math.round(A[i]! + (B[i]! - A[i]!) * t).toString(16).padStart(2, '0');
  return `#${m(0)}${m(1)}${m(2)}`;
}

type CarKind = 'mini' | 'family' | 'pickup' | 'sport' | 'beetle' | 'jeep' | 'van' | 'convertible';

function carKind(carId: string): CarKind {
  if (carId.includes('rosa')) return 'convertible';
  if (carId.includes('gul')) return 'beetle';
  if (carId.includes('bla')) return 'van';
  if (carId.includes('gronn')) return 'jeep';
  if (carId.includes('lilla')) return 'sport';
  return 'family';
}

export function buildCar(carId: string): THREE.Group {
  const def = CAR_BY_ID[carId];
  const color = def?.color ?? '#ff8fb1';
  const dark = hexMix(color, '#2b2b38', 0.45);
  const light = hexMix(color, '#ffffff', 0.35);
  const kind = carKind(carId);
  const g = new THREE.Group();

  const bodyLen = kind === 'mini' || kind === 'beetle' ? 3.6 : kind === 'van' ? 5.0 : kind === 'jeep' ? 4.4 : kind === 'sport' ? 4.1 : 4.4;
  const bodyW = kind === 'van' ? 2.5 : kind === 'jeep' ? 2.45 : kind === 'beetle' ? 2.15 : 2.3;
  const cabinH = kind === 'van' ? 2.1 : kind === 'convertible' ? 0.55 : kind === 'sport' ? 1.35 : kind === 'jeep' ? 1.75 : 1.65;

  // Chassis / body – shape varies by kind
  if (kind === 'beetle') {
    // Round bubble body
    sph(g, color, [0, 0.75, 0.1], [bodyW * 1.05, 1.35, bodyLen * 0.95]);
    rbox(g, dark, [0, 0.28, 0], [bodyW * 0.9, 0.25, bodyLen * 0.85]);
  } else if (kind === 'van') {
    rbox(g, color, [0, 1.15, -0.1], [bodyW, 2.0, bodyLen * 0.92]);
    rbox(g, dark, [0, 0.28, 0], [bodyW + 0.05, 0.22, bodyLen]);
  } else {
    rbox(g, color, [0, 0.48, 0], [bodyW, kind === 'jeep' ? 0.7 : 0.55, bodyLen]);
    rbox(g, dark, [0, 0.22, 0], [bodyW + 0.08, 0.18, bodyLen - 0.15]);
  }

  // Bumper + lights
  if (kind !== 'beetle') {
    rbox(g, light, [0, 0.42, bodyLen / 2 - 0.12], [bodyW - 0.25, 0.28, 0.35]);
  }
  for (const s of [-1, 1]) {
    const hz = kind === 'beetle' ? bodyLen * 0.35 : bodyLen / 2 - 0.05;
    sph(g, '#fff4c2', [s * (bodyW / 2 - 0.45), kind === 'beetle' ? 0.7 : 0.55, hz], [0.38, 0.38, 0.22], undefined, 0.55);
    rbox(g, '#ff4b4b', [s * (bodyW / 2 - 0.5), kind === 'beetle' ? 0.7 : 0.55, -bodyLen / 2 + 0.08], [0.4, 0.22, 0.12], undefined, 0.4);
  }

  const cabinZ = kind === 'sport' ? -0.15 : kind === 'jeep' || kind === 'pickup' ? 0.35 : kind === 'van' ? 0.55 : 0.05;
  const cabinLen = kind === 'van' ? 1.7 : kind === 'sport' ? 2.0 : kind === 'convertible' ? 2.1 : 2.2;
  const cabinBase = kind === 'beetle' ? 0.95 : kind === 'van' ? 0.9 : 0.78;
  const roofY = cabinBase + cabinH;

  if (kind !== 'convertible' && kind !== 'beetle') {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const pz = cabinZ + sz * (cabinLen / 2 - 0.12);
        rbox(g, color, [sx * (bodyW / 2 - 0.22), cabinBase + cabinH / 2, pz], [0.22, cabinH, 0.28]);
      }
    }
    for (const s of [-1, 1]) {
      rbox(g, color, [s * (bodyW / 2 - 0.14), cabinBase + 0.12, cabinZ], [0.18, 0.28, cabinLen - 0.35]);
    }
    rbox(g, light, [0, roofY + 0.06, cabinZ - (kind === 'sport' ? 0.1 : 0)], [bodyW - 0.35, 0.2, cabinLen - 0.25]);
    glassPanel(g, [0, cabinBase + cabinH * 0.52, cabinZ + cabinLen / 2 - 0.04], [bodyW - 0.55, cabinH * 0.85, 0.06], [-0.28, 0, 0]);
    glassPanel(g, [0, cabinBase + cabinH * 0.48, cabinZ - cabinLen / 2 + 0.06], [bodyW - 0.55, cabinH * 0.75, 0.06], [0.18, 0, 0]);
    for (const s of [-1, 1] as const) {
      glassPanel(g, [s * (bodyW / 2 - 0.1), cabinBase + cabinH * 0.5, cabinZ], [0.06, cabinH * 0.8, cabinLen - 0.55]);
    }
  } else if (kind === 'convertible') {
    // Truly open top: low windshield frame only (no glass cabin), roll hoop
    rbox(g, light, [0, 1.05, cabinZ + 0.85], [bodyW - 0.7, 0.08, 0.08], [-0.4, 0, 0]);
    for (const s of [-1, 1]) {
      rbox(g, light, [s * (bodyW / 2 - 0.45), 0.95, cabinZ + 0.55], [0.08, 0.7, 0.08], [-0.25, 0, 0]);
    }
    for (const s of [-1, 1]) {
      cyl(g, dark, [s * (bodyW / 2 - 0.4), 1.15, cabinZ - 0.55], [0.1, 0.85, 0.1]);
    }
    rbox(g, dark, [0, 1.55, cabinZ - 0.55], [bodyW - 0.55, 0.08, 0.1]);
  } else {
    // beetle windows carved as flat glass on the bubble
    glassPanel(g, [0, 1.15, 1.2], [bodyW * 0.55, 0.7, 0.08], [-0.4, 0, 0]);
    glassPanel(g, [0, 1.1, -1.1], [bodyW * 0.5, 0.55, 0.08], [0.35, 0, 0]);
  }

  // Interior seat
  const seatZ = kind === 'van' ? 0.7 : cabinZ + 0.1;
  rbox(g, '#6b5a7a', [0, kind === 'beetle' ? 0.85 : 0.7, seatZ], [bodyW - 0.75, 0.2, 0.75]);
  rbox(g, '#5a4a68', [0, kind === 'beetle' ? 1.1 : 0.95, seatZ - 0.28], [bodyW - 0.9, 0.55, 0.18]);
  cyl(g, '#2b2b38', [0.32, kind === 'beetle' ? 1.15 : 1.0, seatZ + 0.45], [0.5, 0.07, 0.5], [Math.PI / 2, 0, 0]);

  if (kind !== 'beetle') {
    rbox(g, '#2b2b38', [0, 0.48, bodyLen / 2 - 0.02], [bodyW * 0.45, 0.28, 0.1]);
  }

  // Wheels
  const wheelZ = bodyLen * (kind === 'van' ? 0.28 : 0.32);
  const wheelY = kind === 'jeep' ? 0.48 : 0.38;
  const wheelR = kind === 'jeep' ? 1.05 : kind === 'beetle' ? 0.75 : 0.85;
  for (const [wx, wz] of [
    [-bodyW / 2 + 0.15, wheelZ],
    [bodyW / 2 - 0.15, wheelZ],
    [-bodyW / 2 + 0.15, -wheelZ],
    [bodyW / 2 - 0.15, -wheelZ],
  ] as const) {
    cyl(g, '#2b2b38', [wx, wheelY, wz], [wheelR, 0.32, wheelR], [0, 0, Math.PI / 2]);
    cyl(g, '#ffffff', [wx, wheelY, wz], [wheelR * 0.45, 0.34, wheelR * 0.45], [0, 0, Math.PI / 2]);
  }

  if (kind === 'jeep') {
    // spare tire on back + snorkel / light bar
    cyl(g, '#2b2b38', [0, 1.1, -bodyLen / 2 + 0.15], [0.9, 0.25, 0.9]);
    rbox(g, dark, [0, 1.85, cabinZ + 0.2], [bodyW - 0.5, 0.12, 0.35]);
    for (const s of [-1, 1]) sph(g, '#fff4c2', [s * 0.4, 1.95, cabinZ + 0.2], [0.22, 0.22, 0.22], undefined, 0.6);
  }
  if (kind === 'sport') {
    rbox(g, dark, [0, 1.35 + cabinH * 0.35, -bodyLen / 2 + 0.4], [bodyW - 0.4, 0.12, 0.35]);
  }
  if (kind === 'van') {
    // side stripe
    rbox(g, light, [0, 1.3, 0], [bodyW + 0.02, 0.2, bodyLen * 0.7]);
  }

  g.userData.carId = carId;
  g.userData.seatY = CAR_SEAT_Y;
  g.userData.carKind = kind;
  return g;
}

export function buildPram(pramId: string): THREE.Group {
  const color = pramId.includes('gull') ? '#ffd76a' : pramId.includes('blaa') ? '#5cc3f2' : '#ff8fb1';
  const g = new THREE.Group();
  rbox(g, color, [0, 0.85, 0], [1.35, 0.6, 1.85]);
  rbox(g, '#fff6fb', [0, 1.2, -0.1], [1.15, 0.18, 1.35]);
  rbox(g, color, [0, 1.55, -0.55], [1.25, 0.55, 0.7], [0.5, 0, 0]);
  for (const [x, z] of [
    [-0.45, 0.55],
    [0.45, 0.55],
    [-0.45, -0.55],
    [0.45, -0.55],
  ] as const) {
    cyl(g, '#2b2b38', [x, 0.28, z], [0.45, 0.18, 0.45], [0, 0, Math.PI / 2]);
  }
  // handle
  cyl(g, '#8a5a3c', [0, 1.55, 0.95], [0.12, 0.9, 0.12], [0.7, 0, 0]);
  void PET_SHOP_BY_ID;
  g.userData.pramId = pramId;
  return g;
}
