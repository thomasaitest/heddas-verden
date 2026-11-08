import { chromium } from 'playwright-core';
const url = 'http://127.0.0.1:4740/';
const out = '/opt/cursor/artifacts/batch8';
const browser = await chromium.launch({
  executablePath: '/usr/local/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__hv);
await page.waitForTimeout(300);
if (await page.getByRole('button', { name: 'Ferdig ✓' }).count()) await page.getByRole('button', { name: 'Ferdig ✓' }).click();
if (await page.getByRole('button', { name: 'Klekk egget! 🐣' }).count()) {
  await page.getByRole('button', { name: 'Klekk egget! 🐣' }).click();
  await page.waitForTimeout(2000);
  if (await page.getByRole('button', { name: 'Hurra! 🎉' }).count()) await page.getByRole('button', { name: 'Hurra! 🎉' }).click();
}
await page.evaluate(() => {
  const g = window.__hv;
  g.paused = false;
  g.weatherT0 = performance.now() / 1000 - 100;
  document.querySelectorAll('.sheet,.sheet-wrap,.toast').forEach((el) => el.remove());
  g.commit({ ...g.save, equipped: [], bucks: 800, bag: { ...g.save.bag, 'bil-rosa': 1 } }, { pets: true });
});

async function shot(name) {
  for (let i = 0; i < 4; i++) await page.evaluate(() => window.__hv.step(1 / 30));
  await page.evaluate(() => document.querySelectorAll('.toast').forEach((el) => el.remove()));
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('saved', name);
}

const outside = await page.evaluate(() => {
  const g = window.__hv;
  return {
    a: g.town.insideBuilding(38, -20),
    b: g.town.insideBuilding(38, -22),
    c: g.town.insideBuilding(0, -20),
  };
});
console.log('inside probes', outside);

await page.evaluate(() => {
  const g = window.__hv;
  g.driving = null;
  g.syncVehicleMesh();
  g.player.pos.set(38, 0, -20);
  g.player.yaw = Math.PI;
  g.cam.yaw = 0;
  g.cam.pitch = 0.55;
  g.cam.dist = 18;
  g.freezeCam = null;
});
await shot('04-shop-sign-front');

await page.evaluate(() => {
  const g = window.__hv;
  g.driving = 'bil-rosa';
  g.syncVehicleMesh();
  g.player.pos.set(38, 0, -20);
  g.player.yaw = Math.PI;
  g.cam.yaw = 0;
  g.cam.pitch = 0.45;
  g.cam.dist = 12;
  g.input.keys.add('KeyW');
});
for (let i = 0; i < 80; i++) await page.evaluate(() => window.__hv.step(1 / 30));
const car = await page.evaluate(() => {
  const g = window.__hv;
  g.input.keys.delete('KeyW');
  g.syncVehicleMesh();
  g.cam.yaw = g.player.yaw + Math.PI * 0.72;
  g.cam.pitch = 0.4;
  g.cam.dist = 11;
  return { inside: g.town.insideBuilding(g.player.pos.x, g.player.pos.z), at: { x: g.player.pos.x, z: g.player.pos.z }, yaw: g.player.yaw };
});
console.log('car', car);
await shot('07-car-outside-shop');

const bench = await page.evaluate(() => {
  const g = window.__hv;
  g.driving = null;
  g.syncVehicleMesh();
  const b = g.town.benches[2] || g.town.benches[0];
  g.player.pos.set(b.x + Math.sin(b.yaw) * 4, 0, b.z + Math.cos(b.yaw) * 4);
  const face = Math.atan2(b.x - g.player.pos.x, b.z - g.player.pos.z);
  g.player.yaw = face;
  g.cam.yaw = face + Math.PI;
  g.input.keys.add('KeyW');
  return { face };
});
for (let i = 0; i < 50; i++) await page.evaluate(() => window.__hv.step(1 / 30));
const benchEnd = await page.evaluate(() => {
  const g = window.__hv;
  g.input.keys.delete('KeyW');
  const b = g.town.benches[2] || g.town.benches[0];
  g.cam.yaw = g.player.yaw + Math.PI * 0.55;
  g.cam.pitch = 0.62;
  g.cam.dist = 7;
  return { dist: Math.hypot(g.player.pos.x - b.x, g.player.pos.z - b.z), at: { x: g.player.pos.x, z: g.player.pos.z } };
});
console.log('bench', benchEnd);
await shot('06-foot-stopped-at-bench');

await browser.close();
