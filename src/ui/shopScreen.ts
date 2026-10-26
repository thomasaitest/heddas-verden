import { sfx } from '../audio.ts';
import { itemArt, windowScene } from '../art/furniture.ts';
import { DECOR, FURNITURE, HOUSES, type ShopItem } from '../logic/catalog.ts';
import { ownsHouseStyle } from '../logic/save.ts';
import { buy } from '../logic/shop.ts';
import { save, update } from '../store.ts';
import { burst, centerOf, h, toast } from './dom.ts';
import { go } from './router.ts';

type Tab = 'furniture' | 'decor' | 'house';

export function mountShop(root: HTMLElement): () => void {
  let tab: Tab = 'furniture';
  const el = h('div', { class: 'screen shop-screen' });
  root.append(el);

  function card(item: ShopItem): string {
    const isHouse = item.kind === 'house';
    const owned = isHouse ? ownsHouseStyle(save, item.id) : false;
    const count = save.inventory[item.id] ?? 0;
    const art = isHouse ? `<div class="house-thumb style-${(item as (typeof HOUSES)[number]).style}">${windowScene((item as (typeof HOUSES)[number]).style)}</div>` : itemArt(item.id, item.color ?? '#fff');
    const price = item.price === 0 ? 'Gratis' : `🪙 ${item.price}`;
    return `<div class="shop-card ${owned ? 'owned' : ''}">
      <div class="sc-art">${art}</div>
      <div class="sc-name">${item.name}</div>
      ${isHouse ? `<div class="sc-desc">${(item as (typeof HOUSES)[number]).description}</div>` : `<div class="sc-count">${count ? `Du har ${count} i «Mine ting»` : '&nbsp;'}</div>`}
      ${
        owned
          ? `<button class="btn blue" data-move="${item.id}">🏠 ${save.houses.find((x) => x.id === save.activeHouseId)?.style === (item as (typeof HOUSES)[number]).style ? 'Du bor her' : 'Flytt inn'}</button>`
          : `<button class="btn ${save.points >= item.price ? 'green' : 'off'}" data-buy="${item.id}">${price}</button>`
      }
    </div>`;
  }

  function render(): void {
    const items = tab === 'furniture' ? FURNITURE : tab === 'decor' ? DECOR : HOUSES;
    el.innerHTML = `
      <div class="screen-top">
        <button class="btn round back" aria-label="Hjem">🏠</button>
        <h1>🛍️ Butikken</h1>
        <div class="pts-pill">🪙 ${save.points}</div>
      </div>
      <div class="chips">
        <button class="chip ${tab === 'furniture' ? 'on' : ''}" data-t="furniture">🛋️ Møbler</button>
        <button class="chip ${tab === 'decor' ? 'on' : ''}" data-t="decor">✨ Pynt</button>
        <button class="chip ${tab === 'house' ? 'on' : ''}" data-t="house">🏡 Hus</button>
      </div>
      <div class="shop-grid ${tab}">${items.map(card).join('')}</div>`;
    el.querySelector('.back')!.addEventListener('click', () => go(''));
    el.querySelectorAll<HTMLElement>('.chip').forEach((c) =>
      c.addEventListener('click', () => {
        tab = c.dataset.t as Tab;
        sfx.tap();
        render();
      }),
    );
    el.querySelectorAll<HTMLElement>('[data-buy]').forEach((b) =>
      b.addEventListener('click', () => {
        const r = buy(save, b.dataset.buy!);
        if (!r.ok) {
          sfx.nope();
          toast(r.reason === 'too-expensive' ? 'Du trenger flere 🪙. Spill minispill eller stell dyrene dine!' : 'Du har allerede denne.');
          return;
        }
        const { x, y } = centerOf(b);
        update(() => r.save);
        sfx.buy();
        burst(x, y, ['🪙', '✨', '💖'], 8);
        toast(tab === 'house' ? 'Nytt hus! Du har flyttet inn 🏡' : 'Kjøpt! Du finner den i «Mine ting» hjemme.', 'ok');
        render();
      }),
    );
    el.querySelectorAll<HTMLElement>('[data-move]').forEach((b) =>
      b.addEventListener('click', () => {
        const style = HOUSES.find((x) => x.id === b.dataset.move)!.style;
        const house = save.houses.find((x) => x.style === style)!;
        update((s) => ({ ...s, activeHouseId: house.id }));
        go('');
      }),
    );
  }
  render();
  return () => el.remove();
}
