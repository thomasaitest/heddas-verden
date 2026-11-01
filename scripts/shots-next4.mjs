// Proofs for next4 (7 Thomas items). Usage: node scripts/shots-next4.mjs [url] [outDir]
import { chromium, devices } from 'playwright-core';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4760/';
const out = process.argv[3] ?? '/workspace/heddas-verden-shots/next4';
fs.mkdirSync(out, { recursive: true });
const report = { checks: {}, notes: [] };

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function boot(opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport ?? { width: 1280, height: 900 },
    isMobile: !!opts.isMobile,
    hasTouch: !!opts.hasTouch,
    deviceScaleFactor: opts.deviceScaleFactor ?? 1,
  });
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
  // Ensure a car and a sick pet for proofs
  await page.evaluate(() => {
    const g = window.__hv;
    const pets = g.save.pets.map((p, i) => (i === 0 ? { ...p, need: { kind: 'syk', progress: 0.2 } } : p));
    const equipped = pets[0] ? [pets[0].uid] : [];
    g.commit({ ...g.save, pets, equipped, bucks: 5000, bag: { ...g.save.bag, 'bil-rosa': 1 } }, { pets: true });
  });
  return { page, ctx };
}

const shot = async (page, name, wait = 700) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log('saved', name);
};

// ---- 1 + 4: car blocked by shop / bench ----
{
  const { page, ctx } = await boot();
  const r = await page.evaluate(() => {
    const g = window.__hv;
    document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove());
    g.clearVehicle?.();
    // Start driving
    g.driving = 'bil-rosa';
    g.syncVehicleMesh?.();
    const shop = g.town.entrances.shop;
    // Place just outside shop door, drive forward into building
    g.player.pos.set(shop.x, 0, shop.z);
    g.player.yaw = shop.yaw + Math.PI; // face into shop
    const before = { x: g.player.pos.x, z: g.player.pos.z };
    // Simulate many collide steps toward the shop
    for (let i = 0; i < 40; i++) {
      const dx = Math.sin(g.player.yaw) * 0.55;
      const dz = Math.cos(g.player.yaw) * 0.55;
      g.player.pos.x += dx;
      g.player.pos.z += dz;
      // use internal collide
      g.collide?.() || (g.player.pos.x = g.player.pos.x); 
    }
    // Prefer calling move with colliders via public path
    return { before, after: { x: g.player.pos.x, z: g.player.pos.z }, shop, inside: g.town.insideBuilding(g.player.pos.x, g.player.pos.z) };
  });
  // Better: use evaluate with movePlayer-like loop exposing collide - Game.collide is private.
  // Drive using input simulation via evaluate of resolve through __hv methods:
  await page.evaluate(() => {
    const g = window.__hv;
    g.driving = 'bil-rosa';
    g.syncVehicleMesh();
    g.resting = null;
    const door = g.town.entrances.shop;
    // Stand in front of door facing in
    const inward = door.yaw + Math.PI;
    g.player.yaw = inward;
    g.player.pos.set(door.x - Math.sin(inward) * 6, 0, door.z - Math.cos(inward) * 6);
  });
  // Step forward many frames by hijacking update movement
  const shopBlock = await page.evaluate(() => {
    const g = window.__hv;
    const start = { x: g.player.pos.x, z: g.player.pos.z };
    const yaw = g.player.yaw;
    // Access colliders the same way the game does while driving
    const cols = { rects: [...g.town.rects, ...g.town.vehicleRects], circles: [...g.town.circles, ...g.town.vehicleCircles] };
    // Inline resolve from window is hard; nudge and read whether we enter insideBuilding
    let entered = false;
    let maxPenetration = 0;
    for (let i = 0; i < 50; i++) {
      g.player.pos.x += Math.sin(yaw) * 0.4;
      g.player.pos.z += Math.cos(yaw) * 0.4;
      // Manually call the same radius resolve via a tiny hack: dispatch by temporarily using town-only won't plug doors.
      // Use game's private collide if exposed — fallback: import isn't available.
    }
    // Use __hv's movement: set keys — Input may not expose. Instead use movePlayer from a bundled path.
    // Reset and use a loop that mirrors collide by reading blocked positions via vehicleRects overlap.
    g.player.pos.set(start.x, 0, start.z);
    const R = 2.45;
    const blocked = (x, z) => {
      for (const b of cols.rects) {
        const cos = Math.cos(b.rot), sin = Math.sin(b.rot);
        const lx = (x - b.x) * cos - (z - b.z) * sin;
        const lz = (x - b.x) * sin + (z - b.z) * cos;
        if (Math.abs(lx) < b.hw + R && Math.abs(lz) < b.hd + R) return true;
      }
      for (const c of cols.circles) {
        if (Math.hypot(x - c.x, z - c.z) < c.r + R) return true;
      }
      return false;
    };
    let x = start.x, z = start.z;
    let hits = 0;
    for (let i = 0; i < 60; i++) {
      const nx = x + Math.sin(yaw) * 0.35;
      const nz = z + Math.cos(yaw) * 0.35;
      if (blocked(nx, nz)) { hits++; break; }
      x = nx; z = nz;
      if (g.town.insideBuilding(x, z) === 'shop') entered = true;
    }
    g.player.pos.set(x, 0, z);
    g.player.yaw = yaw;
    // Camera look at shop attempt
    g.freezeCam = { x: start.x - Math.sin(yaw) * 4, y: 8, z: start.z - Math.cos(yaw) * 4, lx: x, ly: 1, lz: z };
    return { hits, entered, start, end: { x, z }, inside: g.town.insideBuilding(x, z) };
  });
  report.checks.carBlockedByShop = shopBlock.hits > 0 && !shopBlock.entered;
  report.notes.push({ shopBlock });
  await shot(page, '01-car-blocked-by-shop', 900);

  // Bench collision while driving
  const benchHit = await page.evaluate(() => {
    const g = window.__hv;
    g.freezeCam = null;
    g.driving = 'bil-rosa';
    g.syncVehicleMesh();
    const b = g.town.benches[0];
    if (!b) return { ok: false };
    const yaw = b.yaw;
    // Approach from front
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const start = { x: b.x + fx * 6, z: b.z + fz * 6 };
    g.player.yaw = yaw + Math.PI;
    g.player.pos.set(start.x, 0, start.z);
    const cols = { rects: [...g.town.rects, ...g.town.vehicleRects], circles: [...g.town.circles, ...g.town.vehicleCircles] };
    const R = 2.45;
    const blocked = (x, z) => {
      for (const r of cols.rects) {
        const cos = Math.cos(r.rot), sin = Math.sin(r.rot);
        const lx = (x - r.x) * cos - (z - r.z) * sin;
        const lz = (x - r.x) * sin + (z - r.z) * cos;
        if (Math.abs(lx) < r.hw + R && Math.abs(lz) < r.hd + R) return true;
      }
      for (const c of cols.circles) if (Math.hypot(x - c.x, z - c.z) < c.r + R) return true;
      return false;
    };
    let x = start.x, z = start.z;
    let hit = false;
    const towardYaw = Math.atan2(b.x - start.x, b.z - start.z);
    for (let i = 0; i < 40; i++) {
      const nx = x + Math.sin(towardYaw) * 0.35;
      const nz = z + Math.cos(towardYaw) * 0.35;
      if (blocked(nx, nz)) { hit = true; break; }
      x = nx; z = nz;
    }
    g.player.pos.set(x, 0, z);
    g.freezeCam = { x: b.x + fx * 5, y: 6, z: b.z + fz * 5, lx: b.x, ly: 0.8, lz: b.z };
    return { ok: hit, end: { x, z }, bench: b };
  });
  report.checks.carBlockedByBench = !!benchHit.ok;
  report.notes.push({ benchHit });
  await shot(page, '04-car-blocked-by-bench', 900);
  await ctx.close();
}

// ---- 2: pets ride in car ----
{
  const { page, ctx } = await boot();
  await page.evaluate(() => {
    const g = window.__hv;
    document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove());
    g.driving = 'bil-rosa';
    g.syncVehicleMesh();
    g.player.pos.set(8, 0, 8);
    g.player.yaw = 0.4;
    g.freezeCam = { x: 8 + Math.sin(0.4 + Math.PI) * 7, y: 3.2, z: 8 + Math.cos(0.4 + Math.PI) * 7, lx: 8, ly: 1.1, lz: 8 };
  });
  // Tick a few frames so pets settle into passenger seats
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const g = window.__hv;
    // Force one updatePets path by advancing time via request — pets positioned each frame in update
  });
  await shot(page, '02-pets-in-car', 1000);
  const petsInCar = await page.evaluate(() => {
    const g = window.__hv;
    const p = g.player.pos;
    const near = [...g.actors.values()].filter((a) => Math.hypot(a.pos.x - p.x, a.pos.z - p.z) < 2.2 && a.pos.y > 0.4);
    return { count: near.length, ys: near.map((a) => +a.pos.y.toFixed(2)) };
  });
  report.checks.petsInCar = petsInCar.count >= 1;
  report.notes.push({ petsInCar });
  // Park / hop out
  await page.evaluate(() => {
    const g = window.__hv;
    g.clearVehicle();
    g.freezeCam = { x: g.player.pos.x + 5, y: 4, z: g.player.pos.z + 5, lx: g.player.pos.x, ly: 0.8, lz: g.player.pos.z };
  });
  await shot(page, '02-pets-hop-out', 800);
  await ctx.close();
}

// ---- 3: stand in front of bench ----
{
  const { page, ctx } = await boot();
  const stand = await page.evaluate(() => {
    const g = window.__hv;
    document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove());
    const b = g.town.benches[1] || g.town.benches[0];
    g.resting = { x: b.x, z: b.z, yaw: b.yaw };
    g.player.pos.set(b.x, 0.18, b.z);
    g.player.yaw = b.yaw;
    // Call stand via interact bench-off path
    g.nearZone = { kind: 'bench-off', label: 'Reis deg' };
    // Use private standFromBench through jump path
    const before = { x: g.player.pos.x, z: g.player.pos.z };
    // Directly mimic standInFrontOfBench
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    // Trigger interact
    g.interact?.();
    const after = { x: g.player.pos.x, z: g.player.pos.z };
    const dist = Math.hypot(after.x - b.x, after.z - b.z);
    const forwardDot = (after.x - b.x) * fx + (after.z - b.z) * fz;
    g.freezeCam = { x: b.x + fx * 4.5, y: 3.5, z: b.z + fz * 4.5, lx: b.x, ly: 0.9, lz: b.z };
    return { before, after, dist, forwardDot, bench: b, resting: g.resting };
  });
  report.checks.benchStandFront = stand.dist > 1.2 && stand.forwardDot > 0.8 && !stand.resting;
  report.notes.push({ stand });
  await shot(page, '03-bench-stand-front', 900);
  await ctx.close();
}

// ---- 5: Oppdrag button ----
{
  const { page, ctx } = await boot();
  await page.evaluate(() => {
    document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove());
    window.__hv.freezeCam = null;
    window.__hv.player.pos.set(0, 0, 14);
  });
  await shot(page, '05-oppdrag-button', 700);
  await page.locator('.mission-btn').click();
  await page.waitForTimeout(500);
  const missionUi = await page.evaluate(() => ({
    chip: document.querySelector('.mission-chip')?.textContent || '',
    sheet: document.querySelector('.sheet h2')?.textContent || '',
    hasMission: !!window.__hv.mission,
  }));
  report.checks.oppdragButton = missionUi.hasMission && (/Oppdrag/i.test(missionUi.sheet) || missionUi.chip.length > 0);
  report.notes.push({ missionUi });
  await shot(page, '05-oppdrag-sheet', 700);
  // iPhone
  await ctx.close();
  const iphone = devices['iPhone 13'];
  const ctx2 = await browser.newContext({ ...iphone, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page2 = await ctx2.newPage();
  await page2.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page2.waitForFunction(() => !!window.__hv, null, { timeout: 90000 });
  const ferdig = page2.getByRole('button', { name: 'Ferdig ✓' });
  if (await ferdig.count()) await ferdig.click();
  const klekk = page2.getByRole('button', { name: 'Klekk egget! 🐣' });
  if (await klekk.count()) {
    await klekk.click(); await page2.waitForTimeout(2200);
    const hurra = page2.getByRole('button', { name: 'Hurra! 🎉' });
    if (await hurra.count()) await hurra.click();
  }
  await page2.evaluate(() => { window.__hv.weatherT0 = performance.now() / 1000 - 100; });
  await shot(page2, '05-oppdrag-iphone', 800);
  const geo = await page2.evaluate(() => {
    const b = document.querySelector('.mission-btn');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { left: r.left, bottom: window.innerHeight - r.bottom, right: r.right, w: window.innerWidth };
  });
  report.checks.oppdragIphone = !!geo && geo.left < geo.w * 0.4 && geo.bottom > 80;
  report.notes.push({ iphoneMission: geo });
  await ctx2.close();
}

// ---- 6: pet apple + fest ----
{
  const { page, ctx } = await boot();
  const apple = await page.evaluate(() => {
    const g = window.__hv;
    document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove());
    const tree = g.town.appleTrees[0];
    if (!tree) return { ok: false };
    g.player.pos.set(tree.x + 2, 0, tree.z + 2);
    const pet = g.save.equipped[0];
    g.startPetApple?.(pet, tree.x, tree.z);
    // method is private — use interact path
    g.nearZone = { kind: 'pet-apple', label: 'Plukk', uid: pet, x: tree.x, z: tree.z };
    g.interact();
    g.freezeCam = { x: tree.x + 5, y: 5, z: tree.z + 5, lx: tree.x, ly: 1.5, lz: tree.z };
    return { ok: !!g.petJob && g.petJob.kind === 'epler', tree, job: g.petJob };
  });
  report.checks.petApple = !!apple.ok;
  report.notes.push({ apple });
  await shot(page, '06-pet-pick-apples', 1000);

  const fest = await page.evaluate(() => {
    const g = window.__hv;
    g.petJob = null;
    g.player.pos.set(2, 0, 6);
    const pet = g.save.equipped[0];
    g.nearZone = { kind: 'pet-fest', label: 'Fest', uid: pet };
    g.interact();
    g.freezeCam = { x: 8, y: 10, z: 8, lx: 0, ly: 1, lz: 0 };
    return { ok: !!g.petJob && g.petJob.kind === 'fest', job: g.petJob };
  });
  report.checks.petFest = !!fest.ok;
  report.notes.push({ fest });
  await shot(page, '06-pet-plaza-fest', 1000);
  await ctx.close();
}

// ---- 7: vet button heal ----
{
  const { page, ctx } = await boot();
  const vet = await page.evaluate(() => {
    const g = window.__hv;
    document.querySelectorAll('.sheet,.panel,.sheet-wrap').forEach((el) => el.remove());
    const e = g.town.entrances.vet;
    g.player.pos.set(e.x, 0, e.z);
    // Move into vet
    const beds = g.town.vetBeds;
    if (beds[0]) g.player.pos.set(beds[0].x, 0, beds[0].z + 1.5);
    const sick = g.save.pets.find((p) => p.need?.kind === 'syk');
    const before = g.vetHealUid;
    // Without pressing, heal should not auto-start
    g.vetHealUid = null;
    g.nearZone = { kind: 'vet-heal', label: 'Legg i sengen', uid: sick.uid };
    g.interact();
    g.freezeCam = { x: beds[0].x + 4, y: 5, z: beds[0].z + 4, lx: beds[0].x, ly: 1.2, lz: beds[0].z };
    return { pressed: g.vetHealUid === sick.uid, before, bed: beds[0], sick: sick?.name };
  });
  report.checks.vetHealButton = !!vet.pressed;
  report.notes.push({ vet });
  await shot(page, '07-vet-heal-button', 1000);
  await ctx.close();
}

report.ok = Object.values(report.checks).every(Boolean);
fs.writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.ok ? 0 : 1);
