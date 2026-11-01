import { benchForward } from './townLayout.ts';

/** Where the avatar should stand after getting up from a bench (in front of the seat). */
export function standInFrontOfBench(sit: { x: number; z: number; yaw: number }, dist = 1.65): { x: number; z: number; yaw: number } {
  const f = benchForward(sit.yaw);
  return { x: sit.x + f.x * dist, z: sit.z + f.z * dist, yaw: sit.yaw };
}
