# Paulinas kroppar och prov

**För dagens giv behövs en kropp.** Öppna [tvåkortsgiven](http://127.0.0.1:4317/modellering/sekvens?dealer=paulina&id=3003aba81a5e84f1afc19143b9fab370e1a508360e5aa8849bd68d690c0d8a59). Sittmodell v4 ger spader två och hjärter sju. Tagning 8 slutar redo vid skon, tagning 9 med händerna i vila. Båda använder kropp `fc3b1388` och basfotoyta `5c30d34f`. Den inbakade axel- och hårkorrigeringen kommer från ytprovets filmkvitto `cc076aa7`. [Receptet för båda tagningarna](../test/dealer/paulina/giv-sam-v4-v8/fotoyta.py) · [Handen över sjuan](../test/dealer/paulina/handgranskning-v8-v9/kortytor.json)

## Kroppar och lagring

SHA-256 visas med åtta inledande tecken. I avatarens `3d/` finns 13 namngivna GLB-filer utanför det innehållsadresserade versionslagret. Varje rad anger vilken användare eller vilket prov som använder modellen.

| Plats under `avatars/paulina/3d/` | Användning |
| --- | --- |
| `paulina-08-sittande-v1.glb`, `paulina-08-bordsvila-v2.glb`, `paulina-08-utseende-01-03-v1.glb`, `paulina-08-rak-v1.glb` | Bild 08 gav en separat sittpose. Bordsvila, fotoytan från 01/03 och den upprätade kroppen driver äldre utdrags- och rumsprov. Två JPG-filer i samma mapp visar 08 i visaren. [08 med fotoyta](../test/dealer/paulina/utseende-01-03-v1/bygg.py) · [Äldre modellval](../studio/app/ovrigt/ModelingArchive.tsx) |
| `paulina-fas1-sittfront-v1.glb` | Första sittfrontens triangelyta `af1d589e`. Mätningen jämför den med de tre bilderna. [Sittfront v1](../test/dealer/paulina/fas1-sittande-v1/matt.json) |
| `fas1-v2/` | Grundvisarens kropp `e8e45003` och fotoyta `0f389edf`. De driver blink-, hand- och samspelsproven på v2. [Modellval och filkontroll](../studio/lib/current-model.ts) |
| `fas1-v3/` | Neutral kropp `4b183168`. Granskningen jämför v2, v3 och v4 i samma kameror. [Registrerat profilprov](../avatars/paulina/fas-1/v1/granskning/sittmodellprov-v3.json) |
| `fas1-v4/` | Kropp `fc3b1388`. Fyra separata ytversioner följer grundytan `c2964291`, näspassningen `c3b76a38`, fotoyta 2 `98fe17e3` och ögonpassningen `5c30d34f`. Givprov 1, 2 respektive 3–9 använder de tre senare. [Modellregister](../avatars/paulina/fas-1/v1/granskning/sittmodellprov.json) · [Fyra ytversioner](../avatars/paulina/3d/fas1-v4/utseende/) |
| `versioner/` | `aktiv.json` pekar på v2. `utgavor` och `bildregister` beskriver bildutgåvan. `modeller`, `rorelser`, `filmer` och `granskningar` knyter en version till källor och granskningar. `filer` innehåller själva mediet. Filmregistret innehöll 22 kvitton för 21 tagningar vid genomgången. [Materialversioner](MATERIALVERSIONER.md) |

## Provkatalog

Katalogen omfattar **46 av 46 provmappar** direkt under [test/dealer/paulina](../test/dealer/paulina/), avlästa den 20 november 2026. Kvitton, faktiska filhashar, skriptens inläsning och studions visningsvägar avgör rollen. Ett registrerat prov kan vara källa till nästa tagning även om det inte längre öppnas först.

### Giv och korrigerad fotoyta på sittmodell v4

| Provmapp | Vad den används till |
| --- | --- |
| `giv-sam-v4-v1` | Överför den registrerade rörelsen `9b5b0d0a` från samspel v2 prov 4 till v4. Den första registrerade v4-rörelsen är `1f42c546`. Undermappen `ogonprov` producerar den fotoyta som används i givprov 2. [Överföring](../test/dealer/paulina/giv-sam-v4-v1/retarget.py) · [Ögonprov](../test/dealer/paulina/giv-sam-v4-v1/ogonprov/README.md) |
| `giv-sam-v4-v2`, `giv-sam-v4-v3` | Prov 2 sätter den bearbetade fotoytan på giv 1. Prov 3 använder giv 2 för ögonpassningen och bygger in de korrigerade blinkytorna. [Prov 2](../test/dealer/paulina/giv-sam-v4-v2/bygg.py) · [Prov 3](../test/dealer/paulina/giv-sam-v4-v3/passad_blink.py) |
| `giv-sam-v4-v4`, `giv-sam-v4-v5` | Prov 4 bygger om handreturen från prov 3. Prov 5 läser v4-provets handmått, tidslinje och kortbana och passar startposen vid skon. **Giv 5 är rörelsekällan till giv 9.** [Handretur](../test/dealer/paulina/giv-sam-v4-v4/retur.py) · [Startpose](../test/dealer/paulina/giv-sam-v4-v5/bygg_redo.py) |
| `giv-sam-v4-v6`, `giv-sam-v4-v7` | Prov 6 använder prov 5 och slutar redo för nästa kort. Prov 7 justerar höger handled på vägen tillbaka. **Giv 7 är rörelsekällan till giv 8.** [Återgång till skon](../test/dealer/paulina/giv-sam-v4-v6/retur_redo.py) · [Handleden](../test/dealer/paulina/giv-sam-v4-v7/handled.py) |
| `fotolager-sam-v4-v1`, `fotolager-sam-v4-v2` | Hårprovet utgår från giv 6. Axelprovet läser hårprovets byggare och levererar kroppen och hårets färgtexturer till giv 8 och 9. [Axelytan](../test/dealer/paulina/fotolager-sam-v4-v2/axelyta.py) |
| `giv-sam-v4-v8`, `giv-sam-v4-v9` | Sekvensens två spelbara animerade modeller är `6e8d808f` och `3d216ea7`. V8:s gemensamma recept bygger båda kroppsexporterna. [Recept för tagning 8 och 9](../test/dealer/paulina/giv-sam-v4-v8/fotoyta.py) · [Filmregister för 9](../test/dealer/paulina/giv-sam-v4-v9/registrering.json) |
| `a23-giv-v5-v6`, `handgranskning-v8-v9` | Den första jämför start, landning och två slutposer i giv 5/6. Den andra mäter och granskar hand, nagelkanter och kontakt på hjärter sju i giv 9. [A2.3-jämförelse](../test/dealer/paulina/a23-giv-v5-v6/kontroll.json) · [Handgranskning](../test/dealer/paulina/handgranskning-v8-v9/v9-nagelrand-och-tumflack-kallpixlar.png) |

### Sittmodell v2 och rörelser som har återanvänts

| Provmapp | Vad den används till |
| --- | --- |
| `ansiktsrigg-v2-v1`, `ansiktsrigg-v2-v2` | Registrerade blinkningar med rörelse `3ce36bb4` och `b6c4caf5`. V2-riggens korrigerade blinkning kombineras med händerna i samspelsserien. [Blinkprov 2](../test/dealer/paulina/ansiktsrigg-v2-v2/README.md) |
| `kortdrag-v2-v1`, `tvahandsgiv-v2-v1`, `tvahandsgiv-v2-v2`, `tvahandsgiv-v2-v3`, `tvahandsgiv-v2-v4` | Ett vänsterhandsutdrag blir en tvåhandsgiv. Följande versioner passar lågt byte, grepp, utskjut och korttryck. Samspelsbyggena läser motsvarande handmodeller. Handlösaren i v4 används också av returen i `giv-sam-v4-v4`. [Första handbygget](../test/dealer/paulina/tvahandsgiv-v2-v1/bygg.py) · [Greppverktyget](../test/dealer/paulina/tvahandsgiv-v2-v4/grepp.py) |
| `samspel-v2-v1`, `samspel-v2-v2`, `samspel-v2-v3`, `samspel-v2-v4`, `samspel-v2-v5` | Fem registrerade filmer förenar händer och blinkning. Prov 4 ger rörelsen till v4-kroppen. Prov 5 använder prov 4 med bearbetad näsa och finns som separat jämförelse. [Rörelseprov i studion](http://127.0.0.1:4317/modellering/rorelseprov) · [Bygget för prov 5](../test/dealer/paulina/samspel-v2-v5/bygg.py) |
| `ansiktsyta-v2-v1`, `samspel-v2-bildkontroll-v1` | Första mappen provar ansiktsljus och fotografisk yta på samspel 1. Den andra bevarar skärmbild, avkodad filmruta och renderad källa från samma ruta. Materialvisaren kan läsa den avkodade rutan direkt. [Ansiktsyteprovet](../test/dealer/paulina/ansiktsyta-v2-v1/README.md) · [Rutkontrollen](../test/dealer/paulina/samspel-v2-bildkontroll-v1/README.md) |
| `profilnasa-v2-v1`, `nasprofil-v2-v1` | Den ortografiska jämförelsebilden från första mappen är indata i den andras lokala formkorrigering. Samspel 5 använder den korrigeringen. Naspassningen på v4 importerar verktyget. [Formpassning](../test/dealer/paulina/nasprofil-v2-v1/form.py) |
| `skelett-led-v2-v1` | En ensam jämförelsebild av ansiktsleder före och efter byte av fotoyta. Ingen separat konsument i studions kod hittades. Bilden kan öppnas direkt. [Jämförelsebild](../test/dealer/paulina/skelett-led-v2-v1/ansikte-framifran-fore-efter-fotoyta.jpg) |

### Grundbilder, äldre kroppsprov och bordet

| Provmapp | Vad den används till |
| --- | --- |
| `fotomall-v1`, `fas-1-granskning-v1`, `fas1-sittande-bildskala-v1` | Fotomallsrutten läser material från det första provet. Det andra bevarar kortvändning C och D samt deras härledning. Det tredje innehåller tre bildjämförelser av skala och sits. Den levande skalvyn läser utgåvans egna mätpunkter. [Fotomallens inläsning](../studio/app/fotomall.html/route.ts) · [Kortvändningarna](../test/dealer/paulina/fas-1-granskning-v1/generering.json) · [Bildskalans jämförelse](../test/dealer/paulina/fas1-sittande-bildskala-v1/samma-bildskala.jpg) |
| `fas1-sittande-v1`, `fas1-sittande-v2`, `fas1-sittande-v3`, `fas1-sittande-v4` | V1 dokumenterar sittfrontens första geometri, v2 modellvisarens rigg och fotoyta, v3 den neutrala kroppen med nya profilen, v4 givmodellens geometri och ytpassning. V4:s jämförelse läser äldre resultat i samma kameror. [Jämförelsebygge](../test/dealer/paulina/fas1-sittande-v4/jamfor.py) · [Näsan på v4](../test/dealer/paulina/fas1-sittande-v4/naspassning.py) |
| `08-bordskontroll-v1`, `referensvinkel-08-vila-v1`, `bordsvila-v2` | Det första mäter hur bordspixlar i bild 08 påverkar SAM. Det andra jämför 08 med sittkroppen 05/03. Bordsvilan mäter de omposerade figurernas händer mot filten. 08:s bordsvilomodell blir källa till den äldre fotoytan. [Bordspixlar](../test/dealer/paulina/08-bordskontroll-v1/matt.json) · [Vilojämförelse](../test/dealer/paulina/referensvinkel-08-vila-v1/matt.json) · [Bordsvila](../test/dealer/paulina/bordsvila-v2/matt.json) |
| `utseende-01-03-v1`, `hallning-08-v1`, `08-rak-v1`, `kasinorum-utdrag-100` | Fotoytan med kostym och tatueringar på 08 används i det vridbara rummet. Hållningen mäts mot lodlinje, och den upprätade kroppen jämförs med tidigare passning. Utdraget finns i två lokala passningar under v2/v3. [Rumsvisarens modell](../studio/app/bordsprov/rum3d/[[...asset]]/route.ts) · [08 före och efter](http://127.0.0.1:4317/bordsprov/paulina-rak) · [Utdraget](../test/dealer/paulina/kasinorum-utdrag-100/README.md) |
| `filtdjup-v1-bild05`, `filtdjup-v1-sits406` | Två sits- och bordsprov med den äldre 05-kroppen. Det senare länkar till första provet och levererar den GLB som läses av prov för större bord och vänster kortsko. [Sitsprovet](../test/dealer/paulina/filtdjup-v1-sits406/README.md) · [Bordsrenderingen](../test/bord/storre-bord-v1/render.mjs) |

## Mellanresultatens användning

| Lokal mellanexport | Kontroll av innehåll och användning |
| --- | --- |
| `giv-sam-v4-v1/utprovning` | Gammal rörelse `62def580` använder grundytan `c2964291`. Dagens recept med samma yta kördes isolerat och gav `3a3babab`. Kortbanan matchade, medan rörelse, mätning och tidslinje avvek. Den gamla modellen har en egen dokumenterad yta och saknar bevis för exakt återskapande. |
| `giv-sam-v4-v3/utprovning` | Blinkbygget öppnar GLB `6db7ab4b` och kräver dess exakta hash. Samma bygge läser mätning, tidslinje och kortbana från mellanmappen. Ögonjämförelsens provläge läser den avvikande filmexporten `360ba0a8`. Mellanmappens ruta 26 och 46 har egna bildbytes. De övriga 16 granskningsbilderna finns under samma rutnummer i [tagningens rot](../test/dealer/paulina/giv-sam-v4-v3/). [Blinkbygge](../test/dealer/paulina/giv-sam-v4-v3/passad_blink.py) · [Ögonjämförelse](../test/dealer/paulina/giv-sam-v4-v3/ogonbilder.py) |
| `giv-sam-v4-v5/filmprov-548f3e17`, `filmprov-f0b4705b` | Två tidiga v5-rörelser med egna filmer. V6:s `prov-4da0a693` anger den första som rörelsekälla. Dess `utprovning` anger den andra. Filmerna skiljer sig från registrerad v5. [Källbevis för första återgången](../test/dealer/paulina/giv-sam-v4-v6/prov-4da0a693/matning.json) · [Källbevis för andra återgången](../test/dealer/paulina/giv-sam-v4-v6/utprovning/matning.json) |

### Undermappar som kan se ut som ytterligare riggar

| Förälder | Vad som finns under provet |
| --- | --- |
| `08-rak-v1`, `utseende-01-03-v1`, `fotomall-v1` | `fore/efter` innehåller bildserier med tagningens kvitto. `bildprov/bordskant` innehåller granskningsbilder av 08. `kallbilder` i fotomallen levererar fem lokala WebP-bilder. |
| `fas1-sittande-v2`, `fas1-sittande-v4` | `utseende` dokumenterar fotoytans källor. V2 har också granskningsrendering. V4:s `ogonpassning` har bildjämförelser, recept och olika blinkytor. [Passning av ögat](../test/dealer/paulina/fas1-sittande-v4/ogonpassning/README.md) |
| `fotolager-sam-v4-v1`, `fotolager-sam-v4-v2` | `axelkontroll` och `renderade` bevarar före-/efterbilder. V1 har även `provbilder/baklockar-bena`, `fore` och `efter`. Under varje `renderade/fore` och `renderade/efter` finns 54 PNG-rutor och ett kvitto. [Filmbygge](../test/dealer/paulina/fotolager-sam-v4-v1/film.py) |
| `giv-sam-v4-v1`, `giv-sam-v4-v3` | Ögonprovet och de två `utprovning`-mapparna beskrivs ovan. V3:s `prov-med-slat-lockhud` har en separat GLB `fd8b19e6` och sex mätfiler. Den GLB:n skiljer sig från både den registrerade rörelsen och blinkbyggets mellanexport. |
| `giv-sam-v4-v4` | `a23-nulage` mäter startposen. `filmprov-handvila` och `filmprov-synlig-manschett` innehåller alternativa filmer med olika rörelser, `6d9bcf65` och `168704fc`. `kontaktprov-1/2/3/5/6/8` innehåller var sitt resultat för händelser, kollisionskontroll, kortbana, vilohand och tidslinje. Den registrerade v4-rörelsen är `7e58f88f`. |
| `giv-sam-v4-v5`, `giv-sam-v4-v6` | V5:s `ledprov-184e1332/5bcd7408/8516959c/9117d9ed` och `tryckprov-1` bevarar kandidatposer, mått och tidslinjer. V5:s två avvikande `filmprov` är knutna till de tidigare v6-källorna ovan. V6:s `prov-b6362320` har en annan GLB med källrörelse `597f82e0`. Den registrerade v6-rörelsen är `62ebe398`. |
| `kasinorum-utdrag-100`, `kortdrag-v2-v1`, `tvahandsgiv-v2-v1` | Utdragets `v2` och `v3` har varsin serie med nio nyckelposer. Handprovens lokala `versioner` bevarar tidigare GLB-varianter under innehållets hash. För kortdraget hör även mätkvitton till dessa varianter. |
| `tvahandsgiv-v2-v2/v3/v4`, `samspel-v2-v5` | V2:s `kontroll-byte-ned` är ett separat höjdprov. V3:s `bilder-v2/v3` och v4:s `bilder-v3/v4` har före-/efterutsnitt. Samspel 5:s `huvudretur` använder rotationsnycklar och filmrutor från huvudtagningen. [Handbytets höjdprov](../test/dealer/paulina/tvahandsgiv-v2-v2/kontroll-byte-ned/README.md) · [Huvudreturens mätning](../test/dealer/paulina/samspel-v2-v5/huvudretur/mat.py) |

[Gallringsprotokollet](UNDERHALL.md) redovisar separata borttagningar. För de unika varianterna av handvila, manschett, lockhud och rörelse saknas ett fastställt gallringsbeslut i de kontrollerade registren.
