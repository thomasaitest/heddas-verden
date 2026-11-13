# Heddas verden — for agenter

## Nye funksjoner vises med video

Nye funksjoner skal demonstreres med et videoopptak av ekte spilling, ikke med stillbilder.

- Format: mp4, 30–90 sekunder, minst 1280×720, jevn bildefrekvens.
- Ett sammenhengende opptak. Hvis det må settes sammen av spillbilder, skal ingen steg mangle.
- Spill den publiserte siden når utrullingen er ferdig. Bruk en lokal produksjonsbygging bare hvis siden ikke er oppdatert ennå.
- Videoen skal vise hver nye funksjon i bruk, slik en spiller møter den.
- Ikke bruk TEST-ONLY-hjelp i opptaket. Hvis det likevel er nødvendig, skriv det tydelig i rapporten.
- Lagre videoen som artefakt og vis til den i rapporten.

## Kollisjon

Figurer, dyr, biler, andre spillere og nye ting skal ikke gå gjennom hverandre eller gjennom faste objekter. Det gjelder bakken, byen, butikkene, hus og interiør, alle fire skyene og hulen.

- Gående figurer bruker `AVATAR_BODY_R`, som rekker ut til armen. En mindre sirkel lar armer og bein gå inn i stein.
- I en ny verden skal hver mesh merkes med `withCollision`: `solid` for noe man stopper mot, `passable` for gress, blomster, lys og skilt, `surface` for gulv. Bruk `solid()` når formen skal bli en collider.
- Byen, skyene og huset har egne collider-lister i tillegg. Et nytt fast objekt der må både tegnes og stoppe en gange i en test.
- Andre spillere skyves ut av de samme colliderne når de tegnes.
- `npm test` kjører i CI. Den skal feile hvis en mesh i hulen mangler merking, hvis kroppen kan gå inn i en stein, eller hvis en gange, en bil eller et dyr kan gå gjennom fontenen, et tre, en skykant eller møbler.
