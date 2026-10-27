import * as THREE from 'three';
import { FURN_BY_ID } from '../logic/catalog.ts';
import { roomSize, type House } from '../logic/house.ts';
import { blocked, type CircleCollider, type RectCollider } from '../logic/collision.ts';
import { footprintOf } from './colliders.ts';
import { buildFurniture } from './furniture.ts';
import { box, G, mat, rbox, textTexture } from './kit.ts';

export const WALL_H = 6;

export interface Interior {
  group: THREE.Group;
  w: number;
  d: number;
  door: { x: number; z: number };
  items: Map<string, THREE.Group>;
  /** Solid furniture, rebuilt whenever the items change. */
  rects: RectCollider[];
  circles: CircleCollider[];
  build(house: House): void;
  syncItems(house: House): void;
  updateWalls(cam: THREE.Vector3): void;
  select(uid: string | null): void;
  update(t: number): void;
}

export function createInterior(): Interior {
  const group = new THREE.Group();
  const shell = new THREE.Group();
  const furn = new THREE.Group();
  group.add(shell, furn);
  const items = new Map<string, THREE.Group>();
  const itemKeys = new Map<string, string>();
  let walls: { mesh: THREE.Object3D; axis: 'x' | 'z'; at: number; sign: number }[] = [];
  const ring = new THREE.Mesh(G.torus(), new THREE.MeshBasicMaterial({ color: '#ffe14d' }));
  ring.rotation.x = Math.PI / 2;
  ring.visible = false;
  group.add(ring);
  let selected: string | null = null;

  const api: Interior = {
    group,
    w: 16,
    d: 13,
    door: { x: 0, z: 6 },
    items,
    rects: [],
    circles: [],
    build(house) {
      shell.clear();
      const { w, d } = roomSize(house.style);
      api.w = w;
      api.d = d;
      api.door = { x: 0, z: d / 2 - 1.4 };
      const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), mat(house.floorColor));
      floor.position.y = -0.2;
      floor.receiveShadow = true;
      shell.add(floor);
      // floor planks
      for (let i = 1; i < Math.floor(w / 2); i++) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, d), mat(shade(house.floorColor, -0.08)));
        line.position.set(-w / 2 + i * 2, 0.01, 0);
        shell.add(line);
      }
      const wallMat = mat(house.wallColor);
      const trim = '#ffffff';
      walls = [];
      const mk = (x: number, z: number, sx: number, sz: number, axis: 'x' | 'z', at: number, sign: number) => {
        const g = new THREE.Group();
        const m = new THREE.Mesh(G.box(), wallMat);
        m.scale.set(sx, WALL_H, sz);
        m.position.set(x, WALL_H / 2, z);
        m.receiveShadow = true;
        g.add(m);
        box(g, trim, [x, 0.25, z], [sx + 0.05, 0.5, sz + 0.05]);
        box(g, trim, [x, WALL_H, z], [sx + 0.1, 0.3, sz + 0.1]);
        shell.add(g);
        walls.push({ mesh: g, axis, at, sign });
        return g;
      };
      mk(0, -d / 2 - 0.2, w + 0.8, 0.4, 'z', -d / 2, -1);
      const left = mk(-w / 2 - 0.2, 0, 0.4, d, 'x', -w / 2, -1);
      const right = mk(w / 2 + 0.2, 0, 0.4, d, 'x', w / 2, 1);
      // front wall with a door gap
      const gap = 3.2;
      const seg = (w - gap) / 2;
      const front = mk(-gap / 2 - seg / 2, d / 2 + 0.2, seg + 0.4, 0.4, 'z', d / 2, 1);
      const fr = new THREE.Mesh(G.box(), wallMat);
      fr.scale.set(seg + 0.4, WALL_H, 0.4);
      fr.position.set(gap / 2 + seg / 2, WALL_H / 2, d / 2 + 0.2);
      front.add(fr);
      const top = new THREE.Mesh(G.box(), wallMat);
      top.scale.set(gap, WALL_H - 4.2, 0.4);
      top.position.set(0, 4.2 + (WALL_H - 4.2) / 2, d / 2 + 0.2);
      front.add(top);
      rbox(front, '#a0632f', [0, 2.1, d / 2 + 0.25], [gap - 0.2, 4.2, 0.2]);
      const exit = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), new THREE.MeshBasicMaterial({ map: textTexture('Gå ut', { bg: '#54c45e', fg: '#fff', w: 256, h: 96 }), transparent: true }));
      exit.position.set(0, 4.8, d / 2 - 0.05);
      exit.rotation.y = Math.PI;
      front.add(exit);
      const exitMat = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), new THREE.MeshBasicMaterial({ color: '#7cf08a', transparent: true, opacity: 0.6 }));
      exitMat.rotation.x = -Math.PI / 2;
      exitMat.position.set(0, 0.03, d / 2 - 1.2);
      shell.add(exitMat);
      // windows on side walls
      for (const [wall, s] of [[left, -1], [right, 1]] as const) {
        for (let i = -1; i <= 1; i += 2) {
          box(wall, '#ffffff', [s * (w / 2 - 0.02), 3.3, i * d * 0.22], [0.1, 2.2, 2.6]);
          box(wall, '#bfe9ff', [s * (w / 2 - 0.06), 3.3, i * d * 0.22], [0.06, 1.9, 2.3], undefined, 0.45);
        }
      }
      itemKeys.clear();
      furn.clear();
      items.clear();
      api.syncItems(house);
    },
    syncItems(house) {
      const seen = new Set<string>();
      for (const it of house.items) {
        seen.add(it.uid);
        const def = FURN_BY_ID[it.itemId];
        const key = `${it.itemId}|${it.color}`;
        let g = items.get(it.uid);
        if (!g || itemKeys.get(it.uid) !== key) {
          if (g) furn.remove(g);
          g = buildFurniture(def.model, it.color);
          g.userData.uid = it.uid;
          g.traverse((o) => (o.userData.uid = it.uid));
          furn.add(g);
          items.set(it.uid, g);
          itemKeys.set(it.uid, key);
        }
        g.position.set(it.x, 0, it.z);
        g.rotation.y = it.rot;
        g.scale.setScalar(it.scale);
      }
      for (const [uid, g] of items) {
        if (!seen.has(uid)) {
          furn.remove(g);
          items.delete(uid);
          itemKeys.delete(uid);
        }
      }
      api.select(selected);
      api.rects = furnitureColliders(house, items, api.door);
    },
    updateWalls(cam) {
      for (const wl of walls) {
        const v = wl.axis === 'x' ? cam.x : cam.z;
        wl.mesh.visible = (v - wl.at) * wl.sign < 0.5;
      }
    },
    select(uid) {
      selected = uid && items.has(uid) ? uid : null;
      ring.visible = !!selected;
    },
    update(t) {
      if (!selected) return;
      const g = items.get(selected)!;
      const box3 = new THREE.Box3().setFromObject(g);
      const size = Math.max(box3.max.x - box3.min.x, box3.max.z - box3.min.z);
      ring.position.set((box3.max.x + box3.min.x) / 2, 0.08 + Math.sin(t * 5) * 0.04, (box3.max.z + box3.min.z) / 2);
      ring.scale.setScalar(size * 0.6 + 0.4);
    },
  };
  return api;
}

function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return `#${c.getHexString()}`;
}

/** Soft things you can step over; everything else that stands on the floor is solid. */
const WALK_THROUGH = new Set(['ball', 'teddy', 'heart', 'gift']);
/** Floor items must be at least this tall to count as solid (rugs, mats and bowls are flat). */
const MIN_SOLID_HEIGHT = 0.4;
/** Furniture this close to the front door never blocks, so a room can't be built shut. */
const DOOR_CLEAR = 1.9;

export function furnitureColliders(house: House, items: Map<string, THREE.Group>, door: { x: number; z: number }): RectCollider[] {
  const out: RectCollider[] = [];
  for (const it of house.items) {
    const def = FURN_BY_ID[it.itemId];
    const g = items.get(it.uid);
    if (!def || !g || def.wall || def.cat === 'gulv' || WALK_THROUGH.has(def.model)) continue;
    const fp = footprintOf(g);
    if (fp.top < MIN_SOLID_HEIGHT) continue;
    const rect: RectCollider = { x: fp.x, z: fp.z, hw: fp.hw, hd: fp.hd, rot: fp.rot, h: fp.top };
    // keep the doorway open: skip anything touching the door mat
    if (blocked(door.x, door.z, DOOR_CLEAR, { rects: [rect], circles: [] })) continue;
    out.push(rect);
  }
  return out;
}
