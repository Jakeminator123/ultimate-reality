# SKO-03 · Mynning inåt och framåt

[Spela kortutdraget från Stol 4 och Stol 1](utdrag.html) · [Jämför planvy och fingerkontakt på ruta 1, 17 och 33](grepp.jpg)

Jakobs bild 2 styr enbart skons riktning. I provet betyder 70/30 relativa komponenter i bordsplanet. Från dealerns vänstra sida går mynningen 70 delar in mot mittlinjen (−X) och 30 fram mot kameran för Stol 4 (+Z). Normaliserad riktning är (−0,919145 / 0 / +0,393919), motsvarande −66,80° från +Z. Detta är vår tolkning av fotot och Jakobs uppskattning.

| Prov | Resultat |
| --- | --- |
| Version | `skoriktning-70-30-v1`, utgår från [arbetskant-v4](../skolage-v1/README.md) vid −100°. Nio källposer, 24 mellanlägen och samma första rödryggade kort på 63 × 89 × 0,4 mm. |
| Placering | Centrum X +46, Z −31 cm. Mynning X +39,11, Y +1,80, Z −28,05 cm. Skons fyra fothörn står på filten. Närmaste avstånd till den konkava arbetskanten är 12,98 cm. |
| Rörelse | Skon och den 108 mm långa kortbanan är vridna 33,20° kring skons centrum. Vänsterhanden följer banan, med bibehållna armsegment via den upprätade 08-riggens hudvikter. Kortstapelns lutning är 30°. |
| Kollisionsprov | 0 genomskärningar i 33 av 33 lägen mellan figur och sko/kort/skiva och mellan kort och sko/skiva vid 0,001 mm tolerans. Måttet innefattar 58 038 trianglar på den påklädda figuren. Minsta fingerhudavstånd till kortet inom vardera kontaktfältet ligger mellan 0,0003 och 0,0494 mm. [Kollisionsrapport](matt-utseende.json) · [Kantmått](matt.json) |
| Bildgranskning | Från Stol 4 följer en tydlig fingertopp kortet genom slitsen. Från Stol 1 överlappar fingrarna framför kortet i rutorna 1 och 17. Kortet har lämnat skon på ruta 33 och fingerkontakten kvarstår. Gripkraft och släpp ingår i nästa rörelseprov. |

[Kamera, underlag och utseende](../../dealer/paulina/utseende-01-03-v1/README.md) · [Kortbana med SHA-256 711a8391…](bana.json) · [Riggmått](matt-rigg.json)

## Återskapa

Kör från projektroten med studions SAM-miljö och Volta-pinnade Node. Förändringar av banan eller poserna får en ny versionskatalog.

```powershell
& ../sam-3d-body/.venv/Scripts/python.exe test/artefakter/skoriktning-70-30/vrid.py
Push-Location studio
try {
    $prov = '../test/artefakter/skoriktning-70-30'
    $verktyg = '../test/artefakter/kasinorum-utdrag-100'
    $avatar = '../avatars/paulina/3d/paulina-08-utseende-01-03-v1.glb'
    node "$verktyg/kollisioner.mjs" $prov "$prov/matt-kollisioner.json" "$prov/bana.json" "$prov/kontur.json"
    node "$verktyg/kollisioner.mjs" $prov "$prov/matt-utseende.json" "$prov/bana.json" --utseende $avatar
    node "$verktyg/render.mjs" $prov "$prov/utdrag.html" --alla "$prov/bana.json" $avatar
} finally { Pop-Location }
python test/artefakter/skoriktning-70-30/granska.py
```
