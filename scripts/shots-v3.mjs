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
await browser.close();
