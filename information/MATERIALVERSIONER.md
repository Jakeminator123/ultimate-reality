# Materialversioner för en dealer

Paulinas fotoomstart utgår från bildutgåvan `fas-1/v1` och valt profilprov v3. Den tidigare sittmodellen v2, v4 och givfilmerna tillhör den arkiverade modellomgången. [Fotounderlag och mätningar](PAULINAS_STILLBILDER.md) · [Äldre kroppar och tagningar](PAULINAS_PROV.md)

| Material | Det som identifierar versionen |
| --- | --- |
| Grundfoto | Ursprung, filväg, SHA-256 och pixelmått. Bildregistrets poster anger källbild och utgåva. En ny beskärning eller ändring får egen fil och referens till originalet. |
| Kropp | SHA-256 för en GLB, SAM-körning, pose och källbilder. Behåll körningens `run.json`, bilder och skattningar. Registrera kroppskällan och eventuell separat referens för hållning. |
| Fotoyta | Egen GLB och SHA-256, grundkroppens SHA-256 och källbilder. Registrera om hud, hår eller material ändras. |
| Rörelse | Animerad GLB med egen SHA-256, tagning, kropp, fotoyta, tidslinje och eventuellt kort-ID och kortbana. Samma rörelse kan renderas från flera kameror. |
| Rendering | Filmens SHA-256 och `capture.json` med rörelse, kamera, bildrutor, bildfrekvens och eventuellt kort. Granskningen binder observationen till filmkvitto, kamera och nollbaserad bildruta. |
| Givsekvens | Ordning, filmkvitto och animerad GLB för varje klipp. För en kortgiv anges dessutom kortinstans, målplats, landningsruta och släppruta. |

## Från prov till registrerad utgåva

1. Lägg pågående prov i sin privata versionsmapp, till exempel `avatars/paulina/prov-70/v1/`. Spara källväg och SHA-256 för varje bild, beställningsrevision och mottaget original när de finns, SAM-körningens ID och filväg samt mätningar och kameror i provets egen dokumentation. [Arbetsytor och arkiv](STUDIOSTRUKTUR.md)
2. Flytta en färdig källkörning från labbets `runs` till `saved` med `lab.ps1 keep <körnings-id>` innan den används för ett bestående prov. När kropp och fotoyta har versionsbundna källor i GLB-filerna, registrera dem genom det befintliga verktyget. Registreringen återanvänder redan sparade bytes med samma SHA-256.
3. Välj utgåva när den ska synas automatiskt. `activate` verifierar grundkropp, fotoyta och källornas SHA-256 mot utgåvans `bildregister.json`. Det valda profilprovet v3 ligger under `fas-1/v1/granskning/`. Om dess bytes ingår som modellkälla behövs en bildutgåva som faktiskt registrerar dem, till exempel `fas-1/v2`. [Bildregister, upplaga 1](../avatars/paulina/fas-1/v1/bildregister.json) · [Registerverktyget](../tools/material_versions.py)

Kör från projektroten med labbets Python om registreringen behöver NumPy eller Pillow. Ersätt platshållarna med provets faktiska filer och kontrollerade utgåva.

```powershell
$geometry = python -B tools/material_versions.py --dealer paulina model '<kropp.glb>' --run '<sparad SAM-körning>'
$appearance = python -B tools/material_versions.py --dealer paulina model '<fotoyta.glb>'
python -B tools/material_versions.py --dealer paulina activate --edition '<fas-N/vN>' --id '<utgåvans-id>' --name '<visningsnamn>' --geometry $geometry --appearance $appearance
```

En grå kroppsutgåva kan väljas med bara `--geometry`. Registrera animerad GLB med samma `model`-kommando. Registrera film med `film --file <film.mp4> --capture <capture.json>` och granskning med `review --film <filmkvitto> --camera <kamera> --frames <n> --note <iakttagelse>`. Studion läser lokala `avatars/<dealer>/3d/versioner/` för utgåvor och filmkvitton. [Paulinas aktuella materialrapport](http://127.0.0.1:4317/api/material?dealer=paulina&report=md) · [Kameraprovet](../studio/tools/kameraprov.mjs)

## Kontrollera GLB:ens kropp och material

Kör från projektroten. Grundkontrollen använder Pythons standardbibliotek.

```powershell
python -B tools/glb_surface_check.py '<modell.glb>'
python -B tools/glb_surface_check.py '<modell.glb>' --near-mm 2
```

Rapporten anger modellens SHA-256, scen, noder, primitiv, material och faktiskt ritade trianglar. `sharedTriangles` räknar exakt samma trianglar efter nodernas statiska omvandlingar, oberoende av index, hörnordning och material. `relation` anger identiska triangelytor (`same`), en delad del (`partial`) eller noll exakt gemensamma trianglar (`distinct`). `unusedMaterials` visar deklarerade material som saknar primitiv i scenen. Två primitiv med samma material kan ha olika yta. [Kontrollverktyget](../tools/glb_surface_check.py)

`--near-mm` gäller modeller i meter och kräver NumPy och SciPy. För primitiv på samma nod visas andelen triangelcentrum som projiceras inuti den andra ytan inom valt avstånd, med högst 20° mellan trianglarnas normaler. Andelen gäller triangelcentrum, med en rad per riktning i primitivens ordning. Kontrollen läser modellens statiska data före hudbindning, morph och animation. Bedöm eventuell visuell effekt i den berörda kameran och bildrutan.

För tidigare kontroller av fingerrotation, ögonlock, fotoyta och giv finns det fullständiga historiska underlaget i `git show d4acb1b:information/MATERIALVERSIONER.md`. Privata filvägar där kan slås upp i arkivets manifest. [Historisk provkatalog](PAULINAS_PROV.md) · [Arkivet och återställning](HANDOFF.md#arkivet-från-20-november-2026)
