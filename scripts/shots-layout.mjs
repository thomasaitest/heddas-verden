// Proof screenshots: distinct floor plans per house style.
// Usage: node scripts/shots-layout.mjs [url] [outDir]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4750/';
const out = process.argv[3] ?? '/workspace/heddas-verden-shots/next3';
fs.mkdirSync(out, { recursive: true });

const STYLES = ['hytte', 'villa', 'gard', 'moderne', 'trehus', 'sjohus', 'slott'];

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForFunction(() => !!window.__hv, null, { timeout: 90000 });
await page.waitForTimeout(400);
const ferdig = page.getByRole('button', { name: 'Ferdig ✓' });
if (await ferdig.count()) { await ferdig.click(); await page.waitForTimeout(200); }
const klekk = page.getByRole('button', { name: 'Klekk egget! 🐣' });
if (await klekk.count()) {
  await klekk.click(); await page.waitForTimeout(2200);
  const hurra = page.getByRole('button', { name: 'Hurra! 🎉' });
  if (await hurra.count()) await hurra.click();
  await page.waitForTimeout(300);
}
await page.evaluate(() => { window.__hv.weatherT0 = performance.now() / 1000 - 100; });

const shot = async (name, wait = 700) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('saved', name);
};

for (const style of STYLES) {
  await page.evaluate((style) => {
    const g = window.__hv;
    document.querySelectorAll('.sheet,.panel,.sheet-wrap,.toast,.task-toast').forEach((el) => el.remove());
    g.freezeCam = null;
    if (g.mode === 'house') g.exitHouse();
    g.debugSetHouseStyle(style);
    g.enterHouse();
    const L = g.interior.layout;
    const st = L.stairs;
    const smx = (st.x0 + st.x1) / 2;
    const door = g.interior.door;
    // Corner-high view: from front-right looking toward back-left so stair offset + rooms read clearly
    const camX = L.w * 0.42;
    const camZ = L.d * 0.48;
    g.player.pos.set(door.x, 0, door.z - 1.2);
    g.player.yaw = Math.PI;
    g.freezeCam = {
      x: camX,
      y: 7.5,
      z: camZ,
      lx: smx * 0.35,
      ly: 1.6,
      lz: -L.d * 0.05,
    };
  }, style);
  await shot(`11-layout-${style}`, 950);

  await page.evaluate(() => {
    const g = window.__hv;
    const L = g.interior.layout;
    document.querySelectorAll('.sheet,.panel,.sheet-wrap,.toast,.task-toast').forEach((el) => el.remove());
    g.freezeCam = { x: 0.2, y: Math.max(L.w, L.d) * 1.25, z: 0.2, lx: 0, ly: 0, lz: 0 };
  });
  await shot(`11-layout-${style}-plan`, 850);

  await page.evaluate(() => {
    const g = window.__hv;
    g.freezeCam = null;
    g.exitHouse();
  });
}

await browser.close();
console.log('done', STYLES.length * 2, 'shots →', out);
