/** The cavern inside the little mountain. Walls and a roof close it in. */

import * as THREE from 'three';
import { CAVE_CEILING, CAVE_CRYSTAL, CAVE_EXIT, CAVE_R, CAVE_ROCKS, CAVE_ROPE, CAVE_SPAWN } from '../logic/cave.ts';
import { solid } from './colliders.ts';
import { G, box, cone, cyl, part, rbox, sph, textTexture, withCollision } from './kit.ts';

export interface CaveWorld {
  group: THREE.Group;
}

function torch(g: THREE.Object3D, x: number, z: number) {
  withCollision('solid', () => {
    solid(cyl(g, '#6a4a32', [x, 1.1, z], [0.12, 1.4, 0.12]), 'circle', 0.05, 2);
  });
  withCollision('passable', () => {
    sph(g, '#ff9a3c', [x, 1.95, z], [0.28, 0.36, 0.28], undefined, 0.9);
  });
  const light = new THREE.PointLight('#ffb15a', 1.6, 14, 1.4);
  light.position.set(x, 2.2, z);
  g.add(light);
}

function crystal(g: THREE.Object3D, x: number, z: number, h: number, color: string) {
  withCollision('solid', () => {
    solid(cone(g, color, [x, h * 0.5, z], [0.85, h, 0.85], undefined, 0.55), 'circle', 0.08, h);
  });
}

export function buildCave(): CaveWorld {
  const group = new THREE.Group();
  group.name = 'cave-realm';
  group.visible = false;

  withCollision('surface', () => {
    const floor = new THREE.Mesh(new THREE.CircleGeometry(CAVE_R, 64), new THREE.MeshLambertMaterial({ color: '#4a4038' }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.userData.collision = 'surface';
    group.add(floor);
  });

  withCollision('passable', () => {
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(CAVE_R * 2.02, CAVE_CEILING + 2, CAVE_R * 2.02),
      new THREE.MeshLambertMaterial({ color: '#5c5148', side: THREE.BackSide }),
    );
    shell.position.y = (CAVE_CEILING + 2) / 2;
    shell.userData.collision = 'passable';
    group.add(shell);
  });

  withCollision('passable', () => {
    // Inner wall. BackSide so you see rock when you look outward, not a void.
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(CAVE_R - 0.6, CAVE_R - 0.6, CAVE_CEILING, 64, 1, true),
      new THREE.MeshLambertMaterial({ color: '#9a8b7e', side: THREE.DoubleSide }),
    );
    wall.position.y = CAVE_CEILING / 2;
    wall.userData.collision = 'passable';
    group.add(wall);
    const roof = new THREE.Mesh(
      new THREE.CircleGeometry(CAVE_R, 48),
      new THREE.MeshLambertMaterial({ color: '#b7a394', emissive: '#3a2a22', emissiveIntensity: 0.35, side: THREE.DoubleSide }),
    );
    roof.rotation.x = Math.PI / 2;
    roof.position.y = CAVE_CEILING;
    roof.userData.collision = 'passable';
    group.add(roof);
    // A few ribs so the roof reads as stone, not a flat lid.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI;
      box(group, '#7a6e64', [0, CAVE_CEILING - 0.35, 0], [CAVE_R * 1.7, 0.5, 1.4], [0, a, 0]);
    }
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const rad = 18 + (i % 5) * 12;
      cone(group, '#6a5e56', [Math.cos(a) * rad, CAVE_CEILING - 1.1, Math.sin(a) * rad], [1.2, 2.2, 1.2]);
    }
  });

  // stone road from the gate, past the stall, and on into the hall
  withCollision('surface', () => {
    const road = [
      [0, CAVE_SPAWN.z + 16, 4.2, 40],
      [10, CAVE_ROPE.z - 6, 16, 4],
      [CAVE_ROPE.x, CAVE_ROPE.z - 2, 4, 10],
      [0, 8, 4.2, 70],
      [-20, 16, 22, 4],
    ] as const;
    for (const [x, z, w, d] of road) {
      const slab = box(group, '#7d7268', [x, 0.06, z], [w, 0.08, d]);
      slab.userData.collision = 'surface';
    }
  });

  withCollision('passable', () => {
    const lake = new THREE.Mesh(
      new THREE.CircleGeometry(11, 28),
      new THREE.MeshLambertMaterial({ color: '#3ec8ff', transparent: true, opacity: 0.8, emissive: '#1a6cff', emissiveIntensity: 0.45 }),
    );
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(-36, 0.08, 14);
    lake.userData.collision = 'passable';
    group.add(lake);
    const poolLight = new THREE.PointLight('#6ecbff', 2.2, 28, 1.3);
    poolLight.position.set(-36, 3.2, 14);
    group.add(poolLight);
    for (const [x, z, col] of [[-6, -55, '#ff5b8a'], [4, -40, '#ffe14d'], [-4, -22, '#c88bff'], [6, -8, '#7dffb2'], [2, 18, '#ff9a3c'], [-8, 40, '#7af0ff']] as const) {
      cyl(group, '#f3efe4', [x, 0.28, z], [0.18, 0.5, 0.18]);
      sph(group, col, [x, 0.62, z], [0.6, 0.32, 0.6], undefined, 0.25);
    }
  });

  for (const rock of CAVE_ROCKS) {
    withCollision('solid', () => {
      // Sphere radius matches the collider, sitting on the floor. No thin waist.
      solid(sph(group, '#5e6774', [rock.x, rock.r, rock.z], [rock.r * 2, rock.r * 2, rock.r * 2]), 'circle', 0, rock.r * 2);
    });
  }

  crystal(group, CAVE_CRYSTAL.x, CAVE_CRYSTAL.z, 3.2, '#7af0ff');
  crystal(group, CAVE_CRYSTAL.x + 3, CAVE_CRYSTAL.z + 2, 2.1, '#d7b4ff');
  crystal(group, 42, 20, 4.2, '#9af6ff');
  crystal(group, -48, -6, 3.4, '#ffe14d');
  crystal(group, 6, 62, 5.2, '#ff8ad8');
  crystal(group, -28, 48, 3.6, '#7dffb2');

  const torches: [number, number][] = [];
  for (let z = CAVE_EXIT.z + 6; z < 60; z += 14) torches.push([ -3.2, z], [3.2, z]);
  torches.push([CAVE_ROPE.x - 4, CAVE_ROPE.z], [CAVE_ROPE.x + 4, CAVE_ROPE.z], [-36, 4], [-36, 24], [40, 8], [-20, 46]);
  for (const [x, z] of torches) torch(group, x, z);

  withCollision('solid', () => {
    solid(rbox(group, '#e0a15c', [CAVE_ROPE.x, 0.7, CAVE_ROPE.z + 1.6], [3.4, 1.35, 1.15]), 'rect', 0, 1.4);
  });
  withCollision('passable', () => {
    for (const x of [-0.7, 0, 0.7]) {
      part(group, G.torus(), '#f0b14a', [CAVE_ROPE.x + x, 1.55, CAVE_ROPE.z + 1.15], [0.85, 0.85, 0.55], [Math.PI / 2, 0, 0], 0.2);
    }
    const tex = textTexture('Klatretau', { bg: '#c9842a', fg: '#fff', w: 512, h: 128 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    sign.position.set(CAVE_ROPE.x, 2.3, CAVE_ROPE.z + 1.15);
    sign.rotation.y = Math.PI;
    sign.userData.collision = 'passable';
    group.add(sign);
  });

  withCollision('solid', () => {
    solid(rbox(group, '#c4a484', [CAVE_EXIT.x - 2.7, 1.7, CAVE_EXIT.z], [1.05, 3.5, 1.05]), 'rect', 0, 3.6);
    solid(rbox(group, '#c4a484', [CAVE_EXIT.x + 2.7, 1.7, CAVE_EXIT.z], [1.05, 3.5, 1.05]), 'rect', 0, 3.6);
    solid(rbox(group, '#8d6b4a', [CAVE_EXIT.x, 3.55, CAVE_EXIT.z], [6.6, 0.7, 1.15]), 'rect', 0, 4.1);
  });
  withCollision('passable', () => {
    sph(group, '#ffb15a', [CAVE_EXIT.x - 2.7, 3.15, CAVE_EXIT.z + 0.15], [0.22, 0.28, 0.22], undefined, 0.8);
    sph(group, '#ffb15a', [CAVE_EXIT.x + 2.7, 3.15, CAVE_EXIT.z + 0.15], [0.22, 0.28, 0.22], undefined, 0.8);
    const tex = textTexture('Ut av hulen', { bg: '#6b7c93', fg: '#fff', w: 512, h: 128 });
    const geo = new THREE.PlaneGeometry(3.6, 0.9);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const plate = new THREE.Mesh(geo, mat);
    plate.position.set(CAVE_EXIT.x, 2.45, CAVE_EXIT.z + 0.62);
    plate.userData.collision = 'passable';
    group.add(plate);
    const back = new THREE.Mesh(geo, mat);
    back.position.set(CAVE_EXIT.x, 2.45, CAVE_EXIT.z - 0.62);
    back.rotation.y = Math.PI;
    back.userData.collision = 'passable';
    group.add(back);
    sph(group, '#9af6ff', [CAVE_EXIT.x, 2.5, CAVE_SPAWN.z], [0.28, 0.28, 0.28], undefined, 0.7);
  });

  group.add(new THREE.AmbientLight('#c4b2a4', 0.9));
  const hall = new THREE.PointLight('#ffd2a8', 1.1, 80, 1.4);
  hall.position.set(0, 8, 0);
  group.add(hall);

  return { group };
}
