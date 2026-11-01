// Per-species cabin seat proofs. Usage: node scripts/shots-pets-in-car.mjs [url] [outDir]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4760/';
const out = process.argv[3] ?? '/workspace/heddas-verden-shots/next4';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const ctx = await browser.newContext({ viewport: { width: 1100, height: 720 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForFunction(() => !!window.__hv, null, { timeout: 90000 });
const ferdig = page.getByRole('button', { name: 'Ferdig ✓' });
if (await ferdig.count()) await ferdig.click();
const klekk = page.getByRole('button', { name: 'Klekk egget! 🐣' });
if (await klekk.count()) {
  await klekk.click();
  await page.waitForTimeout(2200);
  const hurra = page.getByRole('button', { name: 'Hurra! 🎉' });
  if (await hurra.count()) await hurra.click();
}
await page.evaluate(() => {
  window.__hv.weatherT0 = performance.now() / 1000 - 100;
});

const speciesList = await page.evaluate(() => {
  // SPECIES is not on window — rebuild from equipped pet by reading via a probe commit
  // Expose via temporary: import isn't available. Use known list from game save path.
  return null;
});

// Fetch species ids from the built module via page by committing each from a hardcoded list
// matching src/logic/pets.ts SPECIES ids.
const SPECIES = [
  'hund', 'katt', 'kanin', 'kylling', 'gris', 'skilpadde', 'marihone',
  'rev', 'panda', 'pingvin', 'dalmatiner', 'hest', 'bie', 'koala',
  'ugle', 'isbjorn', 'snoleopard', 'polarrev', 'papegoye', 'enhjorning-baby',
  'enhjorning', 'trex', 'kenguru', 'flamingo', 'gullkatt',
  'drage', 'isdrage', 'pegasus', 'fenix', 'regnbuedino',
];

const report = { ok: true, species: [], fails: [] };

async function setSpecies(id) {
  return page.evaluate((speciesId) => {
    const g = window.__hv;
    document.querySelectorAll('.sheet,.panel,.sheet-wrap,.toast').forEach((el) => el.remove());
    const names = {
      hund: 'Hund', katt: 'Katt', kanin: 'Kanin', kylling: 'Kylling', gris: 'Gris',
      skilpadde: 'Skilpadde', marihone: 'Marihøne', rev: 'Rev', panda: 'Panda',
      pingvin: 'Pingvin', dalmatiner: 'Dalmatiner', hest: 'Hest', bie: 'Bie', koala: 'Koala',
      ugle: 'Ugle', isbjorn: 'Isbjørn', snoleopard: 'Snøleopard', polarrev: 'Polarrev',
      papegoye: 'Papegøye', 'enhjorning-baby': 'Ponni', enhjorning: 'Enhjørning',
      trex: 'T-rex', kenguru: 'Kenguru', flamingo: 'Flamingo', gullkatt: 'Gullkatt',
      drage: 'Drage', isdrage: 'Isdrage', pegasus: 'Pegasus', fenix: 'Føniks', regnbuedino: 'Regnbue-dino',
    };
    const base = g.save.pets[0] || {
      uid: 'pet-cabin',
      xp: 5,
      need: null,
      nextNeedAt: Date.now() + 600000,
      lastNeed: null,
      flyable: false,
      rideable: false,
    };
    const pet = {
      ...base,
      uid: base.uid || 'pet-cabin',
      speciesId,
      name: names[speciesId] || speciesId,
      flyable: /drage|fenix|pegasus|ugle|papegoye|flamingo|bie|marihone|enhjorning/.test(speciesId),
      rideable: /hest|trex|drage|pegasus|enhjorning|isbjorn|kenguru|regnbuedino/.test(speciesId),
      need: null,
      nextNeedAt: Date.now() + 600000,
    };
    g.commit(
      { ...g.save, pets: [pet], equipped: [pet.uid], bucks: 5000, bag: { ...g.save.bag, 'bil-rosa': 1 } },
      { pets: true },
    );
    g.driving = 'bil-rosa';
    g.syncVehicleMesh();
    g.player.pos.set(6, 0, 20);
    g.player.yaw = 0;
    return { uid: pet.uid, speciesId };
  }, id);
}

async function seatMetrics() {
  return page.evaluate(() => {
    const g = window.__hv;
    const p = g.player.pos;
    const yaw = g.player.yaw;
    const uid = g.save.equipped[0];
    const a = g.actors.get(uid);
    if (!a) return null;
    const dx = a.pos.x - p.x;
    const dz = a.pos.z - p.z;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    // local: forward = sin*x?  world from local: x = sin*f + cos*lat, z = cos*f - sin*lat
    // invert: lat = cos*dx - (-sin)*dz = cos*dx + sin*dz
    // forward = sin*dx + cos*dz
    const lat = cos * dx + sin * dz;
    const forward = sin * dx + cos * dz;
    const legsVisible = a.rig.legs.some((l) => l.visible);
    return {
      lat: +lat.toFixed(3),
      forward: +forward.toFixed(3),
      y: +a.pos.y.toFixed(3),
      pose: a.pose,
      scale: +a.rig.root.scale.x.toFixed(3),
      legsVisible,
      doorOk: Math.abs(lat) < 0.72,
      seatRowOk: forward > -0.05 && forward < 0.55,
    };
  });
}

for (const id of SPECIES) {
  await setSpecies(id);
  // Side angle: camera on passenger side looking across cabin
  await page.evaluate(() => {
    const g = window.__hv;
    // 3/4 from passenger-front so depth shows pet left of driver, inside cabin.
    g.freezeCam = { x: 6 - 4.2, y: 2.35, z: 20 + 3.4, lx: 6 - 0.2, ly: 1.0, lz: 20.15 };
  });
  await page.waitForTimeout(450);
  const m = await seatMetrics();
  await page.screenshot({ path: `${out}/02-pets-in-car-${id}.png` });
  // Chase angle
  await page.evaluate(() => {
    const g = window.__hv;
    g.freezeCam = { x: 6, y: 3.2, z: 20 - 7.2, lx: 6, ly: 1.0, lz: 20.2 };
  });
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${out}/02-pets-in-car-${id}-chase.png` });
  const pass = !!m && m.doorOk && m.seatRowOk && m.pose === 'sit' && !m.legsVisible && m.scale <= 0.52;
  report.species.push({ id, pass, ...m });
  if (!pass) {
    report.ok = false;
    report.fails.push({ id, m });
  }
  console.log(pass ? 'ok' : 'FAIL', id, JSON.stringify(m));
}

fs.writeFileSync(`${out}/02-pets-in-car-results.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: report.ok, fails: report.fails.length, count: report.species.length }, null, 2));
await browser.close();
process.exit(report.ok ? 0 : 1);
