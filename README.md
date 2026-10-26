# Pet Doors 🐾🚪

A cute, cartoony pet-adoption game for kids, inspired by the look and feel of pet-adoption games like Roblox's *Adopt Me*. All art, names and text are original. The UI is in Norwegian (bokmål).

**Play:** https://thomasaitest.github.io/pet-doors/

It's a web app (PWA) built for iPad Safari with touch. Add it to the home screen to play full screen and offline. Progress is saved on the device (localStorage). There is no backend, no ads and no tracking.

## What's in v1

- **The home is the hub.** Your pets live in your house, walk around, hop, sit, nap on beds and dance on the dance floor. The side buttons open the **Minispill**, **Dyr** (collection), **Butikk** (shop) and **Design**.
- **Pet needs.** Pets show what they want in speech bubbles: hungry 🍎, thirsty 💧, sleepy 💤, dirty 🫧 (wants a bath), wants to play 🧸, and wants a walk 🌳. You fulfil a need by tapping a care tool, dragging it onto a pet, or dragging the pet onto matching furniture (a bed, bathtub, dance floor, beanbag or table).
- **Growth.** Each fulfilled need gives points and fills the pet's growth bar: Baby → Barn → Tenåring → Voksen. Growing up gives a bonus.
- **Follow me.** One pet follows you. It shows up in the minigame to cheer, and when you tap the floor it walks there.
- **Door minigame (Dør-eventyret).** You start with 3 lives and play 5 levels of doors. Ghost doors cost a life. Item doors give an extra life 💖, a gold key 🗝️ (saves you from one trap) or a magnifier 🔍 (reveals a ghost door). Winning gives points and an egg. Losing gives consolation points.
- **Eggs and rarity.** The egg hatch animation reveals the new pet. Each new pet is one you don't own yet, until the collection is complete. Common animals are most common, insects are slightly rarer, and fantasy animals (unicorn, winged unicorn, dragons) and extinct animals (T-rex, long-neck, mammoth, dodo) are rare.
- **Lucky pets.** A rare roll can make a pet flyable (flying insects, owl, winged unicorn, dragons) or rideable (horse, unicorn, dinosaurs, mammoth). Lucky pets get a badge and a fly or ride scene.
- **Shop.** Furniture is cheap (3–12 points). Decorations include string lights, a disco ball, a dance floor with a "Dansefest!" party, fancy beds, balloons and a clipboard notebook you can write in (saved). There are 4 houses: Koselig hytte (free), Byleilighet, Gårdshus and Trehytte.
- **Building.** Drag furniture with your finger, recolour it, resize it, or put it away. The Design panel sets the wall colour, wallpaper and floor for each house.
- **Sounds.** Happy little sounds are generated with WebAudio (no sound files). There's a mute button in the top bar.

## Development

```bash
npm install
npm run dev      # http://localhost:4740
npm test         # game logic tests (vitest)
npm run build    # type-check + production build in dist/
```

The stack is Vite + TypeScript (vanilla DOM, no framework), with `vite-plugin-pwa` for the manifest and offline service worker. The font is Fredoka, bundled through `@fontsource`.

```
src/logic/   pure, tested game logic: pets & rarity, doors, needs & growth, shop, houses, save
src/ui/      screens: hub (house), door game, egg reveal, collection, shop, fly/ride scene
src/art/     original SVG furniture and window art (recolourable)
src/audio.ts WebAudio sounds
```

Pushing to `main` runs `.github/workflows/deploy.yml`, which installs, tests, builds with `BASE_PATH=/pet-doors/` and deploys to GitHub Pages.

## Data model and the multiplayer plan

Everything lives in one JSON save (`petdoors-save-v1` in localStorage). Each house is a self-contained, serializable object:

```jsonc
{
  "id": "house-…", "style": "treehouse", "name": "Trehytte",
  "wallColor": "#f3e8ff", "wallPattern": "stars", "floor": "clouds",
  "items": [{ "uid": "it-…", "itemId": "sofa", "x": 50, "y": 80, "scale": 1.2, "color": "#ff8fb1", "note": "…" }],
  "permissions": { "ownerId": "player-…", "editors": [], "requests": [] },
  "updatedAt": 1761490000000
}
```

`src/logic/house.ts` already has `canEdit`, `requestEdit`, `grantEdit` (owner only) and `revokeEdit`. Every edit (`placeItem`, `updateItem`, `removeItem`) is a no-op for users who aren't allowed to edit, and this is covered by tests.

**Multiplayer is not in v1.** The plan for later:

1. **Accounts.** Use anonymous sign-in with a parent-managed friend code. There is no public chat, and friends are added by code only.
2. **Backend.** Firebase (Firestore + Auth) or Supabase (Postgres + Realtime + Row Level Security). Either one can store a house document per `id` and stream live changes.
3. **Permission rule.** A friend can visit a house but can only build in it after the owner approves: the friend calls `requestEdit`, and the owner sees the request and taps "Ja" (`grantEdit`). The server enforces this with Firestore security rules or Supabase RLS (`auth.uid() = owner_id OR auth.uid() = ANY(editors)`), so the client checks aren't the only guard.
4. **Live building.** Item moves are sent as small patches (`updateItem`). Last-write-wins per item `uid` is enough for kids building together. Remote players' pets and avatars come later.
5. **Safety.** Friend codes only, no free text between players (notebook notes stay private), and the owner can remove an editor at any time (`revokeEdit`).

## Later: iPad app

The game is already a PWA. The next step is wrapping it with Capacitor for the App Store or TestFlight, which needs an Apple Developer account.
