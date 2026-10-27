// Screenshots of the v3 features in headless Chrome. Usage: node scripts/shots-v3.mjs [url] [outDir] [only,names]
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://127.0.0.1:4740/';
const out = process.argv[3] ?? '/workspace/heddas-mockups/v3';
const only = (process.argv[4] ?? '').split(',').filter(Boolean);
const want = (n) => only.length === 0 || only.includes(n);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function start(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 1180, height: 820 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__hv, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  if (opts.avatar) return { page, ctx };
  await page.getByRole('button', { name: 'Ferdig ✓' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Klekk egget! 🐣' }).click();
  await page.waitForTimeout(2600);
  await page.getByRole('button', { name: 'Hurra! 🎉' }).click();
  await page.waitForTimeout(600);
  return { page, ctx };
}
const shot = async (page, name, wait = 700) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('saved', `${out}/${name}.png`);
};

// ---- shop interior
if (want('shop') || want('hospital')) {
  const { page, ctx } = await start();
  if (want('shop')) {
    await page.evaluate(() => {
      const g = window.__hv;
      const z = g.town.zones.find((q) => q.kind === 'shop');
      const yaw = g.town.entrances.shop.yaw;
      g.player.pos.set(z.x - Math.sin(yaw) * 2.2, 0, z.z - Math.cos(yaw) * 2.2);
      g.player.yaw = yaw + Math.PI;
      g.cam.yaw = yaw + 0.5;
      g.cam.pitch = 0.5;
      g.cam.dist = 11;
    });
    await shot(page, 'shop-interior-1', 1500);
    await page.evaluate(() => { const g = window.__hv; g.cam.yaw += 1.2; g.cam.pitch = 0.3; g.cam.dist = 7; });
    await shot(page, 'shop-interior-2-items', 900);
    await page.evaluate(() => { const g = window.__hv; g.cam.yaw -= 1.9; g.cam.pitch = 0.3; g.cam.dist = 5; const p = g.player.pos; const yaw = g.town.entrances.shop.yaw; p.x += Math.sin(yaw) * 0; });
  }
  if (want('hospital')) {
    await page.evaluate(() => {
      const g = window.__hv;
      const z = g.town.zones.find((q) => q.kind === 'vet');
      const yaw = g.town.entrances.vet.yaw + Math.PI;
      g.player.pos.set(z.x + Math.sin(yaw) * 0.5, 0, z.z + Math.cos(yaw) * 0.5);
      g.player.yaw = yaw + Math.PI;
      g.cam.yaw = yaw + 0.35;
      g.cam.pitch = 0.62;
      g.cam.dist = 12;
    });
    await shot(page, 'hospital-beds-1', 1500);
    // a sick pet lies down in a bed
    await page.evaluate(() => {
      const g = window.__hv;
      const pet = g.save.pets[0];
      const next = { ...g.save, pets: g.save.pets.map((p) => (p.uid === pet.uid ? { ...p, need: { kind: 'syk', since: Date.now(), progress: 0.3 } } : p)) };
      g.commit(next);
    });
    await page.waitForTimeout(3500);
    await shot(page, 'hospital-beds-2-sick-pet', 500);
  }
  await ctx.close();
}

// ---- house: two floors, stairs, furnishing while walking
if (want('house')) {
  const { page, ctx } = await start();
  await page.evaluate(() => { const g = window.__hv; g.debugFurnish(); g.enterHouse(); });
  await page.waitForTimeout(500);
  // walk to the middle of the ground floor, high view
  await page.evaluate(() => { const g = window.__hv; g.player.pos.set(0, 0, 3); g.cam.yaw = 0.35; g.cam.pitch = 0.95; g.cam.dist = 19; });
  await shot(page, 'house-floor0-overview', 900);
  // walk up the stairs with the game loop: hold "forward" by stepping manually
  await page.evaluate(() => { const g = window.__hv; const s = g.interior.layout.stairs; g.player.pos.set((s.x0 + s.x1) / 2, 0, s.zBottom + 1.5); g.cam.yaw = 0.9; g.cam.pitch = 0.5; g.cam.dist = 13; });
  await shot(page, 'house-stairs-bottom', 700);
  const walked = await page.evaluate(async () => {
    const g = window.__hv; const s = g.interior.layout.stairs;
    const trace = [];
    for (let i = 0; i < 400; i++) {
      g.input.poll = () => ({ move: { x: 0, y: -1 }, camDX: 0, camDY: 0, zoom: 0, jump: false, jumpPressed: false });
      g.cam.yaw = 0;
      g.step(1 / 30);
      if (i % 50 === 0) trace.push([+g.player.pos.x.toFixed(2), +g.player.pos.y.toFixed(2), +g.player.pos.z.toFixed(2)]);
    }
    return { trace, floor: g.playerFloor() };
  });
  console.log('walk up', JSON.stringify(walked));
  await page.evaluate(() => { const g = window.__hv; g.input.poll = () => ({ move: { x: 0, y: 0 }, camDX: 0, camDY: 0, zoom: 0, jump: false, jumpPressed: false }); g.cam.yaw = 0.35; g.cam.pitch = 0.95; g.cam.dist = 17; });
  await shot(page, 'house-floor1-upstairs', 900);
  await ctx.close();
}

// ---- furnishing while walking
if (want('build')) {
  const { page, ctx } = await start({ viewport: { width: 1180, height: 820 } });
  await page.evaluate(() => { const g = window.__hv; g.debugFurnish(); g.enterHouse(); g.player.pos.set(-3, 0, 4.5); g.player.yaw = Math.PI * 0.9; g.cam.yaw = 0.3; });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Bygg/ }).last().click();
  await page.waitForTimeout(500);
  // walk around in build mode
  const before = await page.evaluate(() => { const p = window.__hv.player.pos; return [p.x, p.z]; });
  const after = await page.evaluate(() => {
    const g = window.__hv;
    g.input.poll = () => ({ move: { x: 1, y: 0 }, camDX: 0, camDY: 0, zoom: 0, jump: false, jumpPressed: false });
    for (let i = 0; i < 40; i++) g.step(1 / 30);
    g.input.poll = () => ({ move: { x: 0, y: 0 }, camDX: 0, camDY: 0, zoom: 0, jump: false, jumpPressed: false });
    return [g.player.pos.x, g.player.pos.z, g.building];
  });
  console.log('build walk', before, after);
  // walk to the left part of the room, then place a bed right in front of the player
  await page.evaluate(() => { const g = window.__hv; g.player.pos.set(-7, 0, 3.5); g.player.yaw = Math.PI / 2; g.cam.yaw = 0.5; g.cam.pitch = 0.9; g.cam.dist = 17; });
  await page.getByText('Seng', { exact: true }).first().click();
  await page.waitForTimeout(500);
  await shot(page, 'house-furnish-walking', 800);
  await ctx.close();
}

// ---- playground equipment in use
if (want('play')) {
  const { page, ctx } = await start();
  const sets = [
    ['swing1', 'playground-swing', 1.0, 0.45, 9, 1.4],
    ['slide', 'playground-slide', 0.8, 0.4, 11, 1.6],
    ['seesaw', 'playground-seesaw', -0.9, 0.4, 10, 2.4],
    ['merry', 'playground-merry-go-round', 0.7, 0.45, 10, 2.2],
  ];
  for (const [id, name, camYaw, pitch, dist, wait] of sets) {
    await page.evaluate(([id]) => {
      const g = window.__hv;
      if (g.using) g.stopUse();
      const e = g.town.equipment.find((q) => q.id === id);
      g.player.pos.set(e.exitX, 0, e.exitZ);
      g.player.yaw = e.exitYaw;
    }, [id]);
    await page.waitForTimeout(300);
    const prompt = await page.evaluate(() => document.querySelector('.prompt')?.textContent ?? null);
    console.log(id, 'prompt:', prompt);
    await page.evaluate(([id, camYaw, pitch, dist]) => {
      const g = window.__hv;
      g.startUse(id);
      const e = g.town.equipment.find((q) => q.id === id);
      g.cam.yaw = Math.atan2(g.player.pos.x - e.wx, g.player.pos.z - e.wz) + camYaw; g.cam.pitch = pitch; g.cam.dist = dist;
    }, [id, camYaw, pitch, dist]);
    await shot(page, name, wait * 1000);
    const prompt2 = await page.evaluate(() => document.querySelector('.prompt')?.textContent ?? null);
    console.log(id, 'while on:', prompt2, await page.evaluate(() => !!window.__hv.using));
  }
  await ctx.close();
}
await browser.close();
