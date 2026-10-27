import { describe, expect, it } from 'vitest';
import { HOUSES, type HouseStyle } from './catalog.ts';
import { blocked, movePlayer } from './collision.ts';
import { moveItem, newHouse, placeItem, updateItem } from './house.ts';
import { FLOOR_H, ROOM, roomDoorZ, floorColliders, floorOfY, groundHeight, houseLayout, itemBlocked, itemRadius, moveInLayout, onStairs, placeInLayout, roomAt } from './layout.ts';

const R = 0.45;
const styles = HOUSES.map((h) => h.style);

type Walker = { x: number; y: number; z: number };
/** Walk like the game does: floor colliders for the floor you are on, and the ground follows the ramp. */
function walk(style: HouseStyle, p: Walker, dx: number, dz: number): void {
  const L = houseLayout(style);
  const steps = Math.ceil(Math.hypot(dx, dz) / 0.1);
  for (let i = 0; i < steps; i++) {
    movePlayer(p, dx / steps, dz / steps, R, floorColliders(L, floorOfY(p.y)), undefined, 0.1);
    p.y = groundHeight(L, p.x, p.z, floorOfY(p.y));
  }
}
function walkTo(style: HouseStyle, p: Walker, x: number, z: number): void {
  for (let i = 0; i < 60; i++) {
    const dx = x - p.x;
    const dz = z - p.z;
    if (Math.hypot(dx, dz) < 0.05) return;
    walk(style, p, Math.max(-1, Math.min(1, dx)), Math.max(-1, Math.min(1, dz)));
  }
}

describe.each(styles)('house layout (%s)', (style) => {
  const L = houseLayout(style);
  const s = L.stairs;

  it('is big, has two floors with several rooms each, and the stairs sit inside the house', () => {
    const base = HOUSES.find((h) => h.style === style)!;
    expect(L.w).toBeGreaterThanOrEqual(22);
    expect(L.d).toBeGreaterThanOrEqual(18);
    expect(base.w).toBe(L.w);
    expect(L.rooms.filter((r) => r.floor === 0).length).toBeGreaterThanOrEqual(3);
    expect(L.rooms.filter((r) => r.floor === 1).length).toBeGreaterThanOrEqual(4);
    expect(L.walls.length).toBe(2);
    expect(s.x0).toBeGreaterThan(-L.w / 2);
    expect(s.zTop).toBeGreaterThan(-L.d / 2 + 2.5); // room to step off at the top
    expect(s.zBottom).toBeLessThan(L.d / 2 - 2.5); // and at the bottom
    expect(L.door.z).toBeLessThan(L.d / 2);
  });

  it('every room is reachable on foot on its floor (door gaps are wide enough)', () => {
    const cell = 0.4;
    for (const floor of [0, 1]) {
      const col = floorColliders(L, floor);
      const nx = Math.round((L.w - 1.6) / cell);
      const nz = Math.round((L.d - 1.6) / cell);
      const px = (i: number) => -L.w / 2 + 0.8 + i * cell;
      const pz = (j: number) => -L.d / 2 + 0.8 + j * cell;
      const open = (i: number, j: number) => !blocked(px(i), pz(j), R, col) && !(floor === 1 && onStairs(s, px(i), pz(j)));
      const seen = new Set<number>();
      // start: just inside the front door downstairs, the top of the stairs upstairs
      const start = floor === 0 ? [Math.round((0 - px(0)) / cell), nz - 3] : [Math.round((0 - px(0)) / cell), Math.round((s.zTop - 1.5 - pz(0)) / cell)];
      const stack = [start[1] * nx + start[0]];
      seen.add(stack[0]);
      expect(open(start[0], start[1])).toBe(true);
      while (stack.length) {
        const k = stack.pop()!;
        const i = k % nx;
        const j = (k / nx) | 0;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = i + a;
          const jj = j + b;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
          const kk = jj * nx + ii;
          if (!seen.has(kk) && open(ii, jj)) {
            seen.add(kk);
            stack.push(kk);
          }
        }
      }
      for (const r of L.rooms.filter((q) => q.floor === floor)) {
        // some free spot in the room (the middle of the upstairs hall is the stair hole) must be reachable
        let free = 0;
        let reach = 0;
        for (let jj = 0; jj < nz; jj++) for (let ii = 0; ii < nx; ii++) {
          if (px(ii) < r.x0 + 0.5 || px(ii) > r.x1 - 0.5 || pz(jj) < r.z0 + 0.5 || pz(jj) > r.z1 - 0.5 || !open(ii, jj)) continue;
          free++;
          if (seen.has(jj * nx + ii)) reach++;
        }
        expect(free, `${r.name} has room to stand`).toBeGreaterThan(10);
        expect(reach, `${r.name} (floor ${floor}) reachable`).toBe(free);
      }
    }
  });

  it('you can walk up the stairs to the upper floor and down again; the ground follows the ramp', () => {
    const p: Walker = { x: 0, y: 0, z: s.zBottom + 2 };
    walkTo(style, p, 0, s.zBottom - 0.5);
    expect(p.y).toBeGreaterThan(0.2); // started climbing
    expect(p.y).toBeLessThan(FLOOR_H / 2);
    walkTo(style, p, 0, s.zTop - 2);
    expect(p.y).toBeCloseTo(FLOOR_H, 1);
    expect(floorOfY(p.y)).toBe(1);
    // keep going: stays on the upper floor
    walkTo(style, p, 0, s.zTop - 2.2);
    expect(p.y).toBeCloseTo(FLOOR_H, 1);
    // and back down
    walkTo(style, p, 0, s.zBottom + 2);
    expect(p.y).toBeCloseTo(0, 1);
    expect(floorOfY(p.y)).toBe(0);
  });

  it('the ramp is a smooth, walkable slope', () => {
    let prev = groundHeight(L, 0, s.zBottom + 0.01, 0);
    for (let z = s.zBottom; z >= s.zTop; z -= 0.1) {
      const y = groundHeight(L, 0, z, 0);
      expect(y - prev).toBeGreaterThanOrEqual(-1e-9);
      expect(y - prev).toBeLessThan(0.1);
      prev = y;
    }
    expect(groundHeight(L, 0, s.zTop + 0.001, 0)).toBeCloseTo(FLOOR_H, 1);
    expect(groundHeight(L, 5, 5, 0)).toBe(0);
    expect(groundHeight(L, 5, 5, 1)).toBe(FLOOR_H);
  });

  it('the stairs cannot be entered from the side, the cap blocks the top from below, and you cannot fall in the hole from the front', () => {
    const mid = (s.zTop + s.zBottom) / 2;
    const side: Walker = { x: s.x0 - 2, y: 0, z: mid };
    walk(style, side, 6, 0);
    expect(side.x).toBeLessThan(s.x0);
    const sideR: Walker = { x: s.x1 + 2, y: 0, z: mid };
    walk(style, sideR, -6, 0);
    expect(sideR.x).toBeGreaterThan(s.x1);
    // under the upper floor, behind the stairs: you can't walk onto the top end of the ramp
    const under: Walker = { x: 0, y: 0, z: s.zTop - 1.5 };
    walk(style, under, 0, 4);
    expect(under.y).toBe(0);
    expect(under.z).toBeLessThan(s.zTop);
    // upstairs, in front of the hole: you stop at the fence instead of dropping through
    const up: Walker = { x: 0, y: FLOOR_H, z: s.zBottom + 2 };
    walk(style, up, 0, -4);
    expect(up.y).toBe(FLOOR_H);
    expect(up.z).toBeGreaterThan(s.zBottom);
    const upSide: Walker = { x: s.x0 - 2, y: FLOOR_H, z: mid };
    walk(style, upSide, 6, 0);
    expect(upSide.y).toBe(FLOOR_H);
    expect(upSide.x).toBeLessThan(s.x0);
  });

  it('walls between rooms stop you; the door gaps let you through', () => {
    const w = L.walls[0][0]; // the left wall of the right-hand... any partition: walk straight at it
    const p: Walker = { x: w.x - 3, y: 0, z: w.z - w.hd + 0.3 };
    // find a wall piece that is vertical (long along z) and walk into it from the side
    const v = L.walls[0].find((r) => r.hd > r.hw)!;
    p.x = v.x + 3;
    p.z = v.z;
    walk(style, p, -6, 0);
    expect(p.x).toBeGreaterThan(v.x);
    // the same line through the gap in that wall is open
    const gapZ = roomDoorZ(L.d);
    const q: Walker = { x: v.x + 2.5, y: 0, z: gapZ };
    walk(style, q, -5, 0);
    expect(q.x).toBeLessThan(v.x - 1);
  });
});

describe('furniture and walls', () => {
  const L = houseLayout('hytte');
  const bedR = itemRadius(2.2, 1);

  it('furniture placed inside a wall is pushed out of it', () => {
    for (const f of [0, 1]) {
      for (const r of L.walls[f]) {
        const p = placeInLayout(L, f, r.x, r.z, 0.5);
        expect(itemBlocked(L, f, p.x, p.z, 0.45), `small item, floor ${f} wall at ${r.x},${r.z}`).toBe(false);
        const q = placeInLayout(L, f, r.x, r.z, bedR);
        expect(itemBlocked(L, f, q.x, q.z, 0.1), `bed centre, floor ${f} wall at ${r.x},${r.z}`).toBe(false);
      }
    }
  });

  it('furniture cannot stand on the stairs or the hole above them', () => {
    for (const f of [0, 1]) {
      const mid = (L.stairs.zTop + L.stairs.zBottom) / 2;
      const p = placeInLayout(L, f, 0, mid, bedR);
      expect(onStairs(L.stairs, p.x, p.z) && Math.abs(p.x) < L.stairs.x1 - bedR).toBe(false);
      expect(itemBlocked(L, f, p.x, p.z, bedR - 0.05)).toBe(false);
    }
  });

  it('dragging furniture into a wall stops at the wall: it can not be moved through to the next room', () => {
    const r = itemRadius(2.2, 1);
    // a wall piece that runs along x (the front wall of the left back room): drag from the living room into the room through it
    const bz = -L.d / 2 + ROOM;
    const from = { x: -8, z: bz + 2 };
    const to = { x: -8, z: bz - 4 };
    const end = moveInLayout(L, 0, from, to, r);
    expect(end.z).toBeGreaterThan(bz);
    // the same drag, but one huge jump (finger flick) must not tunnel either
    const far = moveInLayout(L, 0, from, { x: -8, z: -L.d / 2 + 1 }, r);
    expect(far.z).toBeGreaterThan(bz);
    // through the real doorway it works: sofa-sized things can be carried through the door gap
    const gapZ = roomDoorZ(L.d);
    const ax = L.w / 2 - ROOM;
    const through = moveInLayout(L, 0, { x: ax - 2, z: gapZ }, { x: ax + 3, z: gapZ }, r);
    expect(through.x).toBeGreaterThan(ax + 1);
  });

  it('a piece too wide for the doorway cannot be carried through it', () => {
    const wide = itemRadius(3.2, 2); // an enlarged long sofa
    const gapZ = roomDoorZ(L.d);
    const ax = L.w / 2 - ROOM;
    const end = moveInLayout(L, 0, { x: ax - 2.5, z: gapZ }, { x: ax + 3, z: gapZ }, wide);
    expect(end.x).toBeLessThan(ax);
  });

  it('house items stay legal after any edit: placing, resizing and dragging', () => {
    let h = newHouse('hytte', 'me', 0);
    h = placeItem(h, 'sofa', 100, 100);
    h = placeItem(h, 'seng', 0, (L.stairs.zTop + L.stairs.zBottom) / 2, undefined, 1);
    const bedUp = h.items[h.items.length - 1];
    expect(bedUp.floor).toBe(1);
    for (const it of h.items) {
      const def = it.itemId;
      expect(def).toBeTruthy();
      expect(Math.abs(it.x)).toBeLessThan(L.w / 2);
      expect(Math.abs(it.z)).toBeLessThan(L.d / 2);
    }
    const sofa = h.items[h.items.length - 2];
    h = moveItem(h, sofa.uid, 0, -50);
    const moved = h.items.find((i) => i.uid === sofa.uid)!;
    expect(moved.z).toBeGreaterThan(-L.d / 2);
    h = updateItem(h, sofa.uid, { scale: 2 });
    const big = h.items.find((i) => i.uid === sofa.uid)!;
    expect(itemBlocked(L, big.floor, big.x, big.z, itemRadius(2.4, big.scale) - 0.05)).toBe(false);
  });

  it('furniture upstairs is a separate floor from furniture downstairs', () => {
    let h = newHouse('hytte', 'me', 0);
    h = placeItem(h, 'sofa', 0, 3, undefined, 0);
    h = placeItem(h, 'sofa', 0, 3, undefined, 1);
    expect(h.items.filter((i) => i.floor === 1).length).toBe(1);
    expect(h.items.filter((i) => i.itemId === 'sofa').map((i) => i.floor).sort()).toEqual([0, 1]);
  });

  it('rooms can be found by position', () => {
    expect(roomAt(L, 0, -L.w / 2 + 2, -L.d / 2 + 2)?.name).toBe('Soverom');
    expect(roomAt(L, 0, L.w / 2 - 2, -L.d / 2 + 2)?.name).toBe('Bad');
    expect(roomAt(L, 1, 0, L.d / 2 - 2)).toBeTruthy();
  });
});
