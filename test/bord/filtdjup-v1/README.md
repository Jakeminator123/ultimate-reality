# Bordsdjup från stol 4 och stol 1

[Öppna bildprovet](index.html) och växla först djup med samma stol. Kontrollera hur mycket filt som ligger mellan kortmålet och armstödet. Växla sedan stol med samma djup och följ pelaren mot bakväggens paneler. [Mätningen](matt.json) innehåller kamerornas siktpunkter, riktningar, synfält, bildpunkter, ytterkonturer och SHA-256 för scendelar och bilder.

| Prov | Bredd × ytterdjup | Främre ytterkant vid X = 0 | Från kortmålets centrum till relingens innerkant vid X = 0 |
| --- | --- | --- | --- |
| Grund | 160 × 108 cm | Z = +56 cm | 36,8 cm |
| Indragen framkant | 160 × 96 cm | Z = +44 cm | 24,8 cm |

Måtten gäller modellens faktiska geometri. Den nya blackjackformen har en dealerkant vid Z = −28 cm på mittlinjen och rundade sidor som når Z = −52 cm. Krysset vid Z = +2 cm är grundkonturens mitt. Det är samma referenspunkt i båda proven. Filten är vågrät och ligger 75 cm över provgolvet. En meter i Three.js motsvarar en meter i modellen. Alla fysiska dimensioner och kameror är antagna.

| Kamera | Ögonhöjd över golv | Blickriktning (X / Y / Z) | Nedåtvinkel | Vertikalt × horisontellt synfält |
| --- | --- | --- | --- | --- |
| Stol 4 | 124 cm | 0 / −0,245 / −0,970 | 14,19° | 48° × 76,72° |
| Stol 1 | 116 cm | +0,888 / −0,201 / −0,415 | 11,57° | 48° × 76,72° |

Scenversionen utgår från Ultimate Realitys `studio/lib/dealer-scene.ts` vid Git-revision `b3f6ada`. Det ursprungliga skissbordets nominella radier var 80 och 54 cm. Provets [sparade koordinatunderlag](layout-v1.json) bevarar ursprunglig sko, bord, kortmål och kameror. [Aktuellt rums- och skoprov](../../bakgrund/kasinorum-v1/README.md) använder studions vinklade kortsko. Provkamerorna är tillbakadragna en faktor 1,34 i X och Z för att få hela armstödet i bild.

Dealers källkod vid `c9d006d` gav två principer för utformningen. `src/scene3d-table.ts` beskriver rundad läderreling, söm och separat filt. `src/scene3d-room.ts` beskriver 3D-parallax. Salong, material, sko och blackjackkontur har skapats i Ultimate Reality. Bilagans 210 × 159 cm, 5° och förslag på 140 cm avser det separata projektet 3d-dealer.

Det tomma bildparet visar en fysisk pelare framför bakväggen. Vid stolbytet förskjuts siktlinjens träff på väggen 137,1 cm i sidled. Skon står på filten. Läder och mässing får sina reflexer från en kubkarta renderad i salongen. Nästa ljusprov kan jämföra en vald interiör-HDRI med salongens kubkarta under samma kamera. Handkontakt och räckvidd kan bedömas när Paulinas separata poseprov har passats in.

## Återskapa bilderna

Från `studio/` med projektets pinnade Node-version, installerade studioberoenden och Microsoft Edge, kör:

```powershell
node ../test/bord/filtdjup-v1/render.mjs
```

En valfri målmapp som sista argument ger en separat export. Exporten bevarar tidigare filer om pixlar eller mått skiljer sig. Öppna `index.html` med de fyra PNG-filerna bredvid. Visaren fungerar även offline.
