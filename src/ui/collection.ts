import { sfx } from '../audio.ts';
import { CATEGORY_INFO, RARITY_LABEL, SPECIES, SPECIES_BY_ID, rarityOf, type PetCategory } from '../logic/pets.ts';
import { growthProgress, stageOf, type PetState } from '../logic/needs.ts';
import { save, update } from '../store.ts';
import { h, modal } from './dom.ts';
import { petBadges, petFace, petName } from './petArt.ts';
import { rideScene } from './ride.ts';
import { go } from './router.ts';

export function growthBar(p: PetState): string {
  const st = stageOf(p.growth);
  return `<div class="growth"><span>${st.name}</span><div class="gbar"><i style="width:${Math.round(growthProgress(p.growth) * 100)}%"></i></div></div>`;
}

export function petDetails(p: PetState, onChange?: () => void): void {
  const s = SPECIES_BY_ID[p.speciesId];
  const info = CATEGORY_INFO[s.category];
  const m = modal(
    `<div class="pet-detail" style="--cat:${info.color}">
      <div class="pd-face">${petFace(p.speciesId, 'huge bob')}</div>
      <h2>${petName(p)}</h2>
      <div class="ribbon" style="--cat:${info.color}">${RARITY_LABEL[rarityOf(s)]} · ${info.label}</div>
      ${growthBar(p)}
      <div class="reveal-badges">${petBadges(p)}</div>
      <div class="row wrap">
        <button class="btn ${save.followerUid === p.uid ? 'yellow' : 'blue'} follow">${save.followerUid === p.uid ? '⭐ Følger deg' : '⭐ Følg meg!'}</button>
        ${p.flyable ? '<button class="btn pink fly">🪽 Fly!</button>' : ''}
        ${p.rideable ? '<button class="btn green ride">🐎 Ri!</button>' : ''}
        <button class="btn ghost" data-close>Lukk</button>
      </div>
    </div>`,
  );
  m.el.querySelector('.follow')!.addEventListener('click', () => {
    sfx.pop();
    update((x) => ({ ...x, followerUid: p.uid }));
    m.close();
    onChange?.();
  });
  m.el.querySelector('.fly')?.addEventListener('click', () => {
    m.close();
    void rideScene(p, 'fly');
  });
  m.el.querySelector('.ride')?.addEventListener('click', () => {
    m.close();
    void rideScene(p, 'ride');
  });
}

export function mountCollection(root: HTMLElement): () => void {
  let filter: PetCategory | 'all' = 'all';
  const el = h('div', { class: 'screen collection-screen' });
  root.append(el);
  function render(): void {
    const owned = new Map<string, PetState[]>();
    for (const p of save.pets) owned.set(p.speciesId, [...(owned.get(p.speciesId) ?? []), p]);
    const list = SPECIES.filter((s) => filter === 'all' || s.category === filter);
    el.innerHTML = `
      <div class="screen-top">
        <button class="btn round back" aria-label="Hjem">🏠</button>
        <h1>🐾 Mine dyr <small>${owned.size} / ${SPECIES.length}</small></h1>
        <div class="pts-pill">🪙 ${save.points}</div>
      </div>
      <div class="chips">
        <button class="chip ${filter === 'all' ? 'on' : ''}" data-f="all">Alle</button>
        ${(Object.keys(CATEGORY_INFO) as PetCategory[]).map((c) => `<button class="chip ${filter === c ? 'on' : ''}" data-f="${c}" style="--cat:${CATEGORY_INFO[c].color}">${CATEGORY_INFO[c].label}</button>`).join('')}
      </div>
      <div class="pet-grid">
        ${list
          .map((s) => {
            const mine = owned.get(s.id);
            const p = mine?.[mine.length - 1];
            const info = CATEGORY_INFO[s.category];
            if (!p) return `<div class="pet-card locked" style="--cat:${info.color}"><div class="pc-face">${petFace(s.id, 'silhouette')}</div><div class="pc-name">???</div><div class="pc-rarity">${RARITY_LABEL[info.rarity]}</div></div>`;
            return `<button class="pet-card" data-uid="${p.uid}" style="--cat:${info.color}">
              ${save.followerUid === p.uid ? '<span class="star-tag">⭐</span>' : ''}
              <div class="pc-face">${petFace(s.id, 'bob')}</div>
              <div class="pc-name">${s.name}${mine!.length > 1 ? ` ×${mine!.length}` : ''}</div>
              ${growthBar(p)}
              <div class="pc-badges">${petBadges(p)}</div>
            </button>`;
          })
          .join('')}
      </div>
      ${save.pets.length === 0 ? '<p class="empty">Du har ingen dyr ennå. Spill minispillet for å vinne et egg! 🥚</p>' : ''}`;
    el.querySelector('.back')!.addEventListener('click', () => go(''));
    el.querySelectorAll<HTMLElement>('.chip').forEach((c) =>
      c.addEventListener('click', () => {
        filter = c.dataset.f as PetCategory | 'all';
        sfx.tap();
        render();
      }),
    );
    el.querySelectorAll<HTMLElement>('.pet-card[data-uid]').forEach((c) =>
      c.addEventListener('click', () => {
        sfx.pop();
        const p = save.pets.find((x) => x.uid === c.dataset.uid);
        if (p) petDetails(p, render);
      }),
    );
  }
  render();
  return () => el.remove();
}
