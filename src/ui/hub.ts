import { musicPlaying, setSoundEnabled, sfx, startMusic, stopMusic } from '../audio.ts';
import { itemArt, windowScene } from '../art/furniture.ts';
import { FLOORS, ITEM_BY_ID, PALETTE, WALL_COLORS, WALL_PATTERNS } from '../logic/catalog.ts';
import { canEdit, placeItem, removeItem, updateItem, type House, type PlacedItem } from '../logic/house.ts';
import { CARE_INFO, FURNITURE_ACTION, NEED_INFO, care, stageOf, tickNeed, type CareAction, type NeedKind, type PetState } from '../logic/needs.ts';
import { activeHouse, addEggPet, save, subscribe, update } from '../store.ts';
import { burst, esc, floatText, h, modal, toast } from './dom.ts';
import { growthBar, petDetails } from './collection.ts';
import { petFace, petName } from './petArt.ts';
import { rideScene } from './ride.ts';
import { go } from './router.ts';

type Mode = 'idle' | 'walk' | 'hop' | 'sit' | 'sleep' | 'dance' | 'eat' | 'drink' | 'bath' | 'play' | 'walkies' | 'drag';
interface PetSim {
  x: number;
  y: number;
  mode: Mode;
  busyUntil: number;
  facing: 1 | -1;
  lastNeed?: NeedKind;
}

const MAX_PETS_SHOWN = 8;
const MODE_EMOTE: Partial<Record<Mode, string>> = { sleep: '💤', eat: '🍎', drink: '💧', bath: '🫧', play: '🧸', walkies: '🌳', dance: '🎵' };
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function mountHub(root: HTMLElement): () => void {
  const sims = new Map<string, PetSim>();
  let selectedItem: string | null = null;
  let selectedPet: string | null = null;
  let tab: 'care' | 'things' = 'care';
  let partyUntil = 0;

  const el = h(
    'div',
    { class: 'screen hub' },
    `<div class="hub-top">
      <div class="logo"><span class="logo-paw">🐾</span> Pet Doors</div>
      <div class="house-chips"></div>
      <div class="pts-pill big"></div>
      <button class="btn round sound" aria-label="Lyd"></button>
    </div>
    <div class="room-wrap">
      <div class="room">
        <div class="wall"><div class="window"></div><div class="window w2"></div><div class="style-deco"></div></div>
        <div class="floor"></div>
        <div class="layer items"></div>
        <div class="layer pets"></div>
        <div class="disco"></div>
        <div class="owner-tag">👑 Ditt hus</div>
      </div>
      <div class="side-btns">
        <button class="side-btn play" data-go="minispill"><span>🚪</span>Minispill</button>
        <button class="side-btn pets" data-go="dyr"><span>🐾</span>Dyr</button>
        <button class="side-btn shop" data-go="butikk"><span>🛍️</span>Butikk</button>
        <button class="side-btn design"><span>🎨</span>Design</button>
      </div>
    </div>
    <div class="hub-bottom"></div>`,
  );
  root.append(el);
  const room = el.querySelector<HTMLElement>('.room')!;
  const itemsLayer = el.querySelector<HTMLElement>('.layer.items')!;
  const petsLayer = el.querySelector<HTMLElement>('.layer.pets')!;
  const bottom = el.querySelector<HTMLElement>('.hub-bottom')!;

  const house = (): House => activeHouse();
  const editable = () => canEdit(house(), save.playerId);
  const shownPets = (): PetState[] => {
    const f = save.pets.filter((p) => p.uid === save.followerUid);
    const rest = save.pets.filter((p) => p.uid !== save.followerUid).sort((a, b) => b.obtainedAt - a.obtainedAt);
    return [...f, ...rest].slice(0, MAX_PETS_SHOWN);
  };
  const setHouse = (fn: (h: House) => House) =>
    update((s) => ({ ...s, houses: s.houses.map((x) => (x.id === s.activeHouseId ? fn(x) : x)) }));

  function toRoom(e: PointerEvent): { x: number; y: number } {
    const r = room.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  }

  // ---------- top ----------
  function renderTop(): void {
    el.querySelector('.pts-pill')!.innerHTML = `🪙 ${save.points}`;
    el.querySelector('.sound')!.textContent = save.sound ? '🔊' : '🔇';
    el.querySelector('.house-chips')!.innerHTML = save.houses
      .map((x) => `<button class="chip ${x.id === save.activeHouseId ? 'on' : ''}" data-house="${x.id}">${{ cottage: '🏡', apartment: '🏢', farmhouse: '🚜', treehouse: '🌳' }[x.style]} ${esc(x.name)}</button>`)
      .join('');
    el.querySelectorAll<HTMLElement>('[data-house]').forEach((b) =>
      b.addEventListener('click', () => {
        if (b.dataset.house === save.activeHouseId) return;
        sfx.pop();
        selectedItem = null;
        update((s) => ({ ...s, activeHouseId: b.dataset.house! }));
        renderRoom();
        syncItems();
        scatterPets();
        renderBottom();
        renderTop();
      }),
    );
  }

  // ---------- room ----------
  function renderRoom(): void {
    const hs = house();
    room.className = `room style-${hs.style}`;
    const wall = el.querySelector<HTMLElement>('.wall')!;
    wall.className = `wall pattern-${hs.wallPattern}`;
    wall.style.setProperty('--wall', hs.wallColor);
    el.querySelector('.floor')!.className = `floor floor-${hs.floor}`;
    el.querySelector('.window')!.innerHTML = windowScene(hs.style);
    el.querySelector('.window.w2')!.innerHTML = hs.style === 'apartment' ? windowScene(hs.style) : '';
  }

  function itemEl(it: PlacedItem): HTMLElement {
    const def = ITEM_BY_ID[it.itemId];
    const node = h('div', { class: `item ${def.flat ? 'flat' : ''} ${def.wall ? 'onwall' : ''} it-${it.itemId}`, 'data-uid': it.uid });
    node.addEventListener('pointerdown', (e) => startItemDrag(e, it.uid));
    return node;
  }

  function syncItems(): void {
    const items = house().items;
    const keep = new Set(items.map((i) => i.uid));
    itemsLayer.querySelectorAll<HTMLElement>('.item').forEach((n) => !keep.has(n.dataset.uid!) && n.remove());
    for (const it of items) {
      let node = itemsLayer.querySelector<HTMLElement>(`[data-uid="${it.uid}"]`);
      if (!node) {
        node = itemEl(it);
        itemsLayer.append(node);
      }
      const def = ITEM_BY_ID[it.itemId];
      if (node.dataset.color !== it.color) {
        node.innerHTML = itemArt(it.itemId, it.color);
        node.dataset.color = it.color;
      }
      node.style.left = `${it.x}%`;
      node.style.top = `${it.y}%`;
      node.style.width = `${def.size * it.scale}%`;
      node.style.zIndex = String(def.flat ? 1 : def.wall ? 2 : 10 + Math.round(it.y));
      node.classList.toggle('selected', it.uid === selectedItem);
    }
  }

  // ---------- pets ----------
  function sim(uid: string): PetSim {
    let s = sims.get(uid);
    if (!s) {
      s = { x: rand(15, 85), y: rand(68, 92), mode: 'idle', busyUntil: Date.now() + rand(300, 1500), facing: 1 };
      sims.set(uid, s);
    }
    return s;
  }

  function scatterPets(): void {
    for (const s of sims.values()) {
      s.x = rand(15, 85);
      s.y = rand(68, 92);
      s.mode = 'idle';
    }
    syncPets(true);
  }

  function petEl(p: PetState): HTMLElement {
    const node = h(
      'div',
      { class: 'pet', 'data-uid': p.uid },
      `<div class="bubble"></div><div class="emote"></div><div class="pet-body">${petFace(p.speciesId)}</div><div class="pet-shadow"></div><div class="pet-label"></div>`,
    );
    node.addEventListener('pointerdown', (e) => startPetDrag(e, p.uid));
    return node;
  }

  function syncPets(instant = false): void {
    const pets = shownPets();
    const keep = new Set(pets.map((p) => p.uid));
    petsLayer.querySelectorAll<HTMLElement>('.pet').forEach((n) => !keep.has(n.dataset.uid!) && n.remove());
    for (const p of pets) {
      const s = sim(p.uid);
      let node = petsLayer.querySelector<HTMLElement>(`.pet[data-uid="${p.uid}"]`);
      if (!node) {
        node = petEl(p);
        petsLayer.append(node);
        instant = true;
      }
      if (instant) node.classList.add('no-move');
      node.style.left = `${s.x}%`;
      node.style.top = `${s.y}%`;
      node.style.zIndex = String(10 + Math.round(s.y) + (s.mode === 'sleep' || s.mode === 'bath' ? 40 : 0));
      node.style.setProperty('--scale', String(stageOf(p.growth).scale));
      node.style.setProperty('--face', String(s.facing));
      node.className = `pet mode-${s.mode} ${p.uid === save.followerUid ? 'follower' : ''} ${p.uid === selectedPet ? 'selected' : ''} ${instant ? 'no-move' : ''}`;
      const bubble = node.querySelector<HTMLElement>('.bubble')!;
      bubble.innerHTML = p.need ? `<span>${NEED_INFO[p.need].emoji}</span>` : '';
      bubble.classList.toggle('show', !!p.need && s.mode !== 'drag');
      node.querySelector('.emote')!.textContent = MODE_EMOTE[s.mode] ?? '';
      node.querySelector('.pet-label')!.innerHTML = `${p.uid === save.followerUid ? '⭐ ' : ''}${stageOf(p.growth).name}`;
      if (instant) requestAnimationFrame(() => requestAnimationFrame(() => node!.classList.remove('no-move')));
    }
  }

  function moveTo(uid: string, x: number, y: number, mode: Mode = 'walk', busyMs = 2400): void {
    const s = sim(uid);
    if (Math.abs(x - s.x) > 1) s.facing = x > s.x ? -1 : 1;
    s.x = clamp(x, 4, 96);
    s.y = clamp(y, 62, 97);
    s.mode = mode;
    s.busyUntil = Date.now() + busyMs;
  }

  function itemRect(itemId: string): { uid: string; x: number; y: number; w: number; h: number } | null {
    const list = house().items.filter((i) => i.itemId === itemId || (itemId === 'anybed' && FURNITURE_ACTION[i.itemId] === 'sleep'));
    if (!list.length) return null;
    const it = list[Math.floor(Math.random() * list.length)];
    const node = itemsLayer.querySelector<HTMLElement>(`[data-uid="${it.uid}"]`);
    const rr = room.getBoundingClientRect();
    if (!node || !rr.width) return null;
    const r = node.getBoundingClientRect();
    return { uid: it.uid, x: ((r.left - rr.left) / rr.width) * 100, y: ((r.top - rr.top) / rr.height) * 100, w: (r.width / rr.width) * 100, h: (r.height / rr.height) * 100 };
  }

  /** Pick a spot on top of an item (bed, dance floor) for a pet to stand on. */
  function spotOn(itemId: string): { x: number; y: number } | null {
    const r = itemRect(itemId);
    if (!r) return null;
    return { x: r.x + r.w * rand(0.3, 0.7), y: r.y + r.h * (ITEM_BY_ID[house().items.find((i) => i.uid === r.uid)!.itemId].flat ? rand(0.45, 0.8) : 0.75) };
  }

  function onDanceFloor(s: PetSim): boolean {
    const rr = room.getBoundingClientRect();
    return [...itemsLayer.querySelectorAll<HTMLElement>('.it-dancefloor')].some((n) => {
      const r = n.getBoundingClientRect();
      const px = rr.left + (s.x / 100) * rr.width;
      const py = rr.top + (s.y / 100) * rr.height;
      return px > r.left && px < r.right && py > r.top && py < r.bottom;
    });
  }

  function idleBehaviour(p: PetState, s: PetSim, now: number): void {
    const roll = Math.random();
    const hasFloor = house().items.some((i) => i.itemId === 'dancefloor');
    const hasBed = house().items.some((i) => FURNITURE_ACTION[i.itemId] === 'sleep');
    if (roll < 0.12 && hasFloor) {
      const spot = spotOn('dancefloor');
      if (spot) return moveTo(p.uid, spot.x, spot.y, 'walk', 2400);
    }
    if (roll < 0.2 && hasBed && !p.need) {
      const spot = spotOn('anybed');
      if (spot) {
        moveTo(p.uid, spot.x, spot.y, 'walk', 2400);
        setTimeout(() => {
          const t = sims.get(p.uid);
          if (t && t.mode === 'walk') Object.assign(t, { mode: 'sleep', busyUntil: Date.now() + 5000 });
        }, 2300);
        return;
      }
    }
    if (onDanceFloor(s) && roll < 0.6) {
      s.mode = 'dance';
      s.busyUntil = now + 3500;
      return;
    }
    if (roll < 0.55) return moveTo(p.uid, rand(8, 92), rand(66, 95), 'walk', 2400);
    if (roll < 0.75) {
      s.mode = 'hop';
      s.busyUntil = now + 1200;
      return;
    }
    s.mode = 'sit';
    s.busyUntil = now + rand(1500, 3000);
  }

  function tick(): void {
    const now = Date.now();
    const pets = shownPets();
    let changed = false;
    const next = save.pets.map((p) => {
      if (!pets.includes(p)) return p;
      const t = tickNeed(p, now, Math.random, sims.get(p.uid)?.lastNeed);
      if (t !== p) changed = true;
      return t;
    });
    if (changed) {
      update((s) => ({ ...s, pets: next }));
      sfx.pop();
    }
    for (const p of shownPets()) {
      const s = sim(p.uid);
      if (s.mode === 'drag' || now < s.busyUntil) continue;
      if (now < partyUntil && onDanceFloor(s)) {
        s.mode = 'dance';
        s.busyUntil = now + 1000;
        continue;
      }
      if (p.uid === save.followerUid && Math.random() < 0.4) {
        s.mode = 'sit';
        s.busyUntil = now + 1500;
        continue;
      }
      idleBehaviour(p, s, now);
    }
    if (musicPlaying() && now > partyUntil) stopMusic();
    syncPets();
    room.classList.toggle('party', [...sims.values()].some((s) => s.mode === 'dance'));
  }

  // ---------- care ----------
  function careFor(uid: string, action: CareAction, viaItem?: { x: number; y: number }): void {
    const p = save.pets.find((x) => x.uid === uid);
    if (!p) return;
    const node = petsLayer.querySelector<HTMLElement>(`.pet[data-uid="${uid}"]`);
    const r = node?.getBoundingClientRect();
    const cx = r ? r.left + r.width / 2 : innerWidth / 2;
    const cy = r ? r.top : innerHeight / 2;
    const oldNeed = p.need;
    const res = care(p, action, Date.now(), Math.random);
    const s = sim(uid);
    if (!res.ok) {
      sfx.nope();
      node?.classList.add('nope');
      setTimeout(() => node?.classList.remove('nope'), 600);
      toast(p.need ? `${petName(p)}: «${NEED_INFO[p.need].text}»` : `${petName(p)} er fornøyd akkurat nå 💖`);
      return;
    }
    s.lastNeed = oldNeed ?? undefined;
    update((x) => ({ ...x, points: x.points + res.points, pets: x.pets.map((q) => (q.uid === uid ? res.pet : q)), stats: { ...x.stats, needs: x.stats.needs + 1 } }));
    sfx.care();
    setTimeout(() => sfx.coin(), 250);
    floatText(cx, cy - 20, `+${res.points} 🪙`);
    burst(cx, cy + 20, ['💖', '✨', CARE_INFO[action].emoji], 8);
    const modeFor: Record<CareAction, Mode> = { food: 'eat', water: 'drink', sleep: 'sleep', bath: 'bath', toy: 'play', walk: 'walkies' };
    if (action === 'sleep' && !viaItem) {
      const spot = spotOn('anybed');
      if (spot) moveTo(uid, spot.x, spot.y, 'walk', 2300);
      setTimeout(() => Object.assign(sim(uid), { mode: 'sleep', busyUntil: Date.now() + 6000 }) && syncPets(), spot ? 2300 : 0);
    } else if (action === 'bath' && !viaItem) {
      const spot = spotOn('bathtub');
      if (spot) moveTo(uid, spot.x, spot.y, 'walk', 2300);
      setTimeout(() => Object.assign(sim(uid), { mode: 'bath', busyUntil: Date.now() + 3500 }) && syncPets(), spot ? 2300 : 0);
    } else if (action === 'walk') {
      if (p.flyable || p.rideable) {
        void rideScene(p, p.flyable ? 'fly' : 'ride');
      } else {
        const y = s.y;
        moveTo(uid, 6, y, 'walkies', 2400);
        setTimeout(() => moveTo(uid, 92, y, 'walkies', 2400), 2400);
        setTimeout(() => moveTo(uid, 50, y, 'walkies', 2400), 4800);
      }
    } else {
      s.mode = modeFor[action];
      s.busyUntil = Date.now() + (action === 'sleep' ? 6000 : 2200);
    }
    if (res.grewUp) {
      setTimeout(() => {
        sfx.grow();
        toast(`🎉 ${petName(p)} har vokst og er nå ${stageOf(res.pet.growth).name}! +15 🪙`, 'big');
        burst(cx, cy, ['⭐', '🎉', '💖', '🌟'], 16);
      }, 700);
    }
    syncPets();
    renderBottom();
  }

  function careTarget(action: CareAction): string | null {
    const pets = shownPets();
    if (selectedPet && pets.some((p) => p.uid === selectedPet)) return selectedPet;
    const match = pets.find((p) => p.need && NEED_INFO[p.need].action === action);
    return match?.uid ?? pets.find((p) => p.need)?.uid ?? pets[0]?.uid ?? null;
  }

  function startToolDrag(e: PointerEvent, action: CareAction): void {
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    let ghost: HTMLElement | null = null;
    const move = (ev: PointerEvent) => {
      if (!ghost && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) {
        ghost = h('div', { class: 'drag-ghost' }, CARE_INFO[action].emoji);
        document.body.append(ghost);
      }
      if (ghost) {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
      }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (ghost) {
        ghost.remove();
        const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('.pet');
        if (target) careFor(target.dataset.uid!, action);
        else sfx.tap();
        return;
      }
      const uid = careTarget(action);
      if (!uid) return toast('Du har ingen dyr ennå. Spill minispillet for å vinne et! 🥚');
      careFor(uid, action);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  // ---------- dragging ----------
  function startPetDrag(e: PointerEvent, uid: string): void {
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY };
    let dragging = false;
    const s = sim(uid);
    const node = petsLayer.querySelector<HTMLElement>(`.pet[data-uid="${uid}"]`)!;
    const move = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) {
        dragging = true;
        s.mode = 'drag';
        node.classList.add('no-move');
      }
      if (dragging) {
        const p = toRoom(ev);
        s.x = clamp(p.x, 2, 98);
        s.y = clamp(p.y + 4, 40, 98);
        node.style.left = `${s.x}%`;
        node.style.top = `${s.y}%`;
        node.style.zIndex = '200';
        node.className = `pet mode-drag no-move ${uid === save.followerUid ? 'follower' : ''}`;
      }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!dragging) {
        sfx.pop();
        selectedPet = selectedPet === uid ? null : uid;
        selectedItem = null;
        tab = 'care';
        node.classList.add('hop-once');
        setTimeout(() => node.classList.remove('hop-once'), 500);
        syncItems();
        syncPets();
        renderBottom();
        return;
      }
      node.classList.remove('no-move');
      // Dropped on furniture that fulfils a need?
      node.style.pointerEvents = 'none';
      const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('.item');
      node.style.pointerEvents = '';
      const itemId = under ? house().items.find((i) => i.uid === under.dataset.uid)?.itemId : undefined;
      const action = itemId ? FURNITURE_ACTION[itemId] : undefined;
      s.y = clamp(s.y, 60, 98);
      s.mode = 'sit';
      s.busyUntil = Date.now() + 2500;
      const pet = save.pets.find((p) => p.uid === uid);
      if (action && pet?.need && NEED_INFO[pet.need].action === action) careFor(uid, action, { x: s.x, y: s.y });
      else if (action === 'sleep') Object.assign(s, { mode: 'sleep', busyUntil: Date.now() + 4000 });
      else if (itemId === 'dancefloor') Object.assign(s, { mode: 'dance', busyUntil: Date.now() + 4000 });
      syncPets();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  function startItemDrag(e: PointerEvent, uid: string): void {
    if (!editable()) return;
    e.preventDefault();
    e.stopPropagation();
    const it = house().items.find((i) => i.uid === uid);
    if (!it) return;
    const def = ITEM_BY_ID[it.itemId];
    const node = itemsLayer.querySelector<HTMLElement>(`[data-uid="${uid}"]`)!;
    const p0 = toRoom(e);
    const off = { x: it.x - p0.x, y: it.y - p0.y };
    let dragging = false;
    let pos = { x: it.x, y: it.y };
    const start = { x: e.clientX, y: e.clientY };
    const move = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) {
        dragging = true;
        node.classList.add('dragging');
      }
      if (!dragging) return;
      const p = toRoom(ev);
      pos = { x: clamp(p.x + off.x, 3, 97), y: def.wall ? clamp(p.y + off.y, 6, 52) : def.flat ? clamp(p.y + off.y, 60, 96) : clamp(p.y + off.y, 50, 100) };
      node.style.left = `${pos.x}%`;
      node.style.top = `${pos.y}%`;
      node.style.zIndex = '150';
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      node.classList.remove('dragging');
      if (dragging) {
        setHouse((hs) => updateItem(hs, save.playerId, uid, pos));
        sfx.tap();
      } else {
        sfx.pop();
        selectedItem = uid;
        selectedPet = null;
      }
      syncItems();
      syncPets();
      renderBottom();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  room.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('.item, .pet')) return;
    const p = toRoom(e);
    if (selectedItem || selectedPet) {
      selectedItem = null;
      selectedPet = null;
      syncItems();
      renderBottom();
    }
    // The follower pet walks to where you tap on the floor.
    if (save.followerUid && p.y > 58 && shownPets().some((x) => x.uid === save.followerUid)) {
      moveTo(save.followerUid, p.x, p.y + 3, 'walk', 2400);
      const dot = h('div', { class: 'tap-dot' });
      dot.style.left = `${p.x}%`;
      dot.style.top = `${p.y}%`;
      room.append(dot);
      setTimeout(() => dot.remove(), 700);
    }
    syncPets();
  });

  // ---------- bottom panel ----------
  function renderBottom(): void {
    const hs = house();
    const sel = selectedItem ? hs.items.find((i) => i.uid === selectedItem) : undefined;
    if (sel) {
      const def = ITEM_BY_ID[sel.itemId];
      bottom.innerHTML = `<div class="edit-bar">
        <div class="eb-name">${def.name}</div>
        <div class="swatches">${PALETTE.map((c) => `<button class="sw ${c === sel.color ? 'on' : ''}" data-c="${c}" style="background:${c}" aria-label="Farge"></button>`).join('')}</div>
        <div class="size-btns"><button class="btn round" data-s="-1" aria-label="Mindre">➖</button><button class="btn round" data-s="1" aria-label="Større">➕</button></div>
        ${def.note ? '<button class="btn yellow write">✏️ Skriv</button>' : ''}
        ${sel.itemId === 'dancefloor' ? '<button class="btn pink party-btn">🪩 Dansefest!</button>' : ''}
        <button class="btn ghost away">📦 Legg bort</button>
        <button class="btn green done">✓</button>
      </div>`;
      bottom.querySelectorAll<HTMLElement>('.sw').forEach((b) =>
        b.addEventListener('click', () => {
          sfx.tap();
          setHouse((x) => updateItem(x, save.playerId, sel.uid, { color: b.dataset.c! }));
          syncItems();
          renderBottom();
        }),
      );
      bottom.querySelectorAll<HTMLElement>('[data-s]').forEach((b) =>
        b.addEventListener('click', () => {
          sfx.tap();
          const cur = house().items.find((i) => i.uid === sel.uid)!;
          setHouse((x) => updateItem(x, save.playerId, sel.uid, { scale: Math.round((cur.scale + Number(b.dataset.s) * 0.2) * 10) / 10 }));
          syncItems();
        }),
      );
      bottom.querySelector('.write')?.addEventListener('click', () => openNotebook(sel.uid));
      bottom.querySelector('.party-btn')?.addEventListener('click', () => danceParty());
      bottom.querySelector('.away')!.addEventListener('click', () => {
        const r = removeItem(house(), save.playerId, sel.uid);
        if (!r.removed) return;
        update((s) => ({ ...s, houses: s.houses.map((x) => (x.id === r.house.id ? r.house : x)), inventory: { ...s.inventory, [sel.itemId]: (s.inventory[sel.itemId] ?? 0) + 1 } }));
        selectedItem = null;
        sfx.pop();
        syncItems();
        renderBottom();
      });
      bottom.querySelector('.done')!.addEventListener('click', () => {
        selectedItem = null;
        sfx.tap();
        syncItems();
        renderBottom();
      });
      return;
    }
    const invEntries = Object.entries(save.inventory).filter(([, n]) => n > 0);
    const pet = selectedPet ? save.pets.find((p) => p.uid === selectedPet) : undefined;
    const tabs = `<div class="tabs"><button class="tab ${tab === 'care' ? 'on' : ''}" data-tab="care">💖 Stell</button><button class="tab ${tab === 'things' ? 'on' : ''}" data-tab="things">📦 Mine ting${invEntries.length ? ` <b>${invEntries.reduce((a, [, n]) => a + n, 0)}</b>` : ''}</button></div>`;
    if (tab === 'care') {
      bottom.innerHTML = `${tabs}<div class="care-bar">
        <div class="care-info">${
          pet
            ? `<div class="ci-pet">${petFace(pet.speciesId)}<div><b>${petName(pet)}</b>${growthBar(pet)}<small>${pet.need ? `«${NEED_INFO[pet.need].text}»` : 'Fornøyd 💖'}</small></div></div>
               <div class="ci-btns"><button class="btn mini ${save.followerUid === pet.uid ? 'yellow' : 'blue'} follow">⭐ ${save.followerUid === pet.uid ? 'Følger' : 'Følg meg'}</button>${pet.flyable ? '<button class="btn mini pink fly">🪽 Fly</button>' : ''}${pet.rideable ? '<button class="btn mini green ride">🐎 Ri</button>' : ''}<button class="btn mini ghost info">ℹ️</button></div>`
            : `<p class="care-hint">${save.pets.length ? 'Se hva dyrene ønsker seg i boblene! Trykk eller dra en ting til dyret.' : 'Ingen dyr ennå – trykk på 🚪 Minispill for å vinne et egg!'}</p>`
        }</div>
        <div class="tools">${(Object.keys(CARE_INFO) as CareAction[]).map((a) => `<button class="tool" data-a="${a}"><span>${CARE_INFO[a].emoji}</span>${CARE_INFO[a].name}</button>`).join('')}</div>
      </div>`;
      bottom.querySelectorAll<HTMLElement>('.tool').forEach((b) => b.addEventListener('pointerdown', (e) => startToolDrag(e, b.dataset.a as CareAction)));
      bottom.querySelector('.follow')?.addEventListener('click', () => {
        sfx.pop();
        update((s) => ({ ...s, followerUid: pet!.uid }));
        syncPets();
        renderBottom();
      });
      bottom.querySelector('.fly')?.addEventListener('click', () => (pet!.need === 'walk' ? careFor(pet!.uid, 'walk') : void rideScene(pet!, 'fly')));
      bottom.querySelector('.ride')?.addEventListener('click', () => (pet!.need === 'walk' ? careFor(pet!.uid, 'walk') : void rideScene(pet!, 'ride')));
      bottom.querySelector('.info')?.addEventListener('click', () => petDetails(pet!, () => (syncPets(), renderBottom())));
    } else {
      bottom.innerHTML = `${tabs}<div class="things-bar">${
        invEntries.length
          ? invEntries
              .map(([id, n]) => `<button class="thing" data-id="${id}"><div class="th-art">${itemArt(id, ITEM_BY_ID[id].color ?? '#fff')}</div><span>${ITEM_BY_ID[id].name}</span><b>${n}</b></button>`)
              .join('')
          : '<p class="care-hint">Ingen ting her. Kjøp billige møbler og pynt i 🛍️ Butikken!</p>'
      }</div>`;
      bottom.querySelectorAll<HTMLElement>('.thing').forEach((b) =>
        b.addEventListener('click', () => {
          const id = b.dataset.id!;
          const def = ITEM_BY_ID[id];
          const r = placeItem(house(), save.playerId, id, rand(30, 70), def.wall ? rand(18, 32) : def.flat ? rand(72, 86) : rand(78, 92));
          if (!r.placed) return;
          update((s) => ({ ...s, houses: s.houses.map((x) => (x.id === r.house.id ? r.house : x)), inventory: { ...s.inventory, [id]: s.inventory[id] - 1 } }));
          sfx.pop();
          selectedItem = r.placed.uid;
          syncItems();
          renderBottom();
        }),
      );
    }
    bottom.querySelectorAll<HTMLElement>('.tab').forEach((b) =>
      b.addEventListener('click', () => {
        tab = b.dataset.tab as 'care' | 'things';
        sfx.tap();
        renderBottom();
      }),
    );
  }

  function openNotebook(uid: string): void {
    const it = house().items.find((i) => i.uid === uid);
    if (!it) return;
    const m = modal(
      `<div class="notebook-modal"><div class="clip"></div><h2>📓 Notatboka mi</h2><textarea maxlength="2000" placeholder="Skriv noe her …">${esc(it.note ?? '')}</textarea><button class="btn green" data-close>Lagre ✓</button></div>`,
      { className: 'paper' },
    );
    const ta = m.el.querySelector('textarea')!;
    ta.addEventListener('input', () => setHouse((x) => updateItem(x, save.playerId, uid, { note: ta.value })));
    setTimeout(() => ta.focus(), 50);
  }

  function danceParty(): void {
    partyUntil = Date.now() + 10_000;
    startMusic();
    sfx.item();
    for (const p of shownPets()) {
      const spot = spotOn('dancefloor');
      if (spot) moveTo(p.uid, spot.x, spot.y, 'walk', 1800);
    }
    toast('🪩 Dansefest! Alle dyrene danser!', 'ok');
    setTimeout(() => {
      for (const p of shownPets()) {
        const s = sim(p.uid);
        if (onDanceFloor(s)) Object.assign(s, { mode: 'dance', busyUntil: partyUntil });
      }
      syncPets();
    }, 1900);
  }

  function designPanel(): void {
    const hs = house();
    const m = modal(
      `<div class="design">
        <h2>🎨 Design huset ditt</h2>
        <h3>Veggfarge</h3><div class="swatches big">${WALL_COLORS.map((c) => `<button class="sw ${c === hs.wallColor ? 'on' : ''}" data-wall="${c}" style="background:${c}"></button>`).join('')}</div>
        <h3>Tapet</h3><div class="opts">${WALL_PATTERNS.map((p) => `<button class="opt pattern-${p.id} ${p.id === hs.wallPattern ? 'on' : ''}" data-pat="${p.id}" style="--wall:${hs.wallColor}"><span>${p.name}</span></button>`).join('')}</div>
        <h3>Gulv</h3><div class="opts">${FLOORS.map((f) => `<button class="opt floor-${f.id} ${f.id === hs.floor ? 'on' : ''}" data-floor="${f.id}"><span>${f.name}</span></button>`).join('')}</div>
        <button class="btn green" data-close>Ferdig ✓</button>
      </div>`,
    );
    const apply = (patch: Partial<House>) => {
      sfx.tap();
      setHouse((x) => ({ ...x, ...patch, updatedAt: Date.now() }));
      renderRoom();
      m.el.querySelectorAll('.on').forEach((n) => n.classList.remove('on'));
      const cur = house();
      m.el.querySelector(`[data-wall="${cur.wallColor}"]`)?.classList.add('on');
      m.el.querySelector(`[data-pat="${cur.wallPattern}"]`)?.classList.add('on');
      m.el.querySelector(`[data-floor="${cur.floor}"]`)?.classList.add('on');
      m.el.querySelectorAll<HTMLElement>('[data-pat]').forEach((b) => b.style.setProperty('--wall', cur.wallColor));
    };
    m.el.querySelectorAll<HTMLElement>('[data-wall]').forEach((b) => b.addEventListener('click', () => apply({ wallColor: b.dataset.wall! })));
    m.el.querySelectorAll<HTMLElement>('[data-pat]').forEach((b) => b.addEventListener('click', () => apply({ wallPattern: b.dataset.pat as House['wallPattern'] })));
    m.el.querySelectorAll<HTMLElement>('[data-floor]').forEach((b) => b.addEventListener('click', () => apply({ floor: b.dataset.floor as House['floor'] })));
  }

  el.querySelectorAll<HTMLElement>('[data-go]').forEach((b) => b.addEventListener('click', () => (sfx.tap(), go(b.dataset.go!))));
  el.querySelector('.side-btn.design')!.addEventListener('click', () => (sfx.tap(), designPanel()));
  el.querySelector('.sound')!.addEventListener('click', () => {
    update((s) => ({ ...s, sound: !s.sound }));
    setSoundEnabled(save.sound);
    renderTop();
  });

  renderTop();
  renderRoom();
  syncItems();
  syncPets(true);
  renderBottom();
  const unsub = subscribe(() => {
    el.querySelector('.pts-pill')!.innerHTML = `🪙 ${save.points}`;
  });
  const timer = window.setInterval(tick, 1000);
  setTimeout(tick, 200);

  if (!save.starterGiven && save.pets.length === 0) {
    const m = modal(
      `<div class="welcome"><div class="welcome-egg">🥚</div><h2>Velkommen til Pet Doors!</h2><p>Her er ditt aller første kjæledyr-egg. Pass godt på dyret ditt, så vokser det seg stort!</p><button class="btn big pink hatch">🥚 Klekk egget!</button></div>`,
      { dismissable: false },
    );
    m.el.querySelector('.hatch')!.addEventListener('click', () => {
      m.close();
      addEggPet(true);
      go('egg');
    });
  }

  return () => {
    window.clearInterval(timer);
    stopMusic();
    unsub();
    el.remove();
  };
}
