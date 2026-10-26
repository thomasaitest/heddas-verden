import * as THREE from 'three';
import type { Avatar } from '../logic/avatar.ts';
import { box, cone, cyl, G, part, rbox, sph } from './kit.ts';

export interface AvatarRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  arms: THREE.Object3D[];
  legs: THREE.Object3D[];
  extra: THREE.Object3D[];
}

const texCache = new Map<string, THREE.CanvasTexture>();
function canvasTex(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

function faceTexture(face: Avatar['face']): THREE.CanvasTexture {
  return canvasTex(`face-${face}`, 256, 256, (ctx) => {
    const ink = '#2b2340';
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.lineCap = 'round';
    ctx.lineWidth = 12;
    const eye = (x: number, y: number) => {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.ellipse(x, y, 16, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + 5, y - 8, 6, 0, Math.PI * 2);
      ctx.fill();
    };
    const blush = () => {
      ctx.fillStyle = 'rgba(255,120,150,0.5)';
      for (const x of [62, 194]) {
        ctx.beginPath();
        ctx.ellipse(x, 150, 22, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const smile = (w = 40, y = 160) => {
      ctx.beginPath();
      ctx.arc(128, y - w * 0.6, w, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    };
    switch (face) {
      case 'smil':
        eye(90, 112);
        eye(166, 112);
        smile();
        break;
      case 'glad':
        ctx.beginPath();
        ctx.arc(90, 118, 18, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(166, 118, 18, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(128, 150, 34, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#ff6f8f';
        ctx.beginPath();
        ctx.arc(128, 168, 16, 0, Math.PI);
        ctx.fill();
        blush();
        break;
      case 'blunk':
        eye(90, 112);
        ctx.beginPath();
        ctx.moveTo(146, 112);
        ctx.lineTo(186, 112);
        ctx.stroke();
        smile();
        break;
      case 'katt':
        eye(90, 112);
        eye(166, 112);
        ctx.beginPath();
        ctx.arc(112, 150, 16, 0, Math.PI);
        ctx.arc(144, 150, 16, 0, Math.PI);
        ctx.stroke();
        blush();
        break;
      case 'rodme':
        eye(90, 115);
        eye(166, 115);
        blush();
        smile(26, 165);
        break;
      case 'kul':
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.roundRect(52, 92, 66, 40, 14);
        ctx.roundRect(138, 92, 66, 40, 14);
        ctx.fill();
        ctx.fillRect(110, 100, 36, 10);
        ctx.beginPath();
        ctx.moveTo(100, 168);
        ctx.quadraticCurveTo(140, 180, 162, 156);
        ctx.stroke();
        break;
      case 'wow':
        eye(90, 108);
        eye(166, 108);
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.ellipse(128, 165, 16, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'tunge':
        ctx.beginPath();
        ctx.moveTo(72, 104);
        ctx.lineTo(104, 116);
        ctx.lineTo(72, 128);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(184, 104);
        ctx.lineTo(152, 116);
        ctx.lineTo(184, 128);
        ctx.stroke();
        smile(36, 158);
        ctx.fillStyle = '#ff6f8f';
        ctx.beginPath();
        ctx.ellipse(140, 168, 14, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
  });
}

function printTexture(print: Avatar['print']): THREE.CanvasTexture | null {
  if (print === 'ingen') return null;
  return canvasTex(`print-${print}`, 128, 128, (ctx) => {
    ctx.fillStyle = '#ffffff';
    if (print === 'striper') {
      ctx.globalAlpha = 0.55;
      for (let y = 8; y < 128; y += 32) ctx.fillRect(0, y, 128, 14);
      return;
    }
    if (print === 'hjerte') {
      ctx.fillStyle = '#ff4f7f';
      ctx.beginPath();
      ctx.moveTo(64, 100);
      ctx.bezierCurveTo(10, 60, 30, 18, 64, 44);
      ctx.bezierCurveTo(98, 18, 118, 60, 64, 100);
      ctx.fill();
      return;
    }
    if (print === 'stjerne') {
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 18 : 42;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(64 + Math.cos(a) * r, 66 + Math.sin(a) * r);
      }
      ctx.fill();
      return;
    }
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(64, 78, 24, 20, 0, 0, Math.PI * 2);
    for (const [x, y] of [[36, 46], [54, 34], [74, 34], [92, 46]]) {
      ctx.moveTo(x + 10, y);
      ctx.ellipse(x, y, 10, 13, 0, 0, Math.PI * 2);
    }
    ctx.fill();
  });
}

function decal(parent: THREE.Object3D, tex: THREE.Texture, pos: [number, number, number], w: number, h: number) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, transparent: true }));
  m.position.set(...pos);
  parent.add(m);
  return m;
}

function hair(head: THREE.Group, a: Avatar) {
  const c = a.hairColor;
  if (a.hair === 'ingen') return;
  // cap of hair on top and back
  rbox(head, c, [0, 0.3, -0.04], [0.8, 0.2, 0.8]);
  rbox(head, c, [0, 0.1, -0.33], [0.8, 0.5, 0.16]);
  switch (a.hair) {
    case 'kort':
      rbox(head, c, [0, 0.27, 0.28], [0.8, 0.14, 0.22]);
      break;
    case 'lang':
      rbox(head, c, [0, -0.15, -0.34], [0.82, 0.9, 0.18]);
      for (const s of [-1, 1]) rbox(head, c, [s * 0.38, -0.05, 0.02], [0.1, 0.7, 0.6]);
      rbox(head, c, [0, 0.27, 0.3], [0.8, 0.14, 0.2]);
      break;
    case 'hestehale':
      rbox(head, c, [0, 0.27, 0.3], [0.8, 0.14, 0.2]);
      sph(head, c, [0, 0.15, -0.5], [0.3, 0.3, 0.3]);
      sph(head, c, [0, -0.15, -0.55], [0.24, 0.5, 0.24]);
      sph(head, '#ff6f8f', [0, 0.2, -0.43], [0.16, 0.16, 0.1]);
      break;
    case 'fletter':
      rbox(head, c, [0, 0.27, 0.3], [0.8, 0.14, 0.2]);
      for (const s of [-1, 1]) {
        sph(head, c, [s * 0.45, 0.05, -0.1], [0.26, 0.26, 0.26]);
        sph(head, c, [s * 0.48, -0.25, -0.1], [0.2, 0.42, 0.2]);
      }
      break;
    case 'bob':
      for (const s of [-1, 1]) rbox(head, c, [s * 0.39, -0.02, 0.02], [0.12, 0.55, 0.7]);
      rbox(head, c, [0, 0.25, 0.3], [0.82, 0.2, 0.2]);
      break;
    case 'krus':
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2;
        sph(head, c, [Math.cos(ang) * 0.36, 0.32 + Math.sin(i) * 0.05, Math.sin(ang) * 0.36 - 0.05], [0.32, 0.32, 0.32]);
      }
      sph(head, c, [0, 0.45, 0], [0.5, 0.3, 0.5]);
      break;
    case 'piggete':
      for (let i = 0; i < 6; i++) cone(head, c, [-0.28 + i * 0.11, 0.45, 0.1 - (i % 2) * 0.2], [0.18, 0.34, 0.18], [-0.3, 0, (i - 2.5) * 0.15]);
      break;
  }
}

function hat(head: THREE.Group, a: Avatar) {
  switch (a.hat) {
    case 'caps':
      cyl(head, '#ff6f6f', [0, 0.42, 0], [0.82, 0.22, 0.82]);
      box(head, '#ff6f6f', [0, 0.33, 0.5], [0.6, 0.05, 0.4]);
      break;
    case 'krone':
      cyl(head, '#ffd23f', [0, 0.5, 0], [0.62, 0.18, 0.62], undefined, 0.15);
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        cone(head, '#ffd23f', [Math.cos(ang) * 0.26, 0.68, Math.sin(ang) * 0.26], [0.14, 0.22, 0.14], undefined, 0.15);
      }
      sph(head, '#ff4f7f', [0, 0.52, 0.31], [0.1, 0.1, 0.06]);
      break;
    case 'lue':
      sph(head, '#5cc3f2', [0, 0.38, 0], [0.86, 0.6, 0.86]);
      cyl(head, '#ffffff', [0, 0.28, 0], [0.88, 0.14, 0.88]);
      sph(head, '#ffffff', [0, 0.72, 0], [0.22, 0.22, 0.22]);
      break;
    case 'katteorer':
      for (const s of [-1, 1]) {
        cone(head, a.hairColor, [s * 0.26, 0.55, 0], [0.24, 0.3, 0.12], [0, 0, s * -0.2]);
        cone(head, '#ffb3c7', [s * 0.26, 0.53, 0.04], [0.12, 0.18, 0.05], [0, 0, s * -0.2]);
      }
      break;
    case 'kaninorer':
      for (const s of [-1, 1]) {
        sph(head, '#ffffff', [s * 0.18, 0.75, 0], [0.18, 0.62, 0.1], [0, 0, s * -0.12]);
        sph(head, '#ffb3c7', [s * 0.18, 0.75, 0.04], [0.09, 0.45, 0.05], [0, 0, s * -0.12]);
      }
      break;
    case 'cowboy':
      cyl(head, '#a0632f', [0, 0.38, 0], [1.3, 0.05, 1.3]);
      cyl(head, '#a0632f', [0, 0.55, 0], [0.7, 0.34, 0.7]);
      cyl(head, '#5b3a29', [0, 0.43, 0], [0.72, 0.07, 0.72]);
      break;
    case 'blomster':
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        sph(head, ['#ff8fb1', '#ffe066', '#c88bff', '#ffffff'][i % 4], [Math.cos(ang) * 0.42, 0.38, Math.sin(ang) * 0.42], [0.16, 0.16, 0.16]);
      }
      break;
    case 'trollmann':
      cyl(head, '#6a4cff', [0, 0.38, 0], [1.1, 0.05, 1.1]);
      cone(head, '#6a4cff', [0, 0.8, 0], [0.7, 0.85, 0.7], [0.12, 0, 0]);
      part(head, G.star(), '#ffe066', [0.12, 0.75, 0.3], [0.18, 0.18, 0.18], [0, 0, 0], 0.3);
      break;
  }
}

function accessory(body: THREE.Group, head: THREE.Group, a: Avatar) {
  switch (a.accessory) {
    case 'briller':
      for (const s of [-1, 1]) part(head, G.torus(), '#2b2340', [s * 0.15, 0.06, 0.37], [0.22, 0.22, 0.22]);
      box(head, '#2b2340', [0, 0.06, 0.37], [0.1, 0.03, 0.03]);
      break;
    case 'vinger':
      for (const s of [-1, 1]) {
        sph(body, '#e9d2ff', [s * 0.35, 1.55, -0.35], [0.55, 0.7, 0.06], [0.2, s * 0.4, s * 0.5], 0.1);
        sph(body, '#ffd2ec', [s * 0.3, 1.15, -0.33], [0.35, 0.45, 0.05], [0.2, s * 0.4, s * -0.4], 0.1);
      }
      break;
    case 'sekk':
      rbox(body, '#ff8fb1', [0, 1.35, -0.38], [0.7, 0.75, 0.3]);
      rbox(body, '#ffb3c7', [0, 1.2, -0.55], [0.5, 0.3, 0.1]);
      break;
    case 'skjerf':
      cyl(body, '#ff6f6f', [0, 1.83, 0], [0.8, 0.16, 0.6]);
      box(body, '#ff6f6f', [0.25, 1.55, 0.28], [0.18, 0.5, 0.06]);
      break;
    case 'kappe':
      box(body, '#c0304f', [0, 1.1, -0.3], [1.0, 1.4, 0.05], [0.1, 0, 0]);
      break;
    case 'glorie':
      part(head, G.torus(), '#ffe066', [0, 0.7, 0], [0.55, 0.55, 0.55], [Math.PI / 2, 0, 0], 0.6);
      break;
  }
}

export function buildAvatar(a: Avatar): AvatarRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const legs = [-1, 1].map((s) => {
    const pivot = new THREE.Object3D();
    pivot.position.set(s * 0.24, 0.9, 0);
    body.add(pivot);
    box(pivot, a.pants, [0, -0.38, 0], [0.46, 0.76, 0.48]);
    rbox(pivot, a.shoes, [0, -0.82, 0.04], [0.48, 0.18, 0.56]);
    return pivot;
  });
  box(body, a.pants, [0, 0.98, 0], [0.96, 0.18, 0.5]);
  rbox(body, a.shirt, [0, 1.42, 0], [0.98, 0.8, 0.5]);
  const pt = printTexture(a.print);
  if (pt) decal(body, pt, [0, 1.42, 0.252], a.print === 'striper' ? 0.96 : 0.55, a.print === 'striper' ? 0.78 : 0.55);
  const arms = [-1, 1].map((s) => {
    const pivot = new THREE.Object3D();
    pivot.position.set(s * 0.72, 1.76, 0);
    body.add(pivot);
    rbox(pivot, a.shirt, [0, -0.2, 0], [0.44, 0.42, 0.46]);
    rbox(pivot, a.skin, [0, -0.6, 0], [0.4, 0.5, 0.42]);
    return pivot;
  });
  const head = new THREE.Group();
  head.position.set(0, 2.2, 0);
  body.add(head);
  part(head, G.rbox(0.22), a.skin, [0, 0, 0], [0.74, 0.74, 0.72]);
  box(body, a.skin, [0, 1.86, 0], [0.32, 0.12, 0.3]);
  decal(head, faceTexture(a.face), [0, -0.02, 0.362], 0.72, 0.72);
  hair(head, a);
  hat(head, a);
  accessory(body, head, a);
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return { root, body, head, arms, legs, extra: [] };
}

export type AvatarPose = 'idle' | 'walk' | 'jump' | 'sit' | 'hold' | 'wave' | 'fly';

export function animateAvatar(rig: AvatarRig, t: number, pose: AvatarPose, speed = 0, holding = false): void {
  const s = pose === 'walk' ? Math.sin(t * 11) * 0.8 * Math.min(1, speed) : 0;
  const [l, r] = rig.legs;
  const [la, ra] = rig.arms;
  rig.body.position.y = pose === 'walk' ? Math.abs(Math.sin(t * 11)) * 0.06 : pose === 'idle' ? Math.sin(t * 2) * 0.012 : 0;
  rig.head.rotation.set(pose === 'idle' ? Math.sin(t * 0.8) * 0.04 : 0, pose === 'idle' ? Math.sin(t * 0.5) * 0.2 : 0, 0);
  l.rotation.set(s, 0, 0);
  r.rotation.set(-s, 0, 0);
  la.rotation.set(-s, 0, 0);
  ra.rotation.set(s, 0, 0);
  if (pose === 'jump') {
    l.rotation.x = 0.4;
    r.rotation.x = -0.3;
    la.rotation.set(0, 0, -2.6);
    ra.rotation.set(0, 0, 2.6);
  } else if (pose === 'sit' || pose === 'fly') {
    l.rotation.set(-1.5, 0, 0.35);
    r.rotation.set(-1.5, 0, -0.35);
    la.rotation.set(-0.9, 0, pose === 'fly' ? -0.6 : 0);
    ra.rotation.set(-0.9, 0, pose === 'fly' ? 0.6 : 0);
    rig.body.position.y = 0;
  } else if (pose === 'wave') {
    ra.rotation.set(0, 0, 2.6 + Math.sin(t * 10) * 0.35);
  }
  if (holding) {
    la.rotation.set(-1.3, 0, 0.25);
    ra.rotation.set(-1.3, 0, -0.25);
  }
}
