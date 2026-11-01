// Driver-inside-cabin proofs. Usage: node scripts/shots-driver-inside.mjs [url] [outDir]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4760/';
const out = process.argv[3] ?? '/workspace/heddas-verden-shots/next4';
fs.mkdirSync(out, { recursive: true });
const report = { checks: {}, notes: [] };

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForFunction(() => !!window.__hv, null, { timeout: 90000 });
const ferdig = page.getByRole('button', { name: 'Ferdig ✓' });
if (await ferdig.count()) await ferdig.click();
const klekk = page.getByRole('button', { name: 'Klekk egget! 🐣' });
if (await klekk.count()) {
  await klekk.click(); await page.waitForTimeout(2200);
  const hurra = page.getByRole('button', { name: 'Hurra! 🎉' });
  if (await hurra.count()) await hurra.click();
}
await page.evaluate(() => { window.__hv.weatherT0 = performance.now() / 1000 - 100; });

const cars = ['bil-rosa', 'bil-gul', 'bil-bla', 'bil-gronn', 'bil-lilla'];
const metrics = [];

for (const carId of cars) {
  const m = await page.evaluate((id) => {
    const g = window.__hv;
    document.querySelectorAll('.sheet,.panel,.sheet-wrap,.toast').forEach((el) => el.remove());
    const base = g.save.pets[0];
    const pet = { ...base, speciesId: 'hund', name: 'Hund', need: null, nextNeedAt: Date.now() + 600000 };
    g.commit({ ...g.save, pets: [pet], equipped: [pet.uid], bag: { ...g.save.bag, [id]: 1 } }, { pets: true });
    g.driving = id;
    g.syncVehicleMesh();
    g.player.pos.set(8, 0, 22);
    g.player.yaw = 0.15;
    return true;
  }, carId);
  await page.waitForTimeout(400);
  const stats = await page.evaluate(() => {
    const g = window.__hv;
    const holderY = g.avatarHolder.position.y;
    const bodyY = g.avatar.body.position.y;
    const scale = g.avatarHolder.scale.x;
    // Hip pivots ~0.9 on body; head roughly body+1.55 before holder scale.
    const approxHip = holderY + (bodyY + 0.9) * scale;
    const approxHead = holderY + (bodyY + 1.55) * scale;
    const legsHidden = g.avatar.legs.every((l) => !l.visible);
    return {
      holderY: +holderY.toFixed(3),
      bodyY: +bodyY.toFixed(3),
      approxHip: +approxHip.toFixed(3),
      approxHead: +approxHead.toFixed(3),
      legsHidden,
      scale: +scale.toFixed(3),
      car: g.driving,
    };
  });
  metrics.push(stats);

  // Front-quarter / 3-4 so closed vans show the driver through the windshield, not a blank side wall.
  await page.evaluate(() => {
    const g = window.__hv;
    const p = g.player.pos;
    const yaw = g.player.yaw;
    g.freezeCam = {
      x: p.x + Math.cos(yaw) * (-3.6) + Math.sin(yaw) * 4.2,
      y: 2.4,
      z: p.z - Math.sin(yaw) * (-3.6) + Math.cos(yaw) * 4.2,
      lx: p.x + Math.cos(yaw) * 0.2,
      ly: 1.15,
      lz: p.z + 0.35,
    };
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/08-driver-inside-${carId}-side.png` });

  // Chase
  await page.evaluate(() => {
    const g = window.__hv;
    const p = g.player.pos;
    const yaw = g.player.yaw;
    g.freezeCam = {
      x: p.x - Math.sin(yaw) * 7.5,
      y: 3.0,
      z: p.z - Math.cos(yaw) * 7.5,
      lx: p.x,
      ly: 1.05,
      lz: p.z + 0.3,
    };
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/08-driver-inside-${carId}-chase.png` });
  console.log('saved', carId, JSON.stringify(stats));
}

// Canonical hund pair (rosa)
await page.evaluate(() => {
  const g = window.__hv;
  g.driving = 'bil-rosa';
  g.syncVehicleMesh();
  g.player.pos.set(6, 0, 20);
  g.player.yaw = 0;
  g.freezeCam = { x: 6 - 4.2, y: 2.35, z: 20 + 3.4, lx: 6 - 0.2, ly: 1.0, lz: 20.15 };
});
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/08-driver-inside-side.png` });
await page.evaluate(() => {
  const g = window.__hv;
  g.freezeCam = { x: 6, y: 3.0, z: 20 - 7.2, lx: 6, ly: 1.0, lz: 20.2 };
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/08-driver-inside-chase.png` });

report.metrics = metrics;
report.checks.hipsNearSeat = metrics.every((m) => m.approxHip >= 0.55 && m.approxHip <= 1.15);
report.checks.headNotTowering = metrics.every((m) => m.approxHead < 2.35);
report.checks.legsHidden = metrics.every((m) => m.legsHidden === true || m.legsHidden === null);
report.ok = Object.values(report.checks).every(Boolean);
fs.writeFileSync(`${out}/08-driver-inside-results.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.ok ? 0 : 1);
