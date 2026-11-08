import { chromium } from 'playwright-core';
import fs from 'node:fs';
const url = 'http://127.0.0.1:4740/';
const out = '/opt/cursor/artifacts/batch8';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/local/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForFunction(() => !!window.__hv);
await page.waitForTimeout(400);
if (await page.getByRole('button', { name: 'Ferdig ✓' }).count()) await page.getByRole('button', { name: 'Ferdig ✓' }).click();
if (await page.getByRole('button', { name: 'Klekk egget! 🐣' }).count()) {
  await page.getByRole('button', { name: 'Klekk egget! 🐣' }).click();
  await page.waitForTimeout(2200);
  if (await page.getByRole('button', { name: 'Hurra! 🎉' }).count()) await page.getByRole('button', { name: 'Hurra! 🎉' }).click();
}
await page.evaluate(() => {
  const g = window.__hv;
  g.weatherT0 = performance.now() / 1000 - 100;
  g.paused = false;
  document.querySelectorAll('.sheet, .sheet-wrap, .toast').forEach((el) => el.remove());
  g.commit({ ...g.save, bucks: 5000, bag: { ...g.save.bag, 'bil-rosa': 1 } });
});

async function frames(n = 6) {
  for (let i = 0; i < n; i++) await page.evaluate(() => window.__hv.step(1 / 30));
}
async function clearToasts() {
  await page.evaluate(() => document.querySelectorAll('.toast').forEach((el) => el.remove()));
}
async function shot(name) {
  await frames(4);
  await clearToasts();
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('saved', name);
}

const sign = await page.evaluate(() => {
  const g = window.__hv;
  let plate = null;
  g.town.group.traverse((o) => { if (o.name === 'shop-sign-plate-shop') plate = o; });
  const v = plate.getWorldPosition(new g.player.pos.constructor());
  // Stand outside, facing the shop. Camera sits behind the avatar so the facade fills the frame.
  g.driving = null;
  g.syncVehicleMesh();
  g.player.pos.set(38, 0, -16);
  g.player.yaw = Math.PI;
  g.cam.yaw = 0;
  g.cam.pitch = 0.42;
  g.cam.dist = 16;
  g.freezeCam = null;
  return { sign: { x: v.x, y: v.y, z: v.z } };
});
console.log('sign plate', sign);
await shot('04-shop-sign-front');

const bench = await page.evaluate(() => {
  const g = window.__hv;
  const b = g.town.benches[0];
  g.driving = null;
  g.syncVehicleMesh();
  g.player.pos.set(b.x + Math.sin(b.yaw) * 4.5, 0, b.z + Math.cos(b.yaw) * 4.5);
  g.player.yaw = Math.atan2(b.x - g.player.pos.x, b.z - g.player.pos.z);
  g.cam.yaw = g.player.yaw + Math.PI;
  g.cam.pitch = 0.55;
  g.cam.dist = 8;
  g.input.keys.add('KeyW');
  return { yaw: g.player.yaw, start: { x: g.player.pos.x, z: g.player.pos.z } };
});
for (let i = 0; i < 90; i++) await page.evaluate(() => window.__hv.step(1 / 30));
const benchEnd = await page.evaluate(() => {
  const g = window.__hv;
  g.input.keys.delete('KeyW');
  const b = g.town.benches[0];
  return { dist: Math.hypot(g.player.pos.x - b.x, g.player.pos.z - b.z), at: { x: g.player.pos.x, z: g.player.pos.z } };
});
console.log('bench walk', bench, benchEnd);
await shot('06-foot-stopped-at-bench');

const car = await page.evaluate(() => {
  const g = window.__hv;
  g.driving = 'bil-rosa';
  g.syncVehicleMesh();
  g.player.pos.set(38, 0, -12);
  g.player.yaw = Math.PI;
  g.cam.yaw = 0;
  g.cam.pitch = 0.38;
  g.cam.dist = 14;
  g.input.keys.add('KeyW');
  return true;
});
for (let i = 0; i < 70; i++) await page.evaluate(() => window.__hv.step(1 / 30));
const carEnd = await page.evaluate(() => {
  const g = window.__hv;
  g.input.keys.delete('KeyW');
  g.syncVehicleMesh();
  return { inside: g.town.insideBuilding(g.player.pos.x, g.player.pos.z), at: { x: g.player.pos.x, y: g.player.pos.y, z: g.player.pos.z } };
});
console.log('car drive', carEnd);
await shot('07-car-outside-shop');

const shelf = await page.evaluate(() => {
  const g = window.__hv;
  g.driving = null;
  g.syncVehicleMesh();
  const door = g.town.entrances.pets;
  // Just inside the doorway, looking at the stocked wall.
  g.player.pos.set(door.x - 3.4, 0, door.z);
  g.player.yaw = -Math.PI / 2;
  g.cam.yaw = Math.PI / 2;
  g.cam.pitch = 0.28;
  g.cam.dist = 10;
  return { inside: g.town.insideBuilding(g.player.pos.x, g.player.pos.z), at: { x: g.player.pos.x, z: g.player.pos.z } };
});
console.log('shelf cam', shelf);
await shot('03-wagon-varieties');

await page.evaluate(() => {
  const g = window.__hv;
  const door = g.town.entrances.pets;
  g.player.pos.set(door.x - 4.8, 0, door.z - 1.5);
  g.player.yaw = -Math.PI / 2;
  g.cam.yaw = Math.PI / 2;
  g.cam.pitch = 0.15;
  g.cam.dist = 11;
});
await shot('02-petshop-shelves');

await browser.close();
