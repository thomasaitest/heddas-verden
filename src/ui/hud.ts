import { NEED_INFO, type PetState } from '../logic/needs.ts';
import { bucksText, button, el } from './dom.ts';

export interface HudActions {
  bag(): void;
  pets(): void;
  avatar(): void;
  map(): void;
  build(): void;
  sound(): void;
  interact(): void;
  hold(): void;
  ride(): void;
  fly(): void;
  feed(): void;
}

export interface PetActionState {
  any: boolean;
  holding: boolean;
  riding: boolean;
  flying: boolean;
  canRide: boolean;
  canFly: boolean;
  hungry: boolean;
}

export class Hud {
  root: HTMLElement;
  bucks: HTMLElement;
  tasks: HTMLElement;
  prompt: HTMLButtonElement;
  buildBtn: HTMLButtonElement;
  soundBtn: HTMLButtonElement;
  where: HTMLElement;
  joyZone: HTMLElement;
  joyBase: HTMLElement;
  joyKnob: HTMLElement;
  jump: HTMLButtonElement;
  petBar: HTMLElement;
  private petBtns: Record<'hold' | 'ride' | 'fly' | 'feed', HTMLButtonElement>;
  private lastTasks = '';

  constructor(host: HTMLElement, a: HudActions) {
    this.bucks = el('span', { class: 'bucks-n' }, '0');
    this.soundBtn = button('🔊', a.sound, 'btn round small');
    this.where = el('div', { class: 'where' }, 'Byen');
    const top = el(
      'div',
      { class: 'hud-top' },
      el('div', { class: 'bucks' }, el('span', { class: 'coin' }, 'B'), this.bucks),
      this.where,
      el('div', { class: 'hud-top-right' }, this.soundBtn),
    );
    this.tasks = el('div', { class: 'tasks' });
    this.prompt = button('', a.interact, 'btn prompt hidden');
    this.buildBtn = button(el('span', {}, '🔨', el('b', {}, 'Bygg')), a.build, 'btn dock-btn build hidden');
    const dock = el(
      'div',
      { class: 'dock' },
      button(el('span', {}, '🎒', el('b', {}, 'Sekk')), a.bag, 'btn dock-btn bag'),
      button(el('span', {}, '🐾', el('b', {}, 'Dyr')), a.pets, 'btn dock-btn pets'),
      button(el('span', {}, '🧍', el('b', {}, 'Avatar')), a.avatar, 'btn dock-btn avatar'),
      button(el('span', {}, '🗺️', el('b', {}, 'Kart')), a.map, 'btn dock-btn map'),
      this.buildBtn,
    );
    this.joyKnob = el('div', { class: 'joy-knob' });
    this.joyBase = el('div', { class: 'joy-base' }, this.joyKnob);
    this.joyZone = el('div', { class: 'joy-zone' }, this.joyBase);
    this.jump = el('button', { class: 'btn jump', type: 'button' }, '⬆');
    this.petBtns = {
      hold: button('🤲 Hold', a.hold, 'btn pet-act'),
      ride: button('🐎 Ri', a.ride, 'btn pet-act'),
      fly: button('🪽 Fly', a.fly, 'btn pet-act'),
      feed: button('🍎 Mat', a.feed, 'btn pet-act'),
    };
    this.petBar = el('div', { class: 'pet-bar' }, this.petBtns.feed, this.petBtns.hold, this.petBtns.ride, this.petBtns.fly);
    this.root = el('div', { class: 'hud' }, top, this.tasks, this.prompt, dock, this.petBar, this.joyZone, this.jump);
    host.append(this.root);
  }

  setBucks(n: number) {
    this.bucks.textContent = bucksText(n);
  }
  bumpBucks() {
    this.bucks.parentElement!.classList.remove('bump');
    void this.bucks.offsetWidth;
    this.bucks.parentElement!.classList.add('bump');
  }

  setTasks(pets: PetState[], onTap: (uid: string) => void) {
    const key = pets.map((p) => `${p.uid}:${p.name}:${p.need?.kind}:${Math.round((p.need?.progress ?? 0) * 20)}`).join('|');
    if (key === this.lastTasks) return;
    this.lastTasks = key;
    this.tasks.replaceChildren();
    const withNeed = pets.filter((p) => p.need);
    if (!withNeed.length) return;
    this.tasks.append(el('div', { class: 'tasks-title' }, 'Oppgaver'));
    for (const p of withNeed) {
      const info = NEED_INFO[p.need!.kind];
      const card = el(
        'button',
        { class: `task ${p.need!.kind === 'syk' ? 'sick' : ''}`, type: 'button', onclick: () => onTap(p.uid) },
        el('span', { class: 'task-emoji' }, info.emoji),
        el(
          'span',
          { class: 'task-text' },
          el('b', {}, `${p.name}: ${info.label}`),
          el('small', {}, info.hint),
          el('span', { class: 'bar' }, el('i', { style: { width: `${Math.round(p.need!.progress * 100)}%` } })),
        ),
        el('span', { class: 'task-pay' }, `+${info.reward}`),
      );
      this.tasks.append(card);
    }
  }

  setPrompt(label: string | null) {
    if (!label) {
      this.prompt.classList.add('hidden');
      return;
    }
    if (this.prompt.textContent !== label) this.prompt.textContent = label;
    this.prompt.classList.remove('hidden');
  }

  setPetActions(s: PetActionState) {
    this.petBar.classList.toggle('hidden', !s.any);
    this.petBtns.hold.textContent = s.holding ? '🤲 Slipp' : '🤲 Hold';
    this.petBtns.hold.classList.toggle('hidden', s.riding);
    this.petBtns.ride.classList.toggle('hidden', !s.canRide || s.holding);
    this.petBtns.ride.textContent = s.riding ? '🛑 Gå av' : '🐎 Ri';
    this.petBtns.fly.classList.toggle('hidden', !s.canFly || s.holding);
    this.petBtns.fly.textContent = s.flying ? '🛬 Land' : '🪽 Fly';
    this.petBtns.feed.classList.toggle('hidden', !s.hungry);
  }

  setMode(mode: 'town' | 'house', label: string, canBuild: boolean) {
    this.where.textContent = label;
    this.buildBtn.classList.toggle('hidden', !(mode === 'house' && canBuild));
  }
}
