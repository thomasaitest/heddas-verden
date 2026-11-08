// Gameplay-camera proofs for Skyverden.
// TEST-ONLY setup is named in the saved files and in report.json:
// the follower is marked flyable, and the rain clock is advanced with testNow.
// Those switches are not part of normal play.
import { chromium, devices } from 'playwright-core';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4740/';
const out = process.argv[3] ?? '/opt/cursor/artifacts/skyverden';
fs.mkdirSync(out, { recursive: true });
const report = { testOnly: [], checks: {}, notes: [] };

const browser = await chromium.launch({
  executablePath: '/usr/local/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function boot(iphone = false) {
  const phone = iphone ? devices['iPhone 13'] : null;
  const ctx = await browser.newContext(phone ?? { viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction(() => !!window.__hv, null, { timeout: 90000 });
  await page.waitForTimeout(400);
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
  });
  return { page, ctx, errors };
}

async function shot(page, name) {
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__hv.step(1 / 30));
  await page.evaluate(() => document.querySelectorAll('.toast,.potion-sparkle').forEach((el) => el.remove()));
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('saved', name);
}

function prepFlight() {
  return pageEval();
}
async function pageEval(page, fn, arg) {
  return page.evaluate(fn, arg);
}

{
  const { page, ctx, errors } = await boot(true);
  report.notes.push({ bootErrors: errors });
  // No flight yet: stand at the arch and read the explanation.
  await page.evaluate(() => {
    const g = window.__hv;
    g.player.pos.set(-16, 0, 2);
    g.player.yaw = 0;
    g.cam.yaw = Math.PI;
    g.cam.pitch = 0.28;
    g.cam.dist = 14;
    g.flying = false;
  });
  await shot(page, '01-town-sky-arch-iphone');
  await page.evaluate(() => window.__hv.interact());
  await page.waitForTimeout(200);
  const access = await page.evaluate(() => document.querySelector('.toast')?.textContent ?? '');
  report.checks.explainsFlight = /øve|fly opp/.test(access);
  report.notes.push({ access });
  await page.screenshot({ path: `${out}/01b-how-to-fly-iphone.png` });
  await ctx.close();
}

{
  const { page, ctx, errors } = await boot(false);
  report.notes.push({ desktopErrors: errors });
  // TEST-ONLY: mark the pet flyable so the proof can ascend. Normal play still requires practice.
  report.testOnly.push('follower flyable=true so the flight proof can leave the ground');
  await page.evaluate(() => {
    const g = window.__hv;
    const pet = g.save.pets[0];
    const pets = g.save.pets.map((p, i) => (i === 0 ? { ...p, speciesId: 'ugle', name: 'Ugla', flyable: true, flyLessons: 4, wings: true } : p));
    g.commit({ ...g.save, pets, equipped: [pet.uid], bucks: 800 }, { pets: true });
    g.player.pos.set(0, 0, 16);
    g.flying = false;
    g.driving = null;
    g.syncVehicleMesh?.();
  });

  async function flyToward(x, z, ms = 9000) {
    await page.evaluate(({ x, z }) => {
      const g = window.__hv;
      const dx = x - g.player.pos.x;
      const dz = z - g.player.pos.z;
      const yaw = Math.atan2(-dx, -dz);
      g.cam.yaw = yaw;
      g.cam.pitch = 0.22;
      g.cam.dist = 14;
      g.player.yaw = Math.atan2(dx, dz);
      if (!g.flying) g.toggleFly();
      g.input.keys.add('KeyW');
      g.input.state.jump = true;
    }, { x, z });
    const steps = Math.round(ms / 33);
    for (let i = 0; i < steps; i++) {
      await page.evaluate(() => window.__hv.step(1 / 30));
      if (i % 20 === 19) {
        const done = await page.evaluate(({ x, z }) => {
          const g = window.__hv;
          const p = g.player.pos;
          return p.y > 44 && Math.hypot(p.x - x, p.z - z) < 8;
        }, { x, z });
        if (done) break;
      }
    }
    await page.evaluate(() => {
      const g = window.__hv;
      g.input.keys.delete('KeyW');
      g.input.state.jump = false;
    });
    // Descend onto the cloud floor with the real fly controls, then land.
    for (let i = 0; i < 90; i++) {
      const y = await page.evaluate(() => window.__hv.player.pos.y);
      if (y < 47.2) break;
      await page.evaluate(() => window.__hv.step(1 / 30));
    }
    await page.evaluate(() => {
      const g = window.__hv;
      if (g.flying) g.toggleFly();
      g.player.pos.y = Math.min(g.player.pos.y, 46.2);
      g.cam.pitch = 0.72;
      g.cam.dist = 11;
      g.cam.yaw = g.player.yaw + Math.PI;
      document.querySelectorAll('.toast,.potion-sparkle').forEach((el) => el.remove());
    });
    for (let i = 0; i < 8; i++) await page.evaluate(() => window.__hv.step(1 / 30));
  }

  await flyToward(-52, -18, 10000);
  const bad = await page.evaluate(() => ({ y: window.__hv.player.pos.y, x: window.__hv.player.pos.x, z: window.__hv.player.pos.z, where: document.querySelector('.where')?.textContent }));
  report.notes.push({ badeland: bad });
  await shot(page, '02-ascent-badeland');

  // Walk toward the pool and take the slide via the real prompt if we are close.
  await page.evaluate(() => {
    const g = window.__hv;
    g.player.yaw = Math.atan2(-5.2, -1.2);
    g.cam.yaw = g.player.yaw + Math.PI;
    g.input.keys.add('KeyW');
  });
  for (let i = 0; i < 40; i++) await page.evaluate(() => window.__hv.step(1 / 30));
  await page.evaluate(() => window.__hv.input.keys.delete('KeyW'));
  await shot(page, '03-badeland');

  await flyToward(52, -18, 12000);
  await shot(page, '04-rainbow-egg-cloud');
  await page.evaluate(() => window.__hv.interact());
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/04b-rainbow-egg-shop.png` });
  await page.evaluate(() => document.querySelectorAll('.sheet,.sheet-wrap').forEach((el) => el.remove()));

  await flyToward(18, 52, 12000);
  await shot(page, '05-mountain');
  // Walk into the cave along +z local, which is world +z from the cloud centre.
  await page.evaluate(() => {
    const g = window.__hv;
    g.player.yaw = 0;
    g.cam.yaw = Math.PI;
    g.cam.pitch = 0.4;
    g.input.keys.add('KeyW');
  });
  for (let i = 0; i < 70; i++) await page.evaluate(() => window.__hv.step(1 / 30));
  await page.evaluate(() => window.__hv.input.keys.delete('KeyW'));
  await shot(page, '05b-cave');

  await flyToward(-18, 52, 12000);
  report.testOnly.push('testNow set to the rain window so coins are visible. Normal play waits 20:00.');
  await page.evaluate(() => {
    const g = window.__hv;
    const now = 8_000_000_000;
    g.testNow = now + 20 * 60 * 1000 + 2000;
    g.save.skyRain = { nextAt: now + 20 * 60 * 1000, stormId: null, collected: [] };
  });
  for (let i = 0; i < 10; i++) await page.evaluate(() => window.__hv.step(1 / 30));
  const rain = await page.evaluate(() => ({
    chip: document.querySelector('.sky-chip')?.textContent ?? '',
    y: window.__hv.player.pos.y,
  }));
  report.notes.push({ rain });
  await shot(page, '06-TEST-ONLY-clock-rainbow-rain');
  await ctx.close();
}

fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
