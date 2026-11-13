# Heddas verden — for agenter

## Nye funksjoner vises med video

Nye funksjoner skal demonstreres med et videoopptak av ekte spilling, ikke med stillbilder.

- Format: mp4, 30–90 sekunder, minst 1280×720, jevn bildefrekvens.
- Spill den publiserte siden når utrullingen er ferdig. Bruk en lokal produksjonsbygging bare hvis siden ikke er oppdatert ennå.
- Videoen skal vise hver nye funksjon i bruk, slik en spiller møter den.
- Ikke bruk TEST-ONLY-hjelp i opptaket. Hvis det likevel er nødvendig, skriv det tydelig i rapporten.
- Lagre videoen som artefakt og vis til den i rapporten.

## Kollisjon

Figurer, dyr, biler og andre ting skal ikke gå gjennom hverandre eller gjennom faste objekter. Det gjelder også nye ting som legges inn senere.

- I en ny verden (som hulen) skal hver mesh merkes med `withCollision`: `solid` for noe man stopper mot, `passable` for gress, blomster, lys og skilt, `surface` for gulv. Bruk `solid()` når formen skal bli en collider.
- Byen og skyene har egne collider-lister i tillegg til merkingen. Et nytt fast objekt der må både tegnes og stoppe en gange i en test.
- `npm test` kjører i CI og skal feile hvis en mesh i hulen mangler merking, eller hvis man kan gå gjennom en stein, disken eller ytterveggen.
