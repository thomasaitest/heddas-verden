import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { unlockAudio } from './audio.ts';
import { save } from './store.ts';
import { mountHub } from './ui/hub.ts';
import { mountDoors } from './ui/doorsScreen.ts';
import { mountEgg } from './ui/egg.ts';
import { mountCollection } from './ui/collection.ts';
import { mountShop } from './ui/shopScreen.ts';
import { currentRoute, go } from './ui/router.ts';

const app = document.getElementById('app')!;
let unmount: (() => void) | null = null;

const routes: Record<string, (root: HTMLElement) => () => void> = {
  '': mountHub,
  minispill: mountDoors,
  egg: mountEgg,
  dyr: mountCollection,
  butikk: mountShop,
};

function route(): void {
  let r = currentRoute();
  if (save.pendingReveal && r !== 'egg') r = 'egg';
  const mount = routes[r] ?? mountHub;
  document.querySelectorAll('.modal-back').forEach((m) => m.remove());
  unmount?.();
  app.className = `route-${r || 'hjem'}`;
  unmount = mount(app);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
window.addEventListener('pointerdown', unlockAudio, { capture: true });
// No pinch-zoom or double-tap zoom while playing on iPad.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

if (save.pendingReveal && currentRoute() !== 'egg') go('egg');
else route();

registerSW({ immediate: true });
