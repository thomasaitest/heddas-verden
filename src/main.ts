import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { unlockAudio } from './audio.ts';
import { Game } from './game.ts';
import { feedMenu, openAvatar, openBag, openBuild, openDoors, openEggs, openMap, openPets, openShop, openVetInfo, starterFlow } from './ui/panels.ts';

window.addEventListener('pointerdown', unlockAudio, { capture: true });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

async function boot() {
  try {
    await document.fonts.ready;
  } catch {
    /* ignore */
  }
  const game = new Game(document.getElementById('world')!, document.getElementById('ui')!);
  game.panels = {
    openBag: () => openBag(game),
    openPets: () => openPets(game),
    openAvatar: () => openAvatar(game),
    openMap: () => openMap(game),
    openBuild: () => openBuild(game),
    openShop: () => openShop(game),
    openEggs: () => openEggs(game),
    openDoors: () => openDoors(game),
    openVetInfo: () => openVetInfo(game),
    feedMenu: (uid) => feedMenu(game, uid),
  };
  game.start();
  document.getElementById('loading')?.remove();
  starterFlow(game);
  // Handy for debugging and automated screenshots.
  (window as unknown as { __hv: Game }).__hv = game;
}

void boot();
registerSW({ immediate: true });
