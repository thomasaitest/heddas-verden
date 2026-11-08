// Gameplay-camera proofs for the Skyverden visual pass.
// TEST-ONLY: one follower is marked flyable so flight can be shown, and the
// forest storm uses testNow (an accelerated clock). Those shots are named TEST-ONLY.
// The orbit camera is the normal in-game camera (no freezeCam).
import { chromium, devices } from 'playwright-core';
import fs from 'node:fs';

const out = '/opt/cursor/artifacts/skyverden';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/local/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const log = [];
function note(msg) {
  log.push(msg);
  console.log(msg);
}

async function boot(iphone) {
  const ctx = await browser.newContext(iphone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
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
    document.querySelectorAll('.sheet,.sheet-wrap,.toast,.potion-sparkle,.hatch').forEach((el) => el.remove());
  });
  return { page, ctx, errors };
}

async function frames(page, n, dt = 1 / 30) {
  for (let i = 0; i < n; i++) await page.evaluate((dt) => window.__hv.step(dt), dt);
}

async function snap(page, name) {
  await frames(page, 4);
  await page.evaluate(() => document.querySelectorAll('.toast,.potion-sparkle').forEach((el) => el.remove()));
  await page.screenshot({ path: `${out}/${name}.png` });
  note(`saved ${name}`);
}

/** Real orbit camera. y defaults to the cloud floor. */
async function look(page, x, z, yaw, pitch = 0.38, dist = 11, y = 46) {
  await page.evaluate(({ x, z, yaw, pitch, dist, y }) => {
    const g = window.__hv;
    g.freezeCam = null;
    g.flying = false;
    g.player.vy = 0;
    g.player.pos.set(x, y, z);
    g.player.yaw = yaw;
    g.cam.yaw = yaw + Math.PI;
    g.cam.pitch = pitch;
    g.cam.dist = dist;
    g.camShown = dist;
  }, { x, z, yaw, pitch, dist, y });
  await frames(page, 3);
}

async function grantFlight(page) {
  await page.evaluate(() => {
    const g = window.__hv;
    const pet = g.save.pets[0];
    g.commit({
      ...g.save,
      bucks: 800,
      pets: g.save.pets.map((p, i) => (i === 0 ? { ...p, speciesId: 'ugle', name: 'Ugla', flyable: true, flyLessons: 4, need: { kind: 'sulten', since: 1, progress: 0.45 } } : p)),
      equipped: [pet.uid],
    }, { pets: true });
  });
}

// --- mobile: gate, dismissible flight note, HUD sides ---
{
  const { page, ctx, errors } = await boot(true);
  note(`iphone boot errors ${errors.length}`);
  await page.evaluate(() => {
    const g = window.__hv;
    const pet = g.save.pets[0];
    if (pet) {
      g.commit({
        ...g.save,
        pets: g.save.pets.map((p, i) => (i === 0 ? { ...p, need: { kind: 'sulten', since: 1, progress: 0.4 } } : p)),
      }, { pets: true });
    }
    g.player.pos.set(-16, 0, 6.2);
    g.player.yaw = 0;
    g.cam.yaw = Math.PI;
    g.cam.pitch = 0.28;
    g.cam.dist = 9;
    g.camShown = 9;
  });
  await frames(page, 6);
  await page.evaluate(() => window.__hv.interact());
  await page.waitForTimeout(200);
  const noteText = await page.evaluate(() => document.querySelector('.sky-note p')?.textContent ?? '');
  note(`sky-note: ${noteText}`);
  await page.evaluate(() => document.querySelectorAll('.hatch,.toast').forEach((el) => el.remove()));
  await page.screenshot({ path: `${out}/01-mobile-flight-note.png` });
  await page.evaluate(() => document.querySelector('.sky-note .btn')?.click());
  await page.waitForTimeout(150);
  const gone = await page.evaluate(() => !document.querySelector('.sky-note'));
  note(`sky-note dismissed ${gone}`);
  await snap(page, '01b-mobile-note-dismissed');
  const overlap = await page.evaluate(() => {
    const a = document.querySelector('.tasks')?.getBoundingClientRect();
    const b = document.querySelector('.quest-rail')?.getBoundingClientRect();
    if (!a || !b || a.width < 2 || b.width < 2) return { ok: false, a, b };
    const hit = !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
    return { ok: !hit, tasks: { x: a.x, w: a.width, y: a.y }, quests: { x: b.x, w: b.width, y: b.y } };
  });
  note(`mobile hud overlap ${JSON.stringify(overlap)}`);
  await ctx.close();
}

// --- flight, four clouds, activities ---
{
  const { page, ctx, errors } = await boot(false);
  note(`desktop boot errors ${errors.length}`);

  const locked = await page.evaluate(() => {
    const g = window.__hv;
    const pet = g.save.pets[0];
    g.commit({
      ...g.save,
      pets: g.save.pets.map((p, i) => (i === 0 ? { ...p, speciesId: 'ugle', name: 'Ugla', flyable: false, flyLessons: 1 } : p)),
      equipped: [pet.uid],
    }, { pets: true });
    g.toggleFly();
    return { flying: g.flying, flyable: g.save.pets[0].flyable };
  });
  note(`blocked flight ${JSON.stringify(locked)}`);

  await grantFlight(page);
  const ascent = await page.evaluate(() => {
    const g = window.__hv;
    g.player.pos.set(-20, 1, -4);
    g.flying = true;
    g.player.vy = 0;
    g.cam.yaw = Math.atan2(-52 - (-20), -18 - (-4));
    g.cam.pitch = 0.22;
    g.cam.dist = 14;
    g.camShown = 14;
    const ys = [g.player.pos.y];
    for (let i = 0; i < 90; i++) {
      g.input.state.jump = true;
      g.step(1 / 30);
      if (i % 30 === 29) ys.push(Math.round(g.player.pos.y * 10) / 10);
    }
    g.input.state.jump = false;
    return { ys, y: g.player.pos.y, flying: g.flying };
  });
  note(`ascent ${JSON.stringify(ascent)}`);
  await snap(page, '02-ascent');

  await page.evaluate(() => {
    const g = window.__hv;
    g.freezeCam = null;
    g.flying = true;
    g.player.vy = 0;
    g.player.pos.set(0, 58, 16);
    g.cam.pitch = 1.2;
    g.cam.dist = 120;
    g.camShown = 120;
    g.cam.yaw = 0.4;
  });
  await frames(page, 4);
  await snap(page, '03-four-clouds-from-flight');

  // Land on badeland by descending onto the deck.
  const landed = await page.evaluate(() => {
    const g = window.__hv;
    g.flying = true;
    g.player.pos.set(-52 + 0.4, 52, -18 + 0.2);
    g.player.vy = -3;
    g.input.state.jump = false;
    for (let i = 0; i < 80; i++) g.step(1 / 30);
    return { y: g.player.pos.y, x: g.player.pos.x, z: g.player.pos.z, flying: g.flying };
  });
  note(`landed ${JSON.stringify(landed)}`);

  await look(page, -52 + 0.2, -18 - 1.2, Math.atan2(2.2 - (-1.2), 2.4 - 0.2), 0.42, 10);
  await snap(page, '04-badeland-pool');

  await look(page, -52 - 5.2, -18 - 1.2, Math.atan2(3.4, 7.6), 0.32, 8);
  await frames(page, 5);
  await page.evaluate(() => window.__hv.interact());
  await frames(page, 28);
  await snap(page, '04b-slide-in-motion');
  await frames(page, 70);
  await snap(page, '04c-splash-in-pool');

  await look(page, 52, -18 + 0.4, 0, 0.42, 8);
  await snap(page, '05-rainbow-egg-cloud');
  await frames(page, 6);
  const eggPrompt = await page.evaluate(() => document.querySelector('.prompt')?.textContent ?? '');
  note(`egg prompt ${eggPrompt}`);
  await page.evaluate(() => window.__hv.interact());
  await page.waitForFunction(() => {
    const s = document.querySelector('.sheet');
    return !!s && getComputedStyle(s).opacity === '1';
  });
  const eggClass = await page.evaluate(() => document.querySelector('.sheet .egg')?.className ?? '');
  note(`egg modal class ${eggClass}`);
  await page.screenshot({ path: `${out}/05b-rainbow-egg-modal.png` });
  await page.evaluate(() => document.querySelectorAll('.sheet,.sheet-wrap').forEach((el) => el.remove()));

  // Walk from the cloud centre through the open mouth using the real move loop.
  await page.evaluate(() => {
    const g = window.__hv;
    g.flying = false;
    g.player.pos.set(18, 46, 52 + 0.2);
    g.player.yaw = 0;
    g.cam.yaw = Math.PI;
    g.cam.pitch = 0.32;
    g.cam.dist = 8;
    g.camShown = 8;
  });
  await page.keyboard.down('ArrowUp');
  const caveSamples = [];
  for (let i = 0; i < 120; i++) {
    await page.evaluate(() => window.__hv.step(1 / 30));
    if (i % 30 === 29) {
      caveSamples.push(await page.evaluate(() => ({ x: Math.round(window.__hv.player.pos.x * 10) / 10, z: Math.round(window.__hv.player.pos.z * 10) / 10 })));
    }
  }
  await page.keyboard.up('ArrowUp');
  const cave = await page.evaluate(() => ({ samples: null, x: window.__hv.player.pos.x, z: window.__hv.player.pos.z, y: window.__hv.player.pos.y }));
  cave.samples = caveSamples;
  note(`cave walk ${JSON.stringify(cave)}`);
  await look(page, 18, 52 + 3.6, 0, 0.18, 7.5);
  await snap(page, '06-inside-cave');

  await look(page, 18 - 2.2, 52 - 2.4, Math.atan2(4.6, 2.2), 0.22, 12);
  await snap(page, '06b-cave-entrance');

  await look(page, 18 - 5.6, 52 + 0.6, 0.2, 0.34, 8);
  await snap(page, '06c-climb-face');

  await page.evaluate(() => {
    const g = window.__hv;
    // TEST-ONLY accelerated clock: storm starts one interval after this saved nextAt.
    const now = 9_000_000_000;
    g.testNow = now + 20 * 60 * 1000 + 2000;
    g.save.skyRain = { nextAt: now + 20 * 60 * 1000, stormId: null, collected: [] };
  });
  await look(page, -18 + 0.4, 52 - 1.5, 0.3, 0.55, 14);
  await frames(page, 10);
  await snap(page, '07-TEST-ONLY-clock-rainbow-rain');

  const rain = await page.evaluate(() => {
    const g = window.__hv;
    const before = g.save.bucks;
    g.player.pos.set(-18 + 3.01, 46, 52 + 1.1);
    g.step(1 / 20);
    const once = g.save.bucks;
    for (let i = 0; i < 10; i++) g.step(1 / 20);
    return { before, once, again: g.save.bucks, chip: document.querySelector('.sky-chip')?.textContent ?? '' };
  });
  note(`rain chip ${JSON.stringify(rain)}`);

  // Leave the cloud by flying up and away, back toward town height.
  await page.evaluate(() => {
    const g = window.__hv;
    g.flying = true;
    g.player.pos.set(-18, 48, 52);
    g.player.vy = 4;
    g.cam.yaw = 0;
  });
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('Space');
  for (let i = 0; i < 50; i++) await page.evaluate(() => window.__hv.step(1 / 30));
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowUp');
  const exit = await page.evaluate(() => ({ y: Math.round(window.__hv.player.pos.y * 10) / 10, x: Math.round(window.__hv.player.pos.x), z: Math.round(window.__hv.player.pos.z), flying: window.__hv.flying }));
  note(`exit cloud ${JSON.stringify(exit)}`);
  await snap(page, '08-flying-away');

  await ctx.close();
}

// Mobile on the pool, both HUD columns visible.
{
  const { page, ctx } = await boot(true);
  await grantFlight(page);
  await look(page, -52 + 0.5, -18 - 0.8, 0.8, 0.4, 9);
  await snap(page, '09-mobile-badeland-hud');
  const overlap = await page.evaluate(() => {
    const a = document.querySelector('.tasks')?.getBoundingClientRect();
    const b = document.querySelector('.quest-rail')?.getBoundingClientRect();
    if (!a || !b) return { ok: false };
    const hit = !(a.right < b.left - 4 || b.right < a.left - 4 || a.bottom < b.top || b.bottom < a.top);
    return { ok: !hit, tasksRight: a.right, questsLeft: b.left, tasksW: a.width, questsW: b.width };
  });
  note(`mobile cloud hud ${JSON.stringify(overlap)}`);
  await ctx.close();
}

fs.writeFileSync(`${out}/visual-log.txt`, log.join('\n'));
await browser.close();
