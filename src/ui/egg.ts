import { sfx } from '../audio.ts';
import { CATEGORY_INFO, RARITY_LABEL, SPECIES_BY_ID, rarityOf } from '../logic/pets.ts';
import { save, update } from '../store.ts';
import { confetti, h } from './dom.ts';
import { petBadges, petFace } from './petArt.ts';
import { go } from './router.ts';

export function mountEgg(root: HTMLElement): () => void {
  const pet = save.pets.find((p) => p.uid === save.pendingReveal);
  if (!pet) {
    go('');
    return () => {};
  }
  const species = SPECIES_BY_ID[pet.speciesId];
  const rarity = rarityOf(species);
  const info = CATEGORY_INFO[species.category];
  const sparkly = rarity === 'sjelden' || pet.flyable || pet.rideable;
  const el = h(
    'div',
    { class: 'screen egg-screen' },
    `<div class="rays"></div>
    <h1 class="egg-title">Et nytt egg! 🥚</h1>
    <p class="egg-hint">${sparkly ? 'Oi, det glitrer! ✨ ' : ''}Trykk på egget for å klekke det!</p>
    <div class="egg-stage">
      <div class="egg ${sparkly ? 'sparkly' : ''}" role="button" aria-label="Egg">
        <div class="egg-top"></div><div class="egg-bottom"></div>
        <div class="crack c1"></div><div class="crack c2"></div>
      </div>
      <div class="pedestal"></div>
    </div>
    <div class="reveal hidden">
      <div class="reveal-pet">${petFace(pet.speciesId, 'huge')}</div>
      <div class="ribbon" style="--cat:${info.color}">${RARITY_LABEL[rarity]} · ${info.label}</div>
      <h2 class="reveal-name">${species.name}</h2>
      <div class="reveal-badges">${petBadges(pet)}</div>
      ${pet.flyable || pet.rideable ? `<p class="lucky">🍀 Heldig! ${pet.flyable ? 'Dette dyret kan fly!' : 'Du kan ri på dette dyret!'}</p>` : ''}
      <div class="row">
        <button class="btn big green" data-go="">🏠 Ta med hjem</button>
        <button class="btn big blue" data-go="dyr">🐾 Se samlingen</button>
      </div>
    </div>`,
  );
  root.append(el);
  let taps = 0;
  const egg = el.querySelector<HTMLElement>('.egg')!;
  egg.addEventListener('click', () => {
    if (taps >= 3) return;
    taps++;
    egg.classList.remove('wobble');
    void egg.offsetWidth;
    egg.classList.add('wobble', `cracked-${taps}`);
    sfx.wobble();
    if (taps === 3) {
      setTimeout(() => {
        egg.classList.add('hatch');
        setTimeout(() => el.classList.add('hatched'), 350);
        sfx.hatch();
        confetti(rarity === 'sjelden' ? 120 : 60);
        setTimeout(() => el.querySelector('.reveal')!.classList.remove('hidden'), 350);
        el.querySelector('.egg-hint')!.textContent = '';
        el.querySelector('.egg-title')!.textContent = 'Hurra! Et nytt kjæledyr!';
        update((s) => ({ ...s, pendingReveal: null }));
      }, 450);
    }
  });
  el.querySelectorAll<HTMLElement>('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go!)));
  return () => el.remove();
}
