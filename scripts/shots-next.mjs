// Screenshots for the "next" round. Usage: node scripts/shots-next.mjs [url] [outDir]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4740/';
const out = process.argv[3] ?? '/workspace/heddas-verden-shots/next';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function boot(label, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(label, 'PAGEERROR', e.message));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction(() => !!window.__hv, null, { timeout: 90000 });
  await page.waitForTimeout(800);
  const ferdig = page.getByRole('button', { name: 'Ferdig ✓' });
  if (await ferdig.count()) {
    // pick a fun outfit if avatar editor is open
    const tutu = page.getByRole('button', { name: /Tutu|Ballerina|Skjørt/ });
    if (await tutu.count()) await tutu.first().click().catch(() => {});
    await ferdig.click();
    await page.waitForTimeout(400);
  }
  const klekk = page.getByRole('button', { name: 'Klekk egget! 🐣' });
  if (await klekk.count()) {
    await klekk.click();
    await page.waitForTimeout(2400);
    const hurra = page.getByRole('button', { name: 'Hurra! 🎉' });
    if (await hurra.count()) await hurra.click();
    await page.waitForTimeout(600);
  }
  return { page, ctx };
}

const shot = async (page, name) => {
  await page.waitForTimeout(400);
  const path = `${out}/${name}.png`;
  await page.screenshot({ path });
  console.log('saved', path);
};

{
  const { page, ctx } = await boot('A');
  // Force midday look (always day anyway) and plaza overview
  await page.evaluate(() => {
    const g = window.__hv;
    g.player.pos.set(0, 0, 18);
    g.cam.yaw = 0;
    g.cam.pitch = 0.55;
    g.cam.dist = 28;
  });
  await page.waitForTimeout(500);
  await shot(page, '01-plaza-day-roads');

  // Shop signs
  await page.evaluate(() => {
    const g = window.__hv;
    const z = g.town.zones.find((z) => z.kind === 'shop');
    if (z) {
      g.player.pos.set(z.x, 0, z.z + 10);
      g.cam.yaw = Math.PI;
      g.cam.pitch = 0.35;
      g.cam.dist = 16;
    }
  });
  await shot(page, '02-shop-3d-sign');

  // Vet cross + sign
  await page.evaluate(() => {
    const g = window.__hv;
    const z = g.town.zones.find((z) => z.kind === 'vet');
    if (z) {
      g.player.pos.set(z.x - 8, 0, z.z + 8);
      g.cam.yaw = 0.9;
      g.cam.pitch = 0.4;
      g.cam.dist = 18;
    }
  });
  await shot(page, '03-vet-cross-sign');

  // Bench sit facing
  await page.evaluate(() => {
    const g = window.__hv;
    const b = g.town.benches[0];
    if (b) {
      g.resting = { x: b.x, z: b.z, yaw: b.yaw };
      g.player.pos.set(b.x, 0.55, b.z);
      g.player.yaw = b.yaw;
      g.cam.yaw = b.yaw + 0.8;
      g.cam.pitch = 0.25;
      g.cam.dist = 8;
    }
  });
  await page.waitForTimeout(300);
  await shot(page, '04-bench-sit-facing');

  // Playground – no logo
  await page.evaluate(() => {
    const g = window.__hv;
    g.resting = null;
    g.player.pos.y = 0;
    const z = g.town.zones.find((z) => z.kind === 'play');
    if (z) {
      g.player.pos.set(z.x, 0, z.z + 14);
      g.cam.yaw = Math.PI;
      g.cam.pitch = 0.45;
      g.cam.dist = 22;
    }
  });
  await shot(page, '05-playground-no-sign');

  // Enter house and sleep
  await page.evaluate(() => {
    const g = window.__hv;
    g.enterHouse();
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const g = window.__hv;
    // find bed prompt by stepping near a bed
    const house = g.save.houses.find((h) => h.id === g.save.activeHouseId) || g.save.houses[0];
    const bed = house?.items?.find((it) => it.itemId === 'seng' || it.itemId === 'dobbeltseng');
    if (bed) {
      g.player.pos.set(bed.x, bed.floor * 6.6, bed.z);
      g.player.yaw = bed.rot;
    }
  });
  await page.waitForTimeout(200);
  // trigger bed interact via near zone
  const slept = await page.evaluate(() => {
    const g = window.__hv;
    // manually sleep using public-ish API if near set, else force
    const house = g.save.houses.find((h) => h.id === g.save.activeHouseId) || g.save.houses[0];
    const bed = house?.items?.find((it) => it.itemId === 'seng');
    if (!bed) return false;
    // Use game's interact path by setting nearZone-like via resting sleep fields
    const y = 0.75 + (bed.floor || 0) * 6.6;
    g.sleeping = { x: bed.x, y, z: bed.z, yaw: bed.rot, itemUid: bed.uid };
    g.player.pos.set(bed.x, y, bed.z);
    g.player.yaw = bed.rot;
    g.cam.yaw = bed.rot + 1.2;
    g.cam.pitch = 0.35;
    g.cam.dist = 7;
    return true;
  });
  console.log('slept', slept);
  await page.waitForTimeout(500);
  await shot(page, '06-sleep-in-bed-zzz');

  // Avatar editor with new clothes
  await page.evaluate(() => {
    const g = window.__hv;
    g.sleeping = null;
    g.exitHouse();
  });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Avatar|Deg|Figur/ }).first().click().catch(() => {});
  await page.waitForTimeout(400);
  // try open avatar from HUD
  await page.evaluate(() => {
    const g = window.__hv;
    g.panels?.openAvatar?.();
  }).catch(() => {});
  await page.waitForTimeout(600);
  await shot(page, '07-avatar-clothes');

  // Close panels and shoot cabin cars (avatar seated inside)
  await page.evaluate(() => {
    const g = window.__hv;
    g.editingAvatar = false;
    g.building = false;
    document.querySelectorAll('.panel,.modal,.sheet,[class*="panel"]').forEach((el) => {
      if (el instanceof HTMLElement) el.style.display = 'none';
    });
    for (const id of ['bil-rosa', 'bil-gul', 'bil-bla', 'bil-gronn', 'bil-lilla']) g.save.bag[id] = 1;
  });
  await page.waitForTimeout(200);

  async function driveShot(carId, name, dist = 8.5, pitch = 0.22) {
    await page.evaluate(({ carId, dist, pitch }) => {
      const g = window.__hv;
      // tear down previous vehicle
      g.driving = null;
      g.pramming = null;
      if (g.vehicleMesh) {
        g.scene.remove(g.vehicleMesh);
        g.vehicleMesh = null;
      }
      g.driving = carId;
      // private at TS-level but present at runtime
      g.syncVehicleMesh();
      g.player.pos.set(8, 0, 22);
      g.player.yaw = 0.35;
      g.player.grounded = true;
      g.cam.yaw = 0.95;
      g.cam.pitch = pitch;
      g.cam.dist = dist;
    }, { carId, dist, pitch });
    await page.waitForTimeout(550);
    await shot(page, name);
  }

  await driveShot('bil-rosa', '08-car-rosa-cabin');
  await driveShot('bil-gul', '09-car-gul-cabin');
  await driveShot('bil-bla', '10-car-bla-cabin');
  await driveShot('bil-gronn', '11-car-gronn-cabin');
  await driveShot('bil-lilla', '12-car-lilla-cabin');
  await driveShot('bil-rosa', '13-car-cabin-closeup', 5.2, 0.1);

  await ctx.close();
}

await browser.close();
console.log('done');
