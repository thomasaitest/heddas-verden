import { sfx } from '../audio.ts';
import { ACCESSORIES, BOTTOMS, CLOTH_COLORS, FACES, HAIR_COLORS, HAIR_STYLES, HATS, randomAvatar, SHIRT_PRINTS, SHOES, SKIN, type Avatar } from '../logic/avatar.ts';
import { FLOOR_COLORS, FOODS, FOOD_BY_ID, FURN_BY_ID, FURN_CATS, FURNITURE, HOUSES, PALETTE, POTIONS, WALL_COLORS, type FurnCat } from '../logic/catalog.ts';
import { POINTS, ITEM_INFO, newGame, openDoor, useMagnifier, type DoorGame } from '../logic/doors.ts';
import { activeHouse, addBucks, buyAndHatch, buyFood, buyFurniture, buyHouse, buyPotion, editHouse, placeFromInventory, renamePet, storeItem, toggleEquip, usePotion } from '../logic/economy.ts';
import { rotateItem, updateItem } from '../logic/house.ts';
import { NEED_INFO, stageOf, stageProgress, STAGES, type PetState } from '../logic/needs.ts';
import { EGGS, RARITY_INFO, SPECIES_BY_ID, type EggType } from '../logic/pets.ts';
import type { Game } from '../game.ts';
import { buildAvatar } from '../three/avatarModel.ts';
import { buildFurniture } from '../three/furniture.ts';
import { buildPet } from '../three/petModel.ts';
import { bucksText, button, el, sheet, toast, type Sheet } from './dom.ts';

const price = (n: number) => el('span', { class: 'price' }, el('span', { class: 'coin sm' }, 'B'), n === 0 ? 'Gratis' : bucksText(n));

export function petThumb(game: Game, speciesId: string): string {
  return game.thumbs.get(`pet-${speciesId}`, () => buildPet(SPECIES_BY_ID[speciesId]).root, { yaw: 0.5, pitch: 0.25 });
}
export function furnThumb(game: Game, id: string): string {
  const f = FURN_BY_ID[id];
  return game.thumbs.get(`f-${id}`, () => buildFurniture(f.model, f.color), { yaw: -0.5, pitch: f.wall ? 0.1 : 0.5 });
}

function failText(reason: string): string {
  return reason === 'too-expensive' ? 'Du har ikke nok bucks ennå. Stell dyrene for å tjene mer!' : reason === 'owned' ? 'Det har du allerede' : 'Det gikk ikke';
}

// ---------- Butikk (food) ----------
export function openShop(game: Game) {
  const s = sheet('Butikk 🛒', '#ff6f6f');
  const render = () => {
    s.body.replaceChildren(
      el('p', { class: 'lead' }, 'Mat og drikke til dyrene dine. Gi det til dem når de er sultne eller tørste!'),
      el(
        'div',
        { class: 'grid' },
        ...FOODS.map((f) =>
          el(
            'div',
            { class: 'card' },
            el('div', { class: 'big-emoji' }, f.emoji),
            el('b', {}, f.name),
            el('small', {}, f.fixes === 'mat' ? 'Mot sult' : 'Mot tørst'),
            el('small', { class: 'owned' }, `Du har ${game.save.bag[f.id] ?? 0}`),
            button(price(f.price), () => {
              const r = buyFood(game.save, f.id);
              if (!r.ok) {
                toast(failText(r.reason), 'bad');
                sfx.nope();
                return;
              }
              sfx.buy();
              game.commit(r.save);
              render();
            }, 'btn buy'),
          ),
        ),
      ),
    );
  };
  render();
}

// ---------- Eggbutikk ----------
function eggArt(e: EggType, cls = '') {
  return el('div', { class: `egg ${cls}`, style: { '--egg': e.color, '--spot': e.spots } }, el('i'), el('i'), el('i'));
}

export function openEggs(game: Game) {
  const s = sheet('Eggbutikk 🥚', '#b05cff');
  const render = () => {
    const eggs = EGGS.filter((e) => e.price > 0 || !game.save.starterClaimed);
    s.body.replaceChildren(
      el('p', { class: 'lead' }, 'Kjøp et egg og se hvilket dyr som klekker! Sjeldne egg gir sjeldnere dyr.'),
      el(
        'div',
        { class: 'grid' },
        ...eggs.map((e) =>
          el(
            'div',
            { class: 'card' },
            eggArt(e),
            el('b', {}, e.name),
            el('div', { class: 'odds' }, ...(['vanlig', 'uvanlig', 'sjelden', 'ultra', 'legendarisk'] as const).filter((r) => e.weights[r] > 0).map((r) => el('span', { class: 'dot', style: { background: RARITY_INFO[r].color }, title: RARITY_INFO[r].label }))),
            button(price(e.price), () => {
              const r = buyAndHatch(game.save, e.id, game.rng);
              if (!r.ok) {
                toast(failText(r.reason), 'bad');
                sfx.nope();
                return;
              }
              s.close();
              game.commit(r.save, { pets: true });
              showHatch(game, r.pet, e);
            }, 'btn buy'),
          ),
        ),
      ),
      el('h3', {}, 'Trylledrikker'),
      el(
        'div',
        { class: 'grid' },
        ...POTIONS.map((p) =>
          el(
            'div',
            { class: 'card' },
            el('div', { class: 'big-emoji' }, p.emoji),
            el('b', {}, p.name),
            el('small', {}, p.text),
            el('small', { class: 'owned' }, `Du har ${game.save.bag[p.id] ?? 0}`),
            button(price(p.price), () => {
              const r = buyPotion(game.save, p.id);
              if (!r.ok) {
                toast(failText(r.reason), 'bad');
                sfx.nope();
                return;
              }
              sfx.buy();
              game.commit(r.save);
              toast('Bruk drikken fra 🐾 Dyr', 'ok');
              render();
            }, 'btn buy'),
          ),
        ),
      ),
    );
  };
  render();
}

export function showHatch(game: Game, pet: PetState, egg: EggType) {
  game.paused = true;
  const sp = SPECIES_BY_ID[pet.speciesId];
  const rar = RARITY_INFO[sp.rarity];
  const stage = el('div', { class: 'hatch-stage' }, eggArt(egg, 'wobble'));
  const wrap = el('div', { class: 'hatch' }, el('div', { class: 'rays' }), stage);
  document.getElementById('ui')!.append(wrap);
  sfx.wobble();
  setTimeout(() => sfx.wobble(), 500);
  setTimeout(() => sfx.wobble(), 1000);
  setTimeout(() => {
    sfx.hatch();
    const name = el('input', { class: 'name-input', value: pet.name, maxlength: '16', 'aria-label': 'Navn' }) as HTMLInputElement;
    stage.replaceChildren(
      el('img', { class: 'hatch-pet', src: petThumb(game, sp.id), alt: sp.name }),
      el('div', { class: 'rarity', style: { background: rar.color } }, rar.label),
      el('h2', {}, `Du fikk en ${sp.name}!`),
      el('div', { class: 'badges' }, pet.flyable ? el('span', { class: 'badge fly' }, '🪽 Kan fly') : null, pet.rideable ? el('span', { class: 'badge ride' }, '🐎 Kan ris') : null),
      el('label', { class: 'name-label' }, 'Gi dyret et navn:', name),
      button('Hurra! 🎉', () => {
        game.commit(renamePet(game.save, pet.uid, name.value), { pets: true });
        game.paused = false;
        wrap.remove();
      }, 'btn big green'),
    );
  }, 1700);
}

// ---------- Sekk ----------
export function openBag(game: Game) {
  const s = sheet('Ryggsekk 🎒', '#ffb84d');
  const render = () => {
    const bag = game.save.bag;
    const foods = FOODS.filter((f) => bag[f.id]);
    const furn = Object.entries(game.save.inventory);
    s.body.replaceChildren(
      el('h3', {}, 'Mat og drikke'),
      foods.length
        ? el('div', { class: 'grid small' }, ...foods.map((f) => el('div', { class: 'card mini' }, el('div', { class: 'big-emoji' }, f.emoji), el('b', {}, `${f.name} ×${bag[f.id]}`))))
        : el('p', { class: 'empty' }, 'Tomt! Kjøp mat i Butikken.'),
      el('h3', {}, 'Trylledrikker'),
      POTIONS.some((p) => bag[p.id])
        ? el('div', { class: 'grid small' }, ...POTIONS.filter((p) => bag[p.id]).map((p) => el('div', { class: 'card mini' }, el('div', { class: 'big-emoji' }, p.emoji), el('b', {}, `${p.name} ×${bag[p.id]}`), el('small', {}, 'Brukes fra 🐾 Dyr'))))
        : el('p', { class: 'empty' }, 'Ingen drikker ennå.'),
      el('h3', {}, 'Møbler som ikke er plassert'),
      furn.length
        ? el('div', { class: 'grid small' }, ...furn.map(([id, n]) => el('div', { class: 'card mini' }, el('img', { class: 'thumb', src: furnThumb(game, id), alt: '' }), el('b', {}, `${FURN_BY_ID[id].name} ×${n}`))))
        : el('p', { class: 'empty' }, 'Alle møblene står i huset.'),
      el('p', { class: 'hint' }, 'Gå inn i huset og trykk 🔨 Bygg for å plassere møbler.'),
    );
  };
  render();
}

export function feedMenu(game: Game, uid: string) {
  const pet = game.save.pets.find((p) => p.uid === uid);
  if (!pet) return;
  const s = sheet(`Gi ${pet.name} noe`, '#7ccf6a', undefined, 'narrow');
  const render = () => {
    const p = game.save.pets.find((x) => x.uid === uid)!;
    const want = p.need ? NEED_INFO[p.need.kind].where : null;
    const list = FOODS.filter((f) => game.save.bag[f.id] && (want === null || f.fixes === want));
    if (want !== 'mat' && want !== 'drikke') {
      s.body.replaceChildren(el('p', { class: 'lead' }, `${p.name} er ikke sulten eller tørst nå.`));
      return;
    }
    s.body.replaceChildren(
      el('p', { class: 'lead' }, want === 'mat' ? `${p.name} er sulten 🍎` : `${p.name} er tørst 🥤`),
      list.length
        ? el(
            'div',
            { class: 'grid small' },
            ...list.map((f) =>
              button(el('span', { class: 'food-btn' }, el('span', { class: 'big-emoji' }, f.emoji), `${f.name} ×${game.save.bag[f.id]}`), () => {
                if (game.feedPet(uid, f.id)) s.close();
              }, 'card mini tap'),
            ),
          )
        : el('div', {}, el('p', { class: 'empty' }, want === 'mat' ? 'Du har ikke mat.' : 'Du har ikke drikke.'), el('p', { class: 'hint' }, 'Gå inn i Butikken i byen og handle 🛒 (se Kart)'), button('Åpne kartet 🗺️', () => {
            s.close();
            game.panels.openMap();
          }, 'btn big')),
    );
  };
  render();
}

// ---------- Dyr ----------
export function openPets(game: Game) {
  const s = sheet('Mine dyr 🐾', '#ff8fb1');
  const unsub = game.subscribe(() => render());
  const origClose = s.close;
  s.close = () => {
    unsub();
    origClose();
  };
  const render = () => {
    const pets = game.save.pets;
    if (!pets.length) {
      s.body.replaceChildren(el('p', { class: 'lead' }, 'Du har ingen dyr ennå. Gå til Eggbutikken i byen!'), button('Vis på kartet 🗺️', () => {
        s.close();
        game.panels.openMap();
      }, 'btn big'));
      return;
    }
    s.body.replaceChildren(
      el('p', { class: 'lead' }, 'Bare ett dyr kan følge deg om gangen. Trykk «Følg meg» på et annet dyr, så går det forrige hjem og hviler.'),
      el(
        'div',
        { class: 'pet-list' },
        ...pets.map((p) => {
          const sp = SPECIES_BY_ID[p.speciesId];
          const rar = RARITY_INFO[sp.rarity];
          const eq = game.save.equipped.includes(p.uid);
          const st = stageOf(p.xp);
          return el(
            'div',
            { class: `pet-card ${eq ? 'eq' : ''}` },
            el('img', { class: 'thumb big', src: petThumb(game, sp.id), alt: '' }),
            el(
              'div',
              { class: 'pet-info' },
              el('b', {}, p.name),
              el('div', { class: 'row-l' }, el('span', { class: 'rarity sm', style: { background: rar.color } }, rar.label), el('span', { class: 'sp' }, sp.name)),
              el('div', { class: 'age' }, `${st.name}`, el('span', { class: 'bar' }, el('i', { style: { width: `${Math.round(stageProgress(p.xp) * 100)}%` } })), STAGES[STAGES.length - 1].name === st.name ? '⭐' : ''),
              el('div', { class: 'badges' }, p.flyable ? el('span', { class: 'badge fly' }, '🪽 Fly') : null, p.rideable ? el('span', { class: 'badge ride' }, '🐎 Ri') : null, p.need && eq ? el('span', { class: 'badge need' }, `${NEED_INFO[p.need.kind].emoji} ${NEED_INFO[p.need.kind].label}`) : null),
            ),
            el(
              'div',
              { class: 'pet-btns' },
              button(eq ? 'Hvil' : 'Følg meg', () => {
                game.commit(toggleEquip(game.save, p.uid).save, { pets: true });
              }, `btn small ${eq ? 'grey' : 'green'}`),
              button('✏️', () => {
                const n = prompt('Nytt navn', p.name);
                if (n !== null) game.commit(renamePet(game.save, p.uid, n), { pets: true });
              }, 'btn small round'),
              !p.flyable && game.save.bag.flygedrikk
                ? button('🪽', () => {
                    game.commit(usePotion(game.save, 'flygedrikk', p.uid).save, { pets: true });
                    sfx.hatch();
                    toast(`${p.name} kan fly nå!`, 'gold');
                  }, 'btn small round purple')
                : null,
              !p.rideable && game.save.bag.ridedrikk
                ? button('🐎', () => {
                    game.commit(usePotion(game.save, 'ridedrikk', p.uid).save, { pets: true });
                    sfx.hatch();
                    toast(`${p.name} kan ris nå!`, 'gold');
                  }, 'btn small round purple')
                : null,
            ),
          );
        }),
      ),
    );
  };
  render();
}

// ---------- Kart ----------
export function openMap(game: Game) {
  const s = sheet('Kart 🗺️', '#3fa4ff');
  const pins: Record<string, { e: string; n: string }> = {
    home: { e: '🏠', n: 'Hjem' },
    shop: { e: '🛒', n: 'Butikk' },
    vet: { e: '🩺', n: 'Dyrlege' },
    play: { e: '⚽', n: 'Lekeplass' },
    eggs: { e: '🥚', n: 'Eggbutikk' },
    doors: { e: '🚪', n: 'Dørspillet' },
  };
  /** A flat picture of the town: where you are and where everything is. You have to walk there. */
  const minimap = () => {
    const size = 340;
    const c = el('canvas', { class: 'minimap', width: String(size * 2), height: String(size * 2), style: { width: `${size}px`, height: `${size}px` } }) as HTMLCanvasElement;
    const ctx = c.getContext('2d');
    if (!ctx) return c;
    const k = (size * 2) / (game.town.size * 0.9);
    const X = (x: number) => size + x * k;
    const Y = (z: number) => size + z * k;
    ctx.fillStyle = '#9fe08a';
    ctx.fillRect(0, 0, size * 2, size * 2);
    ctx.strokeStyle = '#f2dfb8';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    for (const z of game.town.zones) {
      if (z.kind === 'play') continue;
      ctx.beginPath();
      ctx.moveTo(X(0), Y(0));
      ctx.lineTo(X(z.x), Y(z.z));
      ctx.stroke();
    }
    ctx.fillStyle = '#7fd8ff';
    ctx.beginPath();
    ctx.arc(X(0), Y(0), 9 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '700 38px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const z of game.town.zones) {
      const pin = pins[z.kind];
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(X(z.x), Y(z.z), 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a3b5c';
      ctx.font = '40px "Apple Color Emoji","Noto Color Emoji",sans-serif';
      ctx.fillText(pin.e, X(z.x), Y(z.z) + 3);
      ctx.font = '700 34px Fredoka, sans-serif';
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(pin.n, X(z.x), Y(z.z) + 62);
      ctx.fillText(pin.n, X(z.x), Y(z.z) + 62);
    }
    if (game.mode === 'town') {
      ctx.fillStyle = '#ff4f7f';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(X(game.player.pos.x), Y(game.player.pos.z), 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    return c;
  };
  const render = () => {
    s.body.replaceChildren(
      el('p', { class: 'lead' }, game.mode === 'town' ? 'Du er den rosa prikken. Gå dit du vil – alt kan nås til fots.' : 'Gå ut døra for å utforske byen.'),
      el('div', { class: 'minimap-wrap' }, minimap()),
      el('h3', {}, 'Hus'),
      el(
        'div',
        { class: 'grid' },
        ...HOUSES.map((h) => {
          const owned = game.save.houses.find((x) => x.style === h.style);
          const active = owned && owned.id === game.save.activeHouseId;
          return el(
            'div',
            { class: `card ${active ? 'eq' : ''}` },
            el('div', { class: 'house-art', style: { '--wall': h.wall, '--roof': h.roof } }, el('i'), el('b')),
            el('b', {}, h.name),
            el('small', {}, h.text),
            active
              ? el('span', { class: 'tag' }, 'Ditt hjem')
              : button(owned ? 'Flytt hit' : price(h.price), () => {
                  const r = buyHouse(game.save, h.style);
                  if (!r.ok) {
                    toast(failText(r.reason), 'bad');
                    sfx.nope();
                    return;
                  }
                  if (!owned) {
                    sfx.buy();
                    toast(`Gratulerer med ${h.name}! 🏡`, 'gold');
                  }
                  game.commit(r.save, { house: true });
                  render();
                }, 'btn buy'),
          );
        }),
      ),
    );
  };
  render();
}

// ---------- Dyrlege ----------
export function openVetInfo(game: Game) {
  const s = sheet('Dyrlegen 🩺', '#3fa4ff', undefined, 'narrow');
  const sick = game.equippedPets().filter((p) => p.need?.kind === 'syk');
  s.body.replaceChildren(
    sick.length
      ? el('p', { class: 'lead' }, `Stå på den grønne matten, så gjør dyrlegen ${sick.map((p) => p.name).join(' og ')} frisk igjen! 💚`)
      : el('p', { class: 'lead' }, 'Alle dyrene dine er friske! Kom hit hvis et dyr blir sykt 🤒'),
    button('OK', () => s.close(), 'btn big'),
  );
}

// ---------- Avatar ----------
export function openAvatar(game: Game, first = false, onDone?: () => void) {
  game.editingAvatar = true;
  game.updateHud();
  let a: Avatar = { ...game.save.avatar };
  const set = (patch: Partial<Avatar>) => {
    a = { ...a, ...patch };
    game.commit({ ...game.save, avatar: a }, { avatar: true });
    render();
  };
  type Tab = 'hud' | 'har' | 'ansikt' | 'klaer' | 'hatt' | 'ting';
  let tab: Tab = 'hud';
  const s = sheet(first ? 'Lag din figur!' : 'Avatar', '#ff8fb1', () => {
    game.editingAvatar = false;
    game.commit({ ...game.save, avatar: a, avatarDone: true });
    onDone?.();
  }, 'side');
  const swatches = (list: readonly string[], cur: string, on: (c: string) => void) => el('div', { class: 'swatches' }, ...list.map((c) => button('', () => on(c), `swatch ${c === cur ? 'on' : ''}`, { style: `background:${c}`, 'aria-label': c })));
  type Field = 'hair' | 'face' | 'print' | 'bottom' | 'shoeStyle' | 'hat' | 'accessory';
  /** A small picture of the avatar wearing this option (the rest of the look stays as it is now). */
  const optThumb = (field: Field, id: string): string => {
    const head = field === 'hair' || field === 'face' || field === 'hat';
    const behind = field === 'accessory' && ['vinger', 'sommerfugl', 'sekk', 'kappe'].includes(id);
    const frame = head
      ? { y: 2.2, r: 0.95 }
      : field === 'accessory'
        ? ['briller', 'solbriller', 'hodetelefoner', 'glorie'].includes(id) ? { y: 2.2, r: 0.95 } : { y: 1.35, r: 1.75 }
        : field === 'print' ? { y: 1.45, r: 0.95 }
          : field === 'bottom' ? { y: 0.55, r: 1.05 }
            : { y: 0.35, r: 0.95 };
    const sig = head
      ? `${a.skin}|${a.hairColor}|${a.hair}|${a.hat}|${a.face}`
      : field === 'accessory' ? `${a.skin}|${a.shirt}` : field === 'print' ? `${a.shirt}|${a.skin}` : field === 'bottom' ? `${a.pants}|${a.skin}|${a.shoes}` : `${a.shoes}|${a.pants}|${a.skin}`;
    return game.thumbs.get(`av|${field}|${id}|${sig}`, () => buildAvatar({ ...a, [field]: id }).root, { yaw: behind ? 2.7 : 0.25, pitch: 0.08, focus: frame });
  };
  const chips = <T extends { id: string; name: string }>(field: Field, list: readonly T[], cur: string, on: (id: T['id']) => void) =>
    el('div', { class: 'opts' }, ...list.map((o) => button(el('span', { class: 'opt-in' }, el('img', { class: 'opt-img', src: optThumb(field, o.id), alt: '' }), el('b', {}, o.name)), () => on(o.id), `opt ${o.id === cur ? 'on' : ''}`)));
  const tabs: [Tab, string][] = [['hud', '🖐️ Hud'], ['har', '💇 Hår'], ['ansikt', '😊 Ansikt'], ['klaer', '👕 Klær'], ['hatt', '👑 Hatt'], ['ting', '🎒 Ting']];
  const render = () => {
    let content: HTMLElement;
    switch (tab) {
      case 'hud':
        content = el('div', {}, el('h4', {}, 'Hudfarge'), swatches(SKIN, a.skin, (c) => set({ skin: c })));
        break;
      case 'har':
        content = el('div', {}, el('h4', {}, 'Frisyre'), chips('hair', HAIR_STYLES, a.hair, (id) => set({ hair: id })), el('h4', {}, 'Hårfarge'), swatches(HAIR_COLORS, a.hairColor, (c) => set({ hairColor: c })));
        break;
      case 'ansikt':
        content = el('div', {}, el('h4', {}, 'Ansikt'), chips('face', FACES, a.face, (id) => set({ face: id })));
        break;
      case 'klaer':
        content = el(
          'div',
          {},
          el('h4', {}, 'Genser'),
          swatches(CLOTH_COLORS, a.shirt, (c) => set({ shirt: c })),
          el('h4', {}, 'Trykk'),
          chips('print', SHIRT_PRINTS, a.print, (id) => set({ print: id })),
          el('h4', {}, 'Underdel'),
          chips('bottom', BOTTOMS, a.bottom, (id) => set({ bottom: id })),
          swatches(CLOTH_COLORS, a.pants, (c) => set({ pants: c })),
          el('h4', {}, 'Skotype'),
          chips('shoeStyle', SHOES, a.shoeStyle, (id) => set({ shoeStyle: id })),
          el('h4', {}, 'Skofarge'),
          swatches(CLOTH_COLORS, a.shoes, (c) => set({ shoes: c })),
        );
        break;
      case 'hatt':
        content = el('div', {}, el('h4', {}, 'Hatt'), chips('hat', HATS, a.hat, (id) => set({ hat: id })));
        break;
      case 'ting':
        content = el('div', {}, el('h4', {}, 'Tilbehør'), chips('accessory', ACCESSORIES, a.accessory, (id) => set({ accessory: id })));
        break;
    }
    s.body.replaceChildren(
      el('div', { class: 'tabs' }, ...tabs.map(([id, label]) => button(label, () => {
        tab = id;
        render();
      }, `tab ${tab === id ? 'on' : ''}`))),
      content,
      el('div', { class: 'row' }, button('🎲 Tilfeldig', () => set(randomAvatar(Math.random)), 'btn purple'), button('Ferdig ✓', () => s.close(), 'btn green')),
    );
  };
  render();
}

// ---------- Bygg ----------
export function openBuild(game: Game) {
  game.setBuilding(true);
  type Tab = FurnCat | 'mine' | 'rom';
  let tab: Tab = 'mine';
  const s = sheet('Bygg 🔨', '#ffb84d', () => {
    unsub();
    game.setBuilding(false);
  }, 'build');
  const unsub = game.subscribe(() => renderTools());
  const tools = el('div', { class: 'build-tools' });
  const list = el('div', { class: 'build-list' });
  const tabsEl = el('div', { class: 'tabs scroll' });
  s.body.replaceChildren(tools, tabsEl, list);

  const place = (id: string) => {
    let save = game.save;
    if (!save.inventory[id]) {
      const r = buyFurniture(save, id);
      if (!r.ok) {
        toast(failText(r.reason), 'bad');
        sfx.nope();
        return;
      }
      save = r.save;
      sfx.buy();
    }
    // place in front of the camera view centre, a little random so items don't stack
    const x = (Math.random() - 0.5) * 3;
    const z = (Math.random() - 0.5) * 3;
    const r = placeFromInventory(save, id, x, z);
    if (!r.ok) {
      toast('Du kan ikke bygge her', 'bad');
      return;
    }
    game.commit(r.save);
    const house = activeHouse(r.save);
    game.selectItem(house.items[house.items.length - 1].uid);
    sfx.pop();
    renderList();
  };

  const renderTools = () => {
    const uid = game.selectedItem;
    const house = activeHouse(game.save);
    const it = uid ? house.items.find((i) => i.uid === uid) : null;
    if (!it) {
      tools.replaceChildren(el('p', { class: 'hint' }, 'Trykk på en ting i rommet for å flytte den (dra), snu, endre farge eller størrelse. Velg nye ting nedenfor.'));
      return;
    }
    const def = FURN_BY_ID[it.itemId];
    const upd = (patch: Parameters<typeof updateItem>[2]) => game.commit(editHouse(game.save, (h) => updateItem(h, it.uid, patch)));
    tools.replaceChildren(
      el('b', { class: 'sel-name' }, def.name),
      el(
        'div',
        { class: 'row tools-row' },
        def.wall ? null : button('↻ Snu', () => game.commit(editHouse(game.save, (h) => rotateItem(h, it.uid))), 'btn small'),
        button('➖', () => upd({ scale: it.scale - 0.15 }), 'btn small round'),
        button('➕', () => upd({ scale: it.scale + 0.15 }), 'btn small round'),
        button('📦 Legg bort', () => {
          const r = storeItem(game.save, it.uid);
          if (r.ok) {
            game.selectItem(null);
            game.commit(r.save);
            renderList();
          }
        }, 'btn small grey'),
      ),
      el('div', { class: 'swatches sm' }, ...PALETTE.map((c) => button('', () => upd({ color: c }), `swatch ${c === it.color ? 'on' : ''}`, { style: `background:${c}` }))),
    );
  };

  const renderList = () => {
    tabsEl.replaceChildren(
      ...([['mine', '📦 Mine'], ...FURN_CATS.map((c) => [c.id, `${c.emoji} ${c.label}`]), ['rom', '🎨 Rom']] as [Tab, string][]).map(([id, label]) =>
        button(label, () => {
          tab = id;
          renderList();
        }, `tab ${tab === id ? 'on' : ''}`),
      ),
    );
    if (tab === 'rom') {
      const house = activeHouse(game.save);
      list.replaceChildren(
        el('h4', {}, 'Veggfarge'),
        el('div', { class: 'swatches' }, ...WALL_COLORS.map((c) => button('', () => {
          game.commit(editHouse(game.save, (h) => ({ ...h, wallColor: c })), { house: true });
          renderList();
        }, `swatch ${c === house.wallColor ? 'on' : ''}`, { style: `background:${c}` }))),
        el('h4', {}, 'Gulv'),
        el('div', { class: 'swatches' }, ...FLOOR_COLORS.map((c) => button('', () => {
          game.commit(editHouse(game.save, (h) => ({ ...h, floorColor: c })), { house: true });
          renderList();
        }, `swatch ${c === house.floorColor ? 'on' : ''}`, { style: `background:${c}` }))),
      );
      return;
    }
    const items = tab === 'mine' ? FURNITURE.filter((f) => game.save.inventory[f.id]) : FURNITURE.filter((f) => f.cat === tab);
    if (!items.length) {
      list.replaceChildren(el('p', { class: 'empty' }, 'Ingen ting her ennå – velg en kategori og kjøp nye møbler!'));
      return;
    }
    list.replaceChildren(
      el(
        'div',
        { class: 'furn-row' },
        ...items.map((f) => {
          const have = game.save.inventory[f.id] ?? 0;
          return button(
            el('span', { class: 'furn' }, el('img', { class: 'thumb', src: furnThumb(game, f.id), alt: '' }), el('b', {}, f.name), have ? el('span', { class: 'have' }, `Har ${have}`) : price(f.price), f.care ? el('span', { class: 'care-tag' }, f.care === 'seng' ? '💤' : f.care === 'bad' ? '🫧' : '⚽') : null),
            () => place(f.id),
            'furn-btn',
          );
        }),
      ),
    );
  };
  renderTools();
  renderList();
}

// ---------- Dørspillet ----------
export function openDoors(game: Game) {
  game.paused = true;
  let g: DoorGame = newGame(game.rng);
  const s: Sheet = sheet('Dørspillet 🚪', '#ff4fa8', () => {
    game.paused = false;
  });
  const colors = ['#ff6f6f', '#ffe066', '#5cc3f2', '#7ccf6a'];
  const render = (opened = -1) => {
    const ev = g.lastEvent;
    const msg =
      g.status === 'won'
        ? `Du klarte alle ${g.totalLevels} nivåene! 🎉`
        : g.status === 'lost'
          ? 'Åh nei, tom for liv! Prøv igjen.'
          : ev?.type === 'trap'
            ? '👻 Spøkelse! Du mistet et liv.'
            : ev?.type === 'trap-blocked'
              ? '🗝️ Nøkkelen reddet deg!'
              : ev?.type === 'item'
                ? `${ITEM_INFO[ev.item].emoji} ${ITEM_INFO[ev.item].text}`
                : ev?.type === 'revealed'
                  ? '🔍 Lupen fant en skummel dør!'
                  : 'Velg en dør! Unngå spøkelsene.';
    s.body.replaceChildren(
      el('div', { class: 'door-stats' }, el('span', {}, `Nivå ${Math.min(g.level + 1, g.totalLevels)}/${g.totalLevels}`), el('span', {}, '💖'.repeat(g.lives) || '–'), el('span', {}, `🗝️${g.keys}`), el('span', {}, `🔍${g.magnifiers}`)),
      el('p', { class: 'lead' }, msg),
      g.status === 'playing'
        ? el(
            'div',
            { class: 'doors' },
            ...g.doors.map((d, i) =>
              button(el('span', { class: 'door-face' }, d.revealed ? '👻' : d.opened ? (d.content.type === 'trap' ? '👻' : '✨') : el('i', { class: 'knob' })), () => {
                const before = g.level;
                g = openDoor(g, i, game.rng);
                const e = g.lastEvent;
                if (e?.type === 'trap') sfx.trap();
                else if (e?.type === 'item') sfx.item();
                else sfx.safe();
                if (g.status === 'won') {
                  sfx.win();
                  const bucks = g.points * 2;
                  game.commit({ ...addBucks(game.save, bucks), stats: { ...game.save.stats, doorWins: game.save.stats.doorWins + 1 } });
                  toast(`+${bucks} bucks!`, 'gold');
                } else if (g.status === 'lost') {
                  sfx.lose();
                  game.commit(addBucks(game.save, POINTS.consolation));
                  toast(`+${POINTS.consolation} bucks for innsatsen`, 'gold');
                }
                render(g.level === before ? i : -1);
              }, `door ${d.opened ? 'open' : ''} ${d.revealed ? 'bad' : ''} ${opened === i ? 'shake' : ''}`, { style: `--door:${colors[i % 4]}`, disabled: d.opened || d.revealed ? 'true' : undefined }),
            ),
          )
        : el('div', { class: 'row' }, button('Spill igjen', () => {
            g = newGame(game.rng);
            render();
          }, 'btn big green'), button('Ferdig', () => s.close(), 'btn big grey')),
      g.status === 'playing' && g.magnifiers > 0 ? button('🔍 Bruk lupe', () => {
        g = useMagnifier(g, game.rng);
        render();
      }, 'btn purple') : '',
    );
  };
  render();
}

// ---------- Starter ----------
export function starterFlow(game: Game) {
  const next = () => {
    if (game.save.starterClaimed) return;
    const s = sheet('Velkommen til Heddas Verden! 🌈', '#ff8fb1', undefined, 'narrow');
    const egg = EGGS[0];
    s.body.replaceChildren(
      eggArt(egg, 'wobble center'),
      el('p', { class: 'lead' }, 'Her er ditt første egg! Stell dyret ditt, tjen bucks, kjøp møbler og utforsk byen.'),
      button('Klekk egget! 🐣', () => {
        const r = buyAndHatch(game.save, egg.id, game.rng);
        s.close();
        if (r.ok) {
          game.commit(r.save, { pets: true });
          showHatch(game, r.pet, egg);
        }
      }, 'btn big green'),
    );
  };
  if (!game.save.avatarDone) openAvatar(game, true, next);
  else next();
}

export function foodName(id: string) {
  return FOOD_BY_ID[id]?.name ?? id;
}
