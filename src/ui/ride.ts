import { sfx } from '../audio.ts';
import type { OwnedPet } from '../logic/pets.ts';
import { modal } from './dom.ts';
import { petFace, petName } from './petArt.ts';

/** Fly or ride scene. Resolves when the child presses "Ferdig". */
export function rideScene(pet: OwnedPet, mode: 'fly' | 'ride'): Promise<void> {
  sfx.whoosh();
  const clouds = Array.from({ length: 6 }, (_, i) => `<div class="cloud" style="top:${8 + i * 13}%;animation-delay:${-i * 1.3}s;animation-duration:${6 + (i % 3) * 2}s"></div>`).join('');
  const trees = Array.from({ length: 6 }, (_, i) => `<div class="tree" style="animation-delay:${-i * 0.9}s">${['🌳', '🌷', '🌲', '🌼', '🌳', '🍄'][i]}</div>`).join('');
  const trail = Array.from({ length: 5 }, (_, i) => `<span class="trail" style="animation-delay:${i * 0.15}s">${mode === 'fly' ? '✨' : '💨'}</span>`).join('');
  return new Promise((resolve) => {
    const m = modal(
      `<div class="scene scene-${mode}">
        ${clouds}
        ${mode === 'ride' ? `<div class="hills"></div>${trees}` : '<div class="rainbow"></div>'}
        <div class="rider-wrap ${mode}">
          <div class="trails">${trail}</div>
          <div class="rider">🧒</div>
          ${petFace(pet.speciesId, 'big')}
        </div>
        <div class="scene-title">${mode === 'fly' ? `Du flyr på ${petName(pet)}! 🪽` : `Du rir på ${petName(pet)}! 🐎`}</div>
        <button class="btn big pink scene-done" data-close>Ferdig</button>
      </div>`,
      { className: 'scene-modal', onClose: () => resolve() },
    );
    const iv = window.setInterval(() => (mode === 'fly' ? sfx.whoosh() : sfx.tap()), 1800);
    m.el.querySelector('.scene-done')!.addEventListener('click', () => window.clearInterval(iv));
  });
}
