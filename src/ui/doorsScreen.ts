import { sfx } from '../audio.ts';
import { ITEM_INFO, newGame, openDoor, useMagnifier, type DoorContent, type DoorGame } from '../logic/doors.ts';
import { addPoints } from '../logic/shop.ts';
import { addEggPet, save, update } from '../store.ts';
import { burst, centerOf, confetti, floatText, h } from './dom.ts';
import { petFace } from './petArt.ts';
import { go } from './router.ts';

const DOOR_COLORS = ['#ff8fb1', '#7fc8ff', '#ffcf5c', '#9ee07a', '#c88bff'];
const DOOR_TOPS = ['⭐', '💗', '🌸', '🌙', '🍀'];

function contentHtml(c: DoorContent): string {
  if (c.type === 'trap') return '<div class="behind trap"><span>👻</span><b>Bø!</b></div>';
  if (c.type === 'item') return `<div class="behind item"><span>${ITEM_INFO[c.item].emoji}</span><b>${ITEM_INFO[c.item].name}</b></div>`;
  return '<div class="behind safe"><span>🌈</span><b>Trygt!</b></div>';
}

export function mountDoors(root: HTMLElement): () => void {
  let game: DoorGame = newGame(Math.random);
  let busy = false;
  let finished = false;
  const follower = save.pets.find((p) => p.uid === save.followerUid);
  const el = h('div', { class: 'screen doors-screen' });
  root.append(el);
  update((s) => ({ ...s, stats: { ...s.stats, games: s.stats.games + 1 } }));

  function hearts(): string {
    let out = '';
    for (let i = 0; i < Math.max(3, game.lives); i++) out += `<span class="heart ${i < game.lives ? '' : 'empty'}">${i < game.lives ? '❤️' : '🤍'}</span>`;
    return out;
  }

  function render(): void {
    el.innerHTML = `
      <div class="doors-top">
        <button class="btn round back" aria-label="Hjem">🏠</button>
        <div class="title-pill">🚪 Dør-eventyret</div>
        <div class="lives" aria-label="Liv">${hearts()}</div>
      </div>
      <div class="levels">${Array.from({ length: game.totalLevels }, (_, i) => `<span class="lvl ${i < game.level ? 'done' : i === game.level ? 'now' : ''}">${i < game.level ? '⭐' : i + 1}</span>`).join('<i></i>')}<span class="lvl prize">🥚</span></div>
      <p class="doors-hint">Nivå ${game.level + 1}: Velg en dør!</p>
      <div class="door-row n${game.doors.length}">
        ${game.doors
          .map(
            (d, i) => `<button class="door-wrap ${d.opened ? 'open' : ''} ${d.revealed ? 'revealed' : ''}" data-i="${i}" style="--door:${DOOR_COLORS[(i + game.level) % 5]}">
              ${contentHtml(d.content)}
              <div class="door"><span class="door-top">${DOOR_TOPS[(i + game.level * 2) % 5]}</span><span class="knob"></span>${d.revealed ? '<span class="warn">🔍👻</span>' : ''}</div>
            </button>`,
          )
          .join('')}
      </div>
      <div class="doors-bottom">
        <div class="inv-item ${game.keys ? '' : 'none'}">🗝️ <b>${game.keys}</b><small>Nøkkel</small></div>
        <button class="btn yellow magnify" ${game.magnifiers && game.doors.some((d) => d.content.type === 'trap' && !d.opened && !d.revealed) ? '' : 'disabled'}>🔍 Bruk lupe (${game.magnifiers})</button>
        <div class="pts-pill">🪙 ${game.points}</div>
      </div>
      ${follower ? `<div class="cheer">${petFace(follower.speciesId)}<span class="cheer-bubble">Heia!</span></div>` : ''}`;
    el.querySelector('.back')!.addEventListener('click', () => go(''));
    el.querySelector('.magnify')!.addEventListener('click', () => {
      if (busy) return;
      game = useMagnifier(game, Math.random);
      sfx.item();
      render();
    });
    el.querySelectorAll<HTMLElement>('.door-wrap').forEach((b) => b.addEventListener('click', () => pickDoor(Number(b.dataset.i), b)));
  }

  function say(text: string, cls = ''): void {
    const hint = el.querySelector('.doors-hint')!;
    hint.textContent = text;
    hint.className = `doors-hint ${cls}`;
  }

  function pickDoor(i: number, btn: HTMLElement): void {
    if (busy || finished) return;
    const door = game.doors[i];
    if (!door || door.opened || door.revealed) return;
    busy = true;
    const before = game;
    game = openDoor(game, i, Math.random);
    btn.classList.add('open');
    sfx.door();
    const { x, y } = centerOf(btn);
    const ev = game.lastEvent;
    setTimeout(() => {
      if (door.content.type === 'trap') {
        if (ev?.type === 'trap-blocked') {
          sfx.item();
          say('Puh! Gullnøkkelen reddet deg! 🗝️', 'good');
          burst(x, y, ['🗝️', '✨']);
        } else {
          sfx.trap();
          el.classList.add('shake');
          setTimeout(() => el.classList.remove('shake'), 500);
          say(game.status === 'lost' ? 'Å nei, ingen liv igjen!' : 'Bø! Et spøkelse! Du mistet et liv. Prøv en annen dør!', 'bad');
          el.querySelector('.lives')!.innerHTML = hearts();
        }
      } else if (door.content.type === 'item') {
        sfx.item();
        say(ITEM_INFO[door.content.item].text, 'good');
        burst(x, y, [ITEM_INFO[door.content.item].emoji, '✨']);
      } else {
        sfx.safe();
        say('Trygt! Videre! 🌈', 'good');
        burst(x, y, ['🌈', '⭐', '✨'], 8);
      }
      if (game.points > before.points) floatText(x, y - 40, `+${game.points - before.points} 🪙`);
    }, 380);
    const advanced = game.level !== before.level || game.status === 'won';
    setTimeout(() => {
      busy = false;
      if (game.status === 'won') return finish(true);
      if (game.status === 'lost') return finish(false);
      if (advanced) {
        render();
        el.querySelector('.door-row')!.classList.add('slide-in');
      } else {
        el.querySelector('.magnify')?.toggleAttribute('disabled', !(game.magnifiers && game.doors.some((d) => d.content.type === 'trap' && !d.opened && !d.revealed)));
        el.querySelector('.inv-item')!.innerHTML = `🗝️ <b>${game.keys}</b><small>Nøkkel</small>`;
      }
    }, advanced ? 1300 : 1100);
  }

  function finish(won: boolean): void {
    finished = true;
    update((s) => ({ ...addPoints(s, game.points), stats: { ...s.stats, wins: s.stats.wins + (won ? 1 : 0) } }));
    sfx[won ? 'win' : 'lose']();
    if (won) confetti(80);
    const box = h(
      'div',
      { class: `result-card ${won ? 'won' : 'lost'}` },
      won
        ? `<div class="result-big">🏆</div><h2>Du klarte alle dørene!</h2><p>Du fikk <b>${game.points} 🪙</b> og et <b>kjæledyr-egg</b>!</p><button class="btn big pink hatch">🥚 Klekk egget!</button>`
        : `<div class="result-big">🙈</div><h2>Å nei, spøkelsene vant!</h2><p>Du får <b>${game.points} 🪙</b> i trøstepoeng.</p><div class="row"><button class="btn big green again">🔁 Prøv igjen</button><button class="btn big blue home">🏠 Hjem</button></div>`,
    );
    el.append(h('div', { class: 'result-back' }));
    el.append(box);
    box.querySelector('.hatch')?.addEventListener('click', () => {
      addEggPet();
      go('egg');
    });
    box.querySelector('.again')?.addEventListener('click', () => {
      game = newGame(Math.random);
      finished = false;
      el.querySelectorAll('.result-card, .result-back').forEach((n) => n.remove());
      update((s) => ({ ...s, stats: { ...s.stats, games: s.stats.games + 1 } }));
      render();
    });
    box.querySelector('.home')?.addEventListener('click', () => go(''));
  }

  render();
  return () => el.remove();
}
