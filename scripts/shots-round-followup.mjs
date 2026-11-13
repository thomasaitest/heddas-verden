// Follow-up proofs. Cloud shots mark one pet flyable (TEST-ONLY). No rain clock.
// Needs are cleared so the 3D care bubbles do not cover the sitter.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const out = '/opt/cursor/artifacts/sky-round';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/local/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const log = [];
const note = (m) => { log.push(String(m)); console.log(m); };

const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:4740/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__hv);
await page.waitForTimeout(400);
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
  const pet = g.save.pets[0];
  g.commit({
    ...g.save,
    bucks: 800,
    pets: g.save.pets.map((p, i) => (i === 0 ? { ...p, need: null, needs: [], speciesId: 'ugle', name: 'Ugla', flyable: true, flyLessons: 4 } : p)),
    equipped: [],
  }, { pets: true });
  document.querySelectorAll('.sheet,.sheet-wrap,.toast,.potion-sparkle,.hatch').forEach((el) => el.remove());
});

async function frames(n) {
  for (let i = 0; i < n; i++) await page.evaluate(() => window.__hv.step(1 / 30));
}
async function shot(name) {
  await frames(3);
  await page.evaluate(() => document.querySelectorAll('.toast').forEach((el) => el.remove()));
  await page.screenshot({ path: `${out}/${name}.png` });
  note('saved ' + name);
}
function pose(x, y, z, yaw, camYaw, pitch, dist) {
  return page.evaluate(({ x, y, z, yaw, camYaw, pitch, dist }) => {
    const g = window.__hv;
    g.flying = false;
    g.player.vy = 0;
    g.player.grounded = true;
    g.player.pos.set(x, y, z);
    g.player.yaw = yaw;
    g.cam.yaw = camYaw;
    g.cam.pitch = pitch;
    g.cam.dist = dist;
    g.camShown = dist;
    g.freezeCam = null;
  }, { x, y, z, yaw, camYaw, pitch, dist });
}

note('errors ' + errors.length + ' testNow ' + await page.evaluate(() => window.__hv.testNow));

// East edge, orange post ahead. Then cross onto the blue post.
const EAST = 112;
const WEST = -112;
await pose(96, 0.3, 6, Math.PI / 2, -Math.PI / 2, 0.28, 16);
await frames(4);
const atEast = await page.evaluate(() => ({ x: window.__hv.player.pos.x, z: window.__hv.player.pos.z }));
note('before edge x=' + atEast.x.toFixed(1) + ' z=' + atEast.z.toFixed(1));
await shot('08-edge-before-x' + Math.round(atEast.x));
await page.evaluate(() => {
  const g = window.__hv;
  g.player.pos.set(114, 0.3, 2);
  g.cam.yaw = -Math.PI / 2;
  g.player.yaw = Math.PI / 2;
});
await page.keyboard.down('ArrowUp');
for (let i = 0; i < 50; i++) await page.evaluate(() => window.__hv.step(1 / 30));
await page.keyboard.up('ArrowUp');
const atWest = await page.evaluate(() => ({ x: window.__hv.player.pos.x, z: window.__hv.player.pos.z, flying: window.__hv.flying, testNow: window.__hv.testNow }));
note('after edge x=' + atWest.x.toFixed(1) + ' z=' + atWest.z.toFixed(1));
await page.evaluate(() => {
  const g = window.__hv;
  g.player.yaw = Math.PI / 2;
  g.cam.yaw = -Math.PI / 2;
  g.cam.pitch = 0.28;
  g.cam.dist = 16;
  g.camShown = 16;
});
await frames(3);
await shot('09-edge-after-x' + Math.round(atWest.x));

// Badeland: ladder, two loungers, striped ring. TEST-ONLY flyable pet, on foot on the cloud.
const slideYaw = Math.atan2(8.4, 3.8);
await pose(-34 - 6.2, 46.2, -12 - 4.2, 0.4, 0.4 + Math.PI, 0.55, 16);
await shot('10-TEST-ONLY-badeland-ladder-loungers');

// Climb the ladder, camera from the side.
await pose(-34 - 7.05, 46.2, -12 - 1.15, Math.atan2(1.85, 0.05), Math.atan2(1.85, 0.05) + Math.PI / 2, 0.25, 8);
await frames(6);
await page.evaluate(() => window.__hv.interact());
await frames(22);
const climb = await page.evaluate(() => ({ y: window.__hv.player.pos.y, x: window.__hv.player.pos.x, z: window.__hv.player.pos.z }));
note('ladder y=' + (climb.y - 46).toFixed(2));
await page.evaluate((slideYaw) => {
  const g = window.__hv;
  g.cam.yaw = g.player.yaw + Math.PI / 2;
  g.cam.pitch = 0.2;
  g.cam.dist = 8;
  g.camShown = 8;
}, slideYaw);
await shot('11-TEST-ONLY-climbing-ladder');
await frames(80);

// Side view, mid-slide, no follower.
await pose(-34 - 5.2, 49.1, -12 - 1.2, slideYaw, slideYaw + Math.PI / 2, 0.15, 9);
await frames(6);
await page.evaluate(() => window.__hv.interact());
await frames(22);
await page.evaluate(() => {
  const g = window.__hv;
  g.cam.yaw = g.player.yaw + Math.PI / 2;
  g.cam.pitch = 0.12;
  g.cam.dist = 8;
  g.camShown = 8;
});
await frames(2);
await shot('12-TEST-ONLY-slide-side');
await frames(90);

// Stopped against a sunbed.
const bed = { before: null, after: null, z: null };
await pose(-34 + 5.6 - 2.2, 46.15, -12 - 1.9, Math.PI / 2, -Math.PI / 2, 0.35, 8);
bed.before = await page.evaluate(() => window.__hv.player.pos.x);
await page.keyboard.down('ArrowUp');
for (let i = 0; i < 45; i++) await page.evaluate(() => window.__hv.step(1 / 30));
await page.keyboard.up('ArrowUp');
const bedAfter = await page.evaluate(() => ({ after: window.__hv.player.pos.x, z: window.__hv.player.pos.z }));
note('sunbed stop before=' + bed.before.toFixed(2) + ' after=' + bedAfter.after.toFixed(2) + ' bedCenter=' + (-34 + 5.6).toFixed(2));
await shot('13-TEST-ONLY-stopped-by-sunbed');

const rockBefore = await page.evaluate(() => {
  const g = window.__hv;
  g.flying = false;
  g.player.pos.set(22 - 9.2, 46.15, 30 + 4.2);
  g.player.yaw = Math.PI / 2;
  g.cam.yaw = -Math.PI / 2;
  g.cam.pitch = 0.32;
  g.cam.dist = 10;
  g.camShown = 10;
  return g.player.pos.x;
});
await page.keyboard.down('ArrowUp');
for (let i = 0; i < 40; i++) await page.evaluate(() => window.__hv.step(1 / 30));
await page.keyboard.up('ArrowUp');
const rockAfter = await page.evaluate(() => window.__hv.player.pos.x);
note('rock stop before=' + rockBefore.toFixed(2) + ' after=' + rockAfter.toFixed(2) + ' rockFace~' + (22 - 8.25).toFixed(2));
await page.evaluate(() => {
  const g = window.__hv;
  g.cam.yaw = Math.PI;
  g.cam.pitch = 0.3;
  g.cam.dist = 9;
  g.camShown = 9;
});
await shot('14-TEST-ONLY-stopped-by-mountain');

// Mountain outside and deep cave.
await pose(22 - 1.5, 46.3, 30 - 6, 0.15, Math.PI + 0.15, 0.38, 16);
await shot('15-TEST-ONLY-mountain-outside');
await pose(22, 46.25, 30 + 8.0, 0, Math.PI, 0.22, 8);
await shot('16-TEST-ONLY-cave-room');

fs.writeFileSync(`${out}/log2.txt`, log.join('\n'));
await browser.close();
