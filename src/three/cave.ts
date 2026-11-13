/** The large world inside the little mountain. */

import * as THREE from 'three';
import { CAVE_EXIT, CAVE_R, CAVE_ROCKS, CAVE_ROPE, CAVE_SPAWN } from '../logic/cave.ts';
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
  const light = new THREE.PointLight('#ffb15a', 1.4, 10, 1.5);
  light.position.set(x, 2.1, z);
  g.add(light);
}

function crystal(g: THREE.Object3D, x: number, z: number, h: number, color: string) {
  withCollision('solid', () => {
    solid(cone(g, color, [x, h * 0.5, z], [0.7, h, 0.7], undefined, 0.45), 'circle', 0.05, h);
  });
}

export function buildCave(): CaveWorld {
  const group = new THREE.Group();
  group.name = 'cave-realm';
  group.visible = false;

  withCollision('surface', () => {
    const floor = new THREE.Mesh(new THREE.CircleGeometry(CAVE_R, 48), new THREE.MeshLambertMaterial({ color: '#3a322c' }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.userData.collision = 'surface';
    group.add(floor);
  });

  withCollision('passable', () => {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(CAVE_R * 0.92, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: '#1a1422', side: THREE.BackSide }),
    );
    dome.position.y = 0.2;
    dome.userData.collision = 'passable';
    group.add(dome);
    // glowing water
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(6.5, 28),
      new THREE.MeshLambertMaterial({ color: '#3ec8ff', transparent: true, opacity: 0.75, emissive: '#1a6cff', emissiveIntensity: 0.6 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(-14, 0.08, 10);
    water.userData.collision = 'passable';
    group.add(water);
    const poolLight = new THREE.PointLight('#6ecbff', 1.6, 16, 1.4);
    poolLight.position.set(-14, 2.2, 10);
    group.add(poolLight);
  });

  // stone path from the exit toward the shop and the pool
  withCollision('surface', () => {
    for (const [x, z, w, d] of [
      [0, -16, 3.2, 14],
      [4, 2, 10, 3],
      [12, 6, 3, 6],
      [-8, 4, 8, 3],
    ] as const) {
      const slab = box(group, '#6d6258', [x, 0.06, z], [w, 0.08, d]);
      slab.userData.collision = 'surface';
    }
  });

  withCollision('passable', () => {
    // mushrooms along the path
    for (const [x, z, col] of [[-2, -8, '#ff5b8a'], [3, -4, '#ffe14d'], [-4, 2, '#c88bff'], [2, 6, '#7dffb2']] as const) {
      cyl(group, '#f3efe4', [x, 0.25, z], [0.16, 0.4, 0.16]);
      sph(group, col, [x, 0.55, z], [0.55, 0.28, 0.55], undefined, 0.25);
    }
  });

  for (const rock of CAVE_ROCKS) {
    withCollision('solid', () => {
      solid(sph(group, '#6a7380', [rock.x, rock.h * 0.35, rock.z], [rock.r * 2, rock.h, rock.r * 2]), 'circle', 0, rock.h);
    });
  }

  crystal(group, -8, 12, 2.4, '#7af0ff');
  crystal(group, -6, 14, 1.6, '#d7b4ff');
  crystal(group, 20, -4, 2.8, '#9af6ff');
  crystal(group, -20, 2, 2.2, '#ffe14d');
  crystal(group, 2, 22, 3.1, '#ff8ad8');

  for (const [x, z] of [[-6, -18], [6, -14], [-14, 0], [16, 4], [0, 14], [-10, 18]] as const) torch(group, x, z);

  // rope stall
  withCollision('solid', () => {
    solid(rbox(group, '#e0a15c', [CAVE_ROPE.x, 0.7, CAVE_ROPE.z + 1.4], [3.2, 1.3, 1.1]), 'rect', 0, 1.3);
  });
  withCollision('passable', () => {
    for (const x of [-0.7, 0, 0.7]) {
      part(group, G.torus(), '#f0b14a', [CAVE_ROPE.x + x, 1.5, CAVE_ROPE.z + 1.1], [0.85, 0.85, 0.55], [Math.PI / 2, 0, 0], 0.2);
    }
    const tex = textTexture('Klatretau', { bg: '#c9842a', fg: '#fff', w: 512, h: 128 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
    sign.position.set(CAVE_ROPE.x, 2.2, CAVE_ROPE.z + 1.5);
    sign.rotation.y = Math.PI;
    sign.userData.collision = 'passable';
    group.add(sign);
  });

  // exit arch, south
  withCollision('solid', () => {
    solid(box(group, '#8d96a3', [CAVE_EXIT.x - 2.4, 1.6, CAVE_EXIT.z], [0.8, 3.2, 0.8]), 'rect', 0, 3.2);
    solid(box(group, '#8d96a3', [CAVE_EXIT.x + 2.4, 1.6, CAVE_EXIT.z], [0.8, 3.2, 0.8]), 'rect', 0, 3.2);
    solid(box(group, '#6d7684', [CAVE_EXIT.x, 3.3, CAVE_EXIT.z], [5.6, 0.6, 0.8]), 'rect', 0, 3.8);
  });
  withCollision('passable', () => {
    const tex = textTexture('Ut av hulen', { bg: '#6b7c93', fg: '#fff', w: 512, h: 128 });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
    plate.position.set(CAVE_EXIT.x, 2.4, CAVE_EXIT.z + 0.15);
    plate.userData.collision = 'passable';
    group.add(plate);
    const back = plate.clone();
    back.position.z = CAVE_EXIT.z - 0.15;
    back.rotation.y = Math.PI;
    back.userData.collision = 'passable';
    group.add(back);
    sph(group, '#9af6ff', [CAVE_EXIT.x, 2.6, CAVE_SPAWN.z], [0.25, 0.25, 0.25], undefined, 0.7);
  });

  const fill = new THREE.AmbientLight('#6a5a88', 0.35);
  group.add(fill);

  return { group };
}
