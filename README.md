# Heddas Verden 🌈🐾

A cute 3D pet-adoption game for kids, inspired by the look and feel of Roblox's *Adopt Me*. All art (procedural low-poly models), names and text are original. The UI is in Norwegian (bokmål).

**Play:** https://thomasaitest.github.io/heddas-verden/

It's a web app (PWA) built with three.js for iPad Safari (touch) and desktop. Add it to the home screen to play full screen and offline. Progress is saved on the device (localStorage). No backend, no ads, no tracking.

## What's in it

- **Your own character.** A blocky avatar creator: skin, 8 hairstyles, hair colour, 8 faces, shirt/print/pants/shoes colours, 9 hats and 7 accessories. Saved.
- **A 3D town.** Walk around with a joystick (touch) or WASD/arrows (desktop); drag to turn the camera, pinch/scroll to zoom, jump with ⬆/Space. Places: Hjem, Butikk, Dyrlege, Lekeplass, Eggbutikk and Dørspillet. The 🗺️ map teleports you.
- **Pets.** 30 whole-body 3D pets in 5 rarity tiers (Vanlig → Legendarisk) from 4 eggs. Hatch reveal, naming, up to 2 pets follow you, tap to make them hop, pick them up (Hold), ride rideable pets and fly on flying pets. Potions make any pet ride or fly.
- **Needs (tasks).** Pets get hungry, thirsty, sleepy, dirty, bored or want a walk. Fix them where it makes sense: buy food/drinks in the Butikk and feed them, stand by a bed or bathtub at home, play at the Lekeplass, walk around town. Needs left too long make the pet sick – then take it to the Dyrlege. Every task pays bucks and grows the pet: Nyfødt → Baby → Barn → Tenåring → Ungdom → Voksen.
- **Houses.** Walk in and out through the door. Build mode: 74 furniture/decor items in 10 categories; place, drag, rotate, resize, recolour and put away; wall and floor colours. 4 houses to buy. Owner/editor permissions are stubbed for future multiplayer.
- **Dørspillet.** The old door minigame lives on as a small attraction that pays bucks.

## Development

```bash
npm install
npm run dev      # http://localhost:4740
npm test         # game logic tests (vitest)
npm run build    # type-check + production build in dist/
node scripts/shots.mjs http://localhost:4740/   # headless screenshots (needs Chrome)
```

```
src/logic/   pure, tested game logic: pets/eggs, needs/ageing, catalog, houses, avatar, economy, save, doors
src/three/   procedural 3D: pets, avatar, furniture, town, house interior
src/ui/      HUD and panels (shop, eggs, pets, map, avatar creator, build, door game)
src/game.ts  game loop, movement, camera, pet AI, care zones
```

Pushing to `main` runs `.github/workflows/deploy.yml` (install, test, build with `BASE_PATH=/heddas-verden/`, deploy to GitHub Pages).

## Flerspiller

Se [docs/MULTIPLAYER.md](docs/MULTIPLAYER.md). Kort: `cd server && npm run dev`, så `npm run dev` med `VITE_MP_URL=ws://127.0.0.1:8787`.
