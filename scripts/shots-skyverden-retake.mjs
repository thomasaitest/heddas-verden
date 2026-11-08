// Retake with the gameplay orbit camera aimed at each activity.
// TEST-ONLY: the follower is set flyable, and the forest clock uses testNow.
import { chromium, devices } from 'playwright-core';
import fs from 'node:fs';
const out = '/opt/cursor/artifacts/skyverden';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/local/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function boot(iphone) {
  const ctx = await browser.newContext(iphone ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://127.0.0.1:4740/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__hv);
  await page.waitForTimeout(300);
  if (await page.getByRole('button', { name: 'Ferdig ✓' }).count()) await page.getByRole('button', { name: 'Ferdig ✓' }).click();
  if (await page.getByRole('button', { name: 'Klekk egget! 🐣' }).count()) {
    await page.getByRole('button', { name: 'Klekk egget! 🐣' }).click();
    await page.waitForTimeout(1800);
    if (await page.getByRole('button', { name: 'Hurra! 🎉' }).count()) await page.getByRole('button', { name: 'Hurra! 🎉' }).click();
  }
  await page.evaluate(() => {
    const g = window.__hv;
    g.paused = false;
    g.testNow = null;
    document.querySelectorAll('.sheet,.sheet-wrap,.toast,.potion-sparkle').forEach((el) => el.remove());
  });
  return { page, ctx, errors };
}
async function snap(page, name) {
  for (let i = 0; i < 5; i++) await page.evaluate(() => window.__hv.step(1 / 30));
  await page.evaluate(() => document.querySelectorAll('.toast,.potion-sparkle').forEach((el) => el.remove()));
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('saved', name);
}
function look(page, x, z, yaw, pitch = 0.42, dist = 10) {
  return page.evaluate(({ x, z, yaw, pitch, dist }) => {
    const g = window.__hv;
    g.flying = false;
    g.player.pos.set(x, 46, z);
    g.player.yaw = yaw;
    g.cam.yaw = yaw + Math.PI;
    g.cam.pitch = pitch;
    g.cam.dist = dist;
  }, { x, z, yaw, pitch, dist });
}

{
  const { page, ctx, errors } = await boot(true);
  console.log('iphone errors', errors);
  await page.evaluate(() => {
    const g = window.__hv;
    g.player.pos.set(-16, 0, 3.2);
    g.player.yaw = 0;
    g.cam.yaw = Math.PI;
    g.cam.pitch = 0.32;
    g.cam.dist = 9;
  });
  await snap(page, '01-town-sky-arch-iphone');
  await page.evaluate(() => {
    const g = window.__hv;
    g.player.pos.set(-16, 0, 6.2);
  });
  for (let i = 0; i < 5; i++) await page.evaluate(() => window.__hv.step(1 / 30));
  await page.evaluate(() => window.__hv.interact());
  await page.waitForTimeout(250);
  const access = await page.evaluate(() => document.querySelector('.toast')?.textContent ?? '');
  console.log('access', access);
  await page.screenshot({ path: `${out}/01b-how-to-fly-iphone.png` });
  await ctx.close();
}

{
  const { page, ctx } = await boot(false);
  await page.evaluate(() => {
    const g = window.__hv;
    const pet = g.save.pets[0];
    g.commit({
      ...g.save,
      bucks: 800,
      pets: g.save.pets.map((p, i) => (i === 0 ? { ...p, speciesId: 'ugle', name: 'Ugla', flyable: true, flyLessons: 4 } : p)),
      equipped: [pet.uid],
    }, { pets: true });
    // TEST-ONLY flight flag, labelled in the filenames below.
    g.player.pos.set(0, 2, 0);
    g.flying = true;
    g.player.vy = 8;
    g.cam.yaw = Math.atan2(52, 18);
    g.cam.pitch = 0.18;
    g.cam.dist = 16;
  });
  for (let i = 0; i < 25; i++) await page.evaluate(() => window.__hv.step(1 / 30));
  await snap(page, '02-ascent-badeland');

  // Landed views use the orbit camera. Position is the cloud the flight proof already reached.
  await look(page, -52 - 3.5, -18 - 0.4, Math.atan2(-1.7, 0.8), 0.38, 9);
  await snap(page, '03-badeland');
  await look(page, 52, -18 + 0.2, 0, 0.4, 9);
  await snap(page, '04-rainbow-egg-cloud');
  await page.evaluate(() => window.__hv.interact());
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/04b-rainbow-egg-shop.png` });
  await page.evaluate(() => document.querySelectorAll('.sheet,.sheet-wrap').forEach((el) => el.remove()));

  await look(page, 18, 52 + 1.5, 0, 0.36, 11);
  await snap(page, '05-mountain');
  await look(page, 18, 52 + 4.6, 0, 0.42, 8);
  await snap(page, '05b-cave');

  await page.evaluate(() => {
    const g = window.__hv;
    const now = 9_000_000_000;
    g.testNow = now + 20 * 60 * 1000 + 1500;
    g.save.skyRain = { nextAt: now + 20 * 60 * 1000, stormId: null, collected: [] };
  });
  await look(page, -18, 52 - 2, 0.4, 0.5, 12);
  for (let i = 0; i < 8; i++) await page.evaluate(() => window.__hv.step(1 / 30));
  await snap(page, '06-TEST-ONLY-clock-rainbow-rain');
  const chip = await page.evaluate(() => document.querySelector('.sky-chip')?.textContent ?? '');
  console.log('chip', chip);
  await ctx.close();
}
await browser.close();
