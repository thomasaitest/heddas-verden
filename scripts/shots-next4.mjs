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

const chaseCam = (yaw, pitch = 0.38, dist = 11) => ({
  freezeCam: null,
  yaw,
  pitch,
  dist,
});

// ---- 1 + 4: car blocked by shop / bench ----
{
  const { page, ctx } = await boot();
  const shopBlock = await page.evaluate(() => {
    const g = window.__hv;
    document.querySelectorAll('.sheet,.panel,.sheet-wrap,.toast').forEach((el) => el.remove());
    g.driving = 'bil-rosa';
    g.syncVehicleMesh();
    g.resting = null;
    g.freezeCam = null;
    // Approach the shop's south face (door side) from outside so the wall fills the frame.
    const shop = { x: 38, z: -34 };
    const yaw = Math.PI; // face -Z into the shop
    g.player.yaw = yaw;
    const start = { x: shop.x, z: shop.z + 14 };
    g.player.pos.set(start.x, 0, start.z);
    const cols = { rects: [...g.town.rects, ...g.town.vehicleRects], circles: [...g.town.circles, ...g.town.vehicleCircles] };
    const R = 2.45;
    const blocked = (x, z) => {
      for (const b of cols.rects) {
        const cos = Math.cos(b.rot), sin = Math.sin(b.rot);
        const lx = (x - b.x) * cos - (z - b.z) * sin;
        const lz = (x - b.x) * sin + (z - b.z) * cos;
        if (Math.abs(lx) < b.hw + R && Math.abs(lz) < b.hd + R) return true;
      }
      for (const c of cols.circles) if (Math.hypot(x - c.x, z - c.z) < c.r + R) return true;
      return false;
    };
    let x = start.x, z = start.z, hits = 0, entered = false;
    for (let i = 0; i < 80; i++) {
      const nx = x + Math.sin(yaw) * 0.3;
      const nz = z + Math.cos(yaw) * 0.3;
      if (blocked(nx, nz)) { hits++; break; }
      x = nx; z = nz;
      if (g.town.insideBuilding(x, z) === 'shop') entered = true;
    }
    g.player.pos.set(x, 0, z);
    // Chase camera behind the car looking at the shop facade.
    g.cam.yaw = yaw + Math.PI;
    g.cam.pitch = 0.32;
    g.cam.dist = 12;
    g.camShown = 12;
    return { hits, entered, start, end: { x, z }, inside: g.town.insideBuilding(x, z) };
  });
  report.checks.carBlockedByShop = shopBlock.hits > 0 && !shopBlock.entered;
  report.notes.push({ shopBlock });
  await shot(page, '01-car-blocked-by-shop', 1100);

  const benchHit = await page.evaluate(() => {
    const g = window.__hv;
    g.freezeCam = null;
    g.driving = 'bil-rosa';
    g.syncVehicleMesh();
    const b = g.town.benches[0];
    if (!b) return { ok: false };
    const start = { x: b.x + Math.sin(b.yaw) * 7, z: b.z + Math.cos(b.yaw) * 7 };
    const towardYaw = Math.atan2(b.x - start.x, b.z - start.z);
    g.player.yaw = towardYaw;
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
    let x = start.x, z = start.z, hit = false;
    for (let i = 0; i < 50; i++) {
      const nx = x + Math.sin(towardYaw) * 0.3;
      const nz = z + Math.cos(towardYaw) * 0.3;
      if (blocked(nx, nz)) { hit = true; break; }
      x = nx; z = nz;
    }
    g.player.pos.set(x, 0, z);
    g.cam.yaw = towardYaw + Math.PI * 0.65;
    g.cam.pitch = 0.42;
    g.cam.dist = 10;
    g.camShown = 10;
    return { ok: hit, end: { x, z }, bench: b };
  });
  report.checks.carBlockedByBench = !!benchHit.ok;
  report.notes.push({ benchHit });
  await shot(page, '04-car-blocked-by-bench', 900);
  await ctx.close();
}

// ---- 2: pets ride in car (side angle, inside cabin) ----
{
  const { page, ctx } = await boot();
  await page.evaluate(() => {
    const g = window.__hv;
    document.querySelectorAll('.sheet,.panel,.sheet-wrap,.toast').forEach((el) => el.remove());
    // Prefer a mid-size dog for the canonical proof.
    const base = g.save.pets[0];
    const pet = { ...base, speciesId: 'hund', name: 'Hund', need: null, nextNeedAt: Date.now() + 600000 };
    g.commit({ ...g.save, pets: [pet], equipped: [pet.uid], bag: { ...g.save.bag, 'bil-rosa': 1 } }, { pets: true });
    g.driving = 'bil-rosa';
    g.syncVehicleMesh();
    g.player.pos.set(6, 0, 20);
    g.player.yaw = 0;
    // Side view across the cabin (passenger left).
    g.freezeCam = { x: 6 - 4.2, y: 2.35, z: 20 + 3.4, lx: 6 - 0.2, ly: 1.0, lz: 20.15 };
  });
  await page.waitForTimeout(700);
  const seatCheck = await page.evaluate(() => {
    const g = window.__hv;
    const p = g.player.pos;
    const yaw = g.player.yaw;
    const near = [];
    for (const [uid, a] of g.actors) {
      if (!g.save.equipped.includes(uid)) continue;
      const dx = a.pos.x - p.x, dz = a.pos.z - p.z;
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      const lat = cos * dx + sin * dz;
      const forward = sin * dx + cos * dz;
      near.push({
        uid,
        y: +a.pos.y.toFixed(2),
        lat: +lat.toFixed(2),
        forward: +forward.toFixed(2),
        pose: a.pose,
        scale: +a.rig.root.scale.x.toFixed(2),
        legsVisible: a.rig.legs.some((l) => l.visible),
      });
    }
    return { count: near.length, near };
  });
  report.checks.petsInCar = seatCheck.count >= 1 && seatCheck.near.every((n) =>
    Math.abs(n.lat) < 0.72 && n.forward > -0.05 && n.forward < 0.55 && n.pose === 'sit' && !n.legsVisible && n.y > 0.5);
  report.notes.push({ petsInCar: seatCheck });
  await shot(page, '02-pets-in-car', 1000);

  await page.evaluate(() => {
    const g = window.__hv;
    g.clearVehicle();
    g.freezeCam = null;
    g.cam.yaw = g.player.yaw + Math.PI * 0.85;
    g.cam.pitch = 0.4;
    g.cam.dist = 9;
    g.camShown = 9;
  });
  await shot(page, '02-pets-hop-out', 800);
  await ctx.close();
}

// ---- 3: stand in front of bench ----
{
  const { page, ctx } = await boot();
  const stand = await page.evaluate(() => {
    const g = window.__hv;
    document.querySelectorAll('.sheet,.panel,.sheet-wrap,.toast').forEach((el) => el.remove());
    const b = g.town.benches[1] || g.town.benches[0];
    g.resting = { x: b.x, z: b.z, yaw: b.yaw };
    g.player.pos.set(b.x, 0.18, b.z);
    g.player.yaw = b.yaw;
    g.nearZone = { kind: 'bench-off', label: 'Reis deg' };
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    g.interact?.();
    const after = { x: g.player.pos.x, z: g.player.pos.z };
    const dist = Math.hypot(after.x - b.x, after.z - b.z);
    const forwardDot = (after.x - b.x) * fx + (after.z - b.z) * fz;
    g.freezeCam = null;
    g.cam.yaw = b.yaw + Math.PI;
    g.cam.pitch = 0.35;
    g.cam.dist = 8;
    g.camShown = 8;
    return { after, dist, forwardDot, bench: b, resting: g.resting };
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
    document.querySelectorAll('.sheet,.panel,.sheet-wrap,.toast').forEach((el) => el.remove());
    window.__hv.freezeCam = null;
    window.__hv.player.pos.set(0, 0, 14);
    window.__hv.cam.yaw = Math.PI;
    window.__hv.cam.pitch = 0.4;
    window.__hv.cam.dist = 12;
    window.__hv.camShown = 12;
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

// ---- 6: pet apple + fest (visible action, not toast-only) ----
{
  const { page, ctx } = await boot();
  const apple = await page.evaluate(() => {
    const g = window.__hv;
    document.querySelectorAll('.sheet,.panel,.sheet-wrap,.toast').forEach((el) => el.remove());
    // Prefer a tree near plaza/spawn for a readable frame.
    const trees = g.town.appleTrees;
    let tree = trees[0];
    let best = 1e9;
    for (const t of trees) {
      const d = Math.hypot(t.x, t.z - 20);
      if (d < best) { best = d; tree = t; }
    }
    if (!tree) return { ok: false };
    const pet = g.save.equipped[0];
    g.player.pos.set(tree.x + 2.2, 0, tree.z + 3.5);
    g.player.yaw = Math.atan2(tree.x - g.player.pos.x, tree.z - g.player.pos.z);
    g.nearZone = { kind: 'pet-apple', label: 'Plukk', uid: pet, x: tree.x, z: tree.z };
    g.interact();
    // Force pet already up in the canopy for the proof frame.
    const a = g.actors.get(pet);
    if (a) {
      a.pos.set(tree.x, 1.35, tree.z);
      a.care = { x: tree.x, z: tree.z, y: 1.35, pose: 'happy' };
      a.pose = 'happy';
    }
    g.freezeCam = null;
    g.cam.yaw = g.player.yaw + Math.PI * 0.9;
    g.cam.pitch = 0.45;
    g.cam.dist = 9;
    g.camShown = 9;
    return { ok: !!g.petJob && g.petJob.kind === 'epler', tree, job: g.petJob, petY: a?.pos.y };
  });
  report.checks.petApple = !!apple.ok && (apple.petY ?? 0) > 0.8;
  report.notes.push({ apple });
  await shot(page, '06-pet-pick-apples', 1100);

  const fest = await page.evaluate(() => {
    const g = window.__hv;
    document.querySelectorAll('.toast').forEach((el) => el.remove());
    g.petJob = null;
    g.player.pos.set(2, 0, 8);
    const pet = g.save.equipped[0];
    g.nearZone = { kind: 'pet-fest', label: 'Fest', uid: pet };
    g.interact();
    const a = g.actors.get(pet);
    if (a) {
      a.pos.set(4.0, 0, 3.0);
      a.care = { x: 4.0, z: 3.0, y: 0, pose: 'happy' };
      a.pose = 'happy';
      a.happyUntil = g.time + 8;
    }
    g.freezeCam = null;
    // Slightly lower so dancing avatar + pet + fountain fill the frame.
    g.cam.yaw = 0.7;
    g.cam.pitch = 0.48;
    g.cam.dist = 12;
    g.camShown = 12;
    return {
      ok: !!g.petJob && g.petJob.kind === 'fest' && g.activity?.kind === 'dance',
      job: g.petJob,
      activity: g.activity?.kind,
      petAt: a ? { x: a.pos.x, z: a.pos.z } : null,
    };
  });
  await page.waitForTimeout(600); // let activityPose place the dancer
  report.checks.petFest = !!fest.ok;
  report.notes.push({ fest });
  await shot(page, '06-pet-plaza-fest', 1200);
  await ctx.close();
}

// ---- 7: vet heal — button, pet in bed, healed ----
{
  const { page, ctx } = await boot();
  // 07a: inside vet with heal button visible (before press)
  const vetBtn = await page.evaluate(() => {
    const g = window.__hv;
    document.querySelectorAll('.sheet,.panel,.sheet-wrap,.toast').forEach((el) => el.remove());
    const bed = g.town.vetBeds[1] || g.town.vetBeds[0]; // mid bed
    if (!bed) return { ok: false };
    const sick = g.save.pets.find((p) => p.need?.kind === 'syk');
    g.vetHealUid = null;
    g.driving = null;
    g.clearVehicle?.();
    // Centre of the vet (roof lifts). Beds are at z≈33; building centre z=30.
    g.player.pos.set(38, 0, 30.5);
    g.player.yaw = 0; // look toward beds (+Z with rot PI world)
    const a = g.actors.get(sick.uid);
    if (a) {
      a.pos.set(39.2, 0, 30.8);
      a.care = null;
      a.pose = 'sick';
    }
    const label = 'Dyret legger seg i sengen for å bli friskt 🛏️';
    g.nearZone = { kind: 'vet-heal', label, uid: sick.uid };
    g.hud.setPrompt(label);
    // Look at the bed row from inside; roof is lifted while insideBuilding === 'vet'.
    g.freezeCam = { x: 38, y: 6.5, z: 26.5, lx: 38, ly: 1.0, lz: 32.5 };
    return {
      ok: g.town.insideBuilding(g.player.pos.x, g.player.pos.z) === 'vet',
      bed,
      sick: sick?.name,
      prompt: g.hud.prompt.textContent,
      promptHidden: g.hud.prompt.classList.contains('hidden'),
      inside: g.town.insideBuilding(g.player.pos.x, g.player.pos.z),
    };
  });
  await page.waitForTimeout(500);
  const promptLive = await page.evaluate(() => ({
    text: window.__hv.hud.prompt.textContent,
    hidden: window.__hv.hud.prompt.classList.contains('hidden'),
    near: window.__hv.nearZone?.kind,
  }));
  report.notes.push({ vetBtn, promptLive });
  report.checks.vetHealButton = !!vetBtn.ok && /sengen|friskt/i.test(promptLive.text || vetBtn.prompt || '') && !promptLive.hidden;
  await shot(page, '07-vet-heal-button', 900);

  // 07b: press heal → pet lying in bed
  await page.evaluate(() => {
    const g = window.__hv;
    document.querySelectorAll('.toast').forEach((el) => el.remove());
    const sick = g.save.pets.find((p) => p.need?.kind === 'syk');
    g.nearZone = { kind: 'vet-heal', label: 'Dyret legger seg i sengen for å bli friskt 🛏️', uid: sick.uid };
    g.interact();
  });
  await page.waitForTimeout(400);
  const vetBed = await page.evaluate(() => {
    const g = window.__hv;
    const sick = g.save.pets.find((p) => p.need?.kind === 'syk') || g.save.pets.find((p) => p.uid === g.vetHealUid);
    const bed = g.town.vetBeds[1] || g.town.vetBeds[0];
    const a = g.actors.get(sick.uid);
    // Keep pet glued in the bed for the proof frame (sleep pose, on mattress).
    if (a) {
      a.pos.set(bed.x, bed.y, bed.z);
      a.care = { x: bed.x, z: bed.z, y: bed.y, pose: 'sleep' };
      a.pose = 'sleep';
      a.yaw = 0;
    }
    g.player.pos.set(38, 0, 29.5);
    g.hud.setPrompt(null); // button already pressed — show pet in bed
    g.freezeCam = { x: bed.x - 0.2, y: 5.2, z: bed.z - 5.5, lx: bed.x, ly: 1.2, lz: bed.z };
    return {
      pressed: g.vetHealUid === sick.uid,
      petPose: a?.pose,
      petY: a?.pos.y,
      bed,
      inside: g.town.insideBuilding(g.player.pos.x, g.player.pos.z),
    };
  });
  // Re-snap immediately before capture so updatePets cannot walk the pet off.
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const g = window.__hv;
    const bed = g.town.vetBeds[1] || g.town.vetBeds[0];
    const a = g.actors.get(g.vetHealUid);
    if (a && bed) {
      a.pos.set(bed.x, bed.y, bed.z);
      a.care = { x: bed.x, z: bed.z, y: bed.y, pose: 'sleep' };
      a.pose = 'sleep';
    }
  });
  report.checks.vetPetInBed = !!vetBed.pressed && vetBed.petPose === 'sleep' && (vetBed.petY ?? 0) > 0.5;
  report.notes.push({ vetBed });
  await shot(page, '07-vet-pet-in-bed', 900);

  // 07c: healed — sick need cleared, bubble gone
  const vetHealed = await page.evaluate(() => {
    const g = window.__hv;
    document.querySelectorAll('.toast').forEach((el) => el.remove());
    const sickUid = g.save.equipped[0];
    const now = Date.now();
    const pets = g.save.pets.map((p) =>
      p.uid === sickUid ? { ...p, need: null, nextNeedAt: now + 600_000, lastNeed: 'syk' } : p,
    );
    g.commit({ ...g.save, pets }, { pets: true });
    g.vetHealUid = null;
    const a = g.actors.get(sickUid);
    const bed = g.town.vetBeds[1] || g.town.vetBeds[0];
    if (a) {
      a.care = null;
      a.pos.set(bed.x + 1.2, 0, bed.z - 1.2);
      a.pose = 'happy';
      a.happyUntil = g.time + 3;
      a.bubble.visible = false;
      a.bubbleKind = null;
    }
    g.player.pos.set(38, 0, 29.5);
    g.hud.setPrompt(null);
    g.freezeCam = { x: 38, y: 5.8, z: 26.8, lx: 39, ly: 1.0, lz: 31.5 };
    const pet = g.save.pets.find((p) => p.uid === sickUid);
    return { needGone: !pet?.need, bubble: a?.bubble.visible, needKind: pet?.need?.kind ?? null };
  });
  report.checks.vetHealed = !!vetHealed.needGone && !vetHealed.bubble;
  report.notes.push({ vetHealed });
  await shot(page, '07-vet-healed', 1000);
  await ctx.close();
}

report.ok = Object.values(report.checks).every(Boolean);
fs.writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.ok ? 0 : 1);
