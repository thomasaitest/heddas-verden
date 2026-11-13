// Proof shots for the wrap / hills / sky round.
// Cloud shots set one pet flyable. That is TEST-ONLY and is named in the file.
// The rain clock is never touched. The edge and hill shots use a normal walker.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const out = '/opt/cursor/artifacts/sky-round';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/local/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const log = [];
const note = (m) => { log.push(m); console.log(m); };

async function boot() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://127.0.0.1:4740/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__hv);
  await page.waitForTimeout(300);
  if (await page.getByRole('button', { name: 'Ferdig ✓' }).count()) await page.getByRole('button', { name: 'Ferdig ✓' }).click();
  if (await page.getByRole('button', { name: 'Klekk egget! 🐣' }).count()) {
    await page.getByRole('button', { name: 'Klekk egget! 🐣' }).click();
    await page.waitForTimeout(1600);
    if (await page.getByRole('button', { name: 'Hurra! 🎉' }).count()) await page.getByRole('button', { name: 'Hurra! 🎉' }).click();
  }
  await page.evaluate(() => {
    const g = window.__hv;
    g.paused = false;
    g.testNow = null;
    g.freezeCam = null;
    g.flying = false;
    document.querySelectorAll('.sheet,.sheet-wrap,.toast,.potion-sparkle,.hatch').forEach((el) => el.remove());
  });
  return { page, errors };
}
async function frames(page, n) {
  for (let i = 0; i < n; i++) await page.evaluate(() => window.__hv.step(1 / 30));
}
async function snap(page, name) {
  await frames(page, 4);
  await page.evaluate(() => document.querySelectorAll('.toast,.potion-sparkle').forEach((el) => el.remove()));
  await page.screenshot({ path: `${out}/${name}.png` });
  note('saved ' + name);
}
async function look(page, x, y, z, yaw, pitch = 0.38, dist = 11) {
  await page.evaluate(({ x, y, z, yaw, pitch, dist }) => {
    const g = window.__hv;
    g.freezeCam = null;
    g.flying = false;
    g.player.vy = 0;
    g.player.grounded = true;
    g.player.pos.set(x, y, z);
    g.player.yaw = yaw;
    g.cam.yaw = yaw + Math.PI;
    g.cam.pitch = pitch;
    g.cam.dist = dist;
    g.camShown = dist;
  }, { x, y, z, yaw, pitch, dist });
  await frames(page, 6);
}

const { page, errors } = await boot();
note('errors ' + errors.length);

// Hill: normal walker, no flight flag.
await look(page, 10, 0.2, 102, 0.4, 0.42, 12);
const hillY = await page.evaluate(() => window.__hv.player.pos.y);
note('hill feet y ' + hillY.toFixed(2));
await snap(page, '01-ground-hill-on-top');

// Edge: stand near the east side looking across the cut. No flight, no test clock.
await look(page, 114, 0.2, 8, Math.PI / 2, 0.32, 14);
await snap(page, '02-world-edge-wrap');
await page.evaluate(() => {
  const g = window.__hv;
  g.player.pos.set(116, g.player.pos.y, 8);
  g.cam.yaw = -Math.PI / 2;
  g.player.yaw = Math.PI / 2;
});
const beforeX = await page.evaluate(() => window.__hv.player.pos.x);
await page.keyboard.down('ArrowUp');
for (let i = 0; i < 40; i++) await page.evaluate(() => window.__hv.step(1 / 30));
await page.keyboard.up('ArrowUp');
const wrapped = await page.evaluate(() => ({ before: null, after: window.__hv.player.pos.x, testNow: window.__hv.testNow, flying: window.__hv.flying }));
wrapped.before = beforeX;
note('wrap walk ' + JSON.stringify(wrapped));
await snap(page, '02b-after-crossing-edge');

// TEST-ONLY flight so the clouds can be shown. The pet is marked flyable here only.
await page.evaluate(() => {
  const g = window.__hv;
  const pet = g.save.pets[0];
  g.commit({
    ...g.save,
    bucks: 800,
    pets: g.save.pets.map((p, i) => (i === 0 ? { ...p, speciesId: 'ugle', name: 'Ugla', flyable: true, flyLessons: 4 } : p)),
    equipped: [pet.uid],
  }, { pets: true });
  g.testNow = null;
});
await look(page, 0, 58, 8, 0.6, 1.15, 90);
await snap(page, '03-TEST-ONLY-flight-closer-clouds');

await look(page, -34 - 4.2, 46.2, -12 - 3.4, Math.atan2(2.6 - (-3.4), 3.2 - (-4.2)), 0.48, 14);
await snap(page, '04-TEST-ONLY-flight-badeland');

await look(page, -34 - 5.2, 49.1, -12 - 1.2, Math.atan2(3.8, 8.4), 0.35, 9);
await frames(page, 8);
const slidePrompt = await page.evaluate(() => document.querySelector('.prompt')?.textContent ?? '');
note('slide prompt ' + slidePrompt);
await page.evaluate(() => window.__hv.interact());
await frames(page, 16);
await snap(page, '05-TEST-ONLY-flight-slide-sit');
await frames(page, 90);

await look(page, 22 - 2, 46.2, 30 - 2.2, 0.35, 0.32, 13);
await snap(page, '06-TEST-ONLY-flight-mountain-outside');
await look(page, 22, 46.2, 30 + 3.8, 0, 0.18, 8);
await snap(page, '07-TEST-ONLY-flight-cave-inside');

fs.writeFileSync(`${out}/log.txt`, log.join('\n'));
await browser.close();
