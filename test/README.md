# Scenprov

För Paulinas tvåkortsgiv börjar du i panoramat. Bordet, kamerorna, kortskon och bordsytorna hämtas från flera mappar även när den animerade kroppen redan är registrerad. [Spela given](http://127.0.0.1:4317/modellering/sekvens?dealer=paulina&id=3003aba81a5e84f1afc19143b9fab370e1a508360e5aa8849bd68d690c0d8a59) · [Bordets inläsning](bakgrund/panorama/bord.mjs) · [Paulinas stillbilder](../information/PAULINAS_STILLBILDER.md)

## Vad behöver studion?

| Scenyta | Filer som studion faktiskt läser |
| --- | --- |
| Bord, sko och kameror | `bord/filtdjup-v1/bord.mjs` och lokala `matt.json` ger bordsgeometrin och stolkamerorna. `studio/lib/table-layout.json` ger layouten. `artefakter/skoriktning-70-30/bana.json` ger skons läge. Skons geometri kommer från `studio/lib/card-shoe.mjs`. [Scenens filval](../studio/app/bordsprov/rum3d/[[...asset]]/route.ts) |
| Fotopanorama | `bakgrund/panorama` hämtar rum och orientering ur rumsregistret. `rum-v2` innehåller menybilderna för fem rum. `golv-v2` visar kontaktskuggor. HDR-bilder och panoramaspelare kommer från `bakgrund/polyhaven`. [Rumsregister](../studio/lib/panorama-rooms.ts) · [Panoramats filval](../studio/app/bordsprov/panorama/[[...asset]]/route.ts) |
| Paulina och kort | `panorama/paulina-giv-v1/giv.mjs` spelar även senare givprov. Den laddar den valda animationens SHA-256. `paulina-placering-v1` visar v2 i fryst pose 17 och läser `utdrag.mjs` från `worldlabs/pendelljus-kortutdrag-v1`, banan från 70/30 och riggen via handljusvyn. [Givspelaren](bakgrund/panorama/paulina-giv-v1/giv.mjs) · [Placeringsprovet](bakgrund/panorama/paulina-placering-v1/placering.mjs) |
| Bordsytor | `bord/polyhaven-material-v1/maps` ger kartor för filt, läder och valnöt. `bord/materialval-v1` innehåller alternativen `coated_pine`, `leather_red_02` och `denim_fabric`. `bakgrund/polyhaven/grass-ground-v1` ger gräsmattan. Menyvalet avgör vilka kartor som ska läsas. [Materialregistret](../studio/lib/table-finishes.ts) |

## Provkatalog

De 23 familjerna omfattar tio under `bakgrund`, fyra under `bord`, åtta under `artefakter` och `fotomall`. Personens grundbilder bor i `avatars/paulina` och hennes egna rigg- och rörelseprov i `test/dealer/paulina`. [Metodregistret med material-ID](../information/METODER.md)

| Bakgrund | Användning och ingång |
| --- | --- |
| [panorama](bakgrund/panorama/README.md) | Scenen använder `rum-v2`, `golv-v2`, `paulina-placering-v1` och givspelaren i `paulina-giv-v1`. Granskningsbilderna i `paulina-giv-v1`, `paulina-giv-v2`, `paulina-giv-v3`, `paulina-giv-v4`, `giv-sam-v4-v3`, `giv-sam-v4-v4` och `giv-sam-v4-v5-v6` dokumenterar tidigare granskningar. Dagens tagning väljs ur [filmregistret](../studio/lib/panorama-deals.ts). |
| [polyhaven](bakgrund/polyhaven/brown-photostudio-01/README.md) | Brown Photostudio 01 ger en av rummens HDR-bilder. `ljus-v1/panorama.mjs` används i panoramat. `handljus-v2` innehåller film, grepprov och mätverktyget i `granskning`. Ljusjämförelserna är parkerade och kan [öppnas i studion](http://127.0.0.1:4317/bordsprov/ljusstudier). |
| [kasinorum-v1](bakgrund/kasinorum-v1/README.md), [kasinorum-fri-v1](bakgrund/kasinorum-fri-v1/README.md), [kasinorum-lampljus-v1](bakgrund/kasinorum-lampljus-v1/README.md) | Jakobs GLB-rum, den vridbara visaren och armaturerna ligger i varsin mapp. Rumsvisaren används också som skal för Brown Studio och handljusprovet. [Rumsprov](http://127.0.0.1:4317/bordsprov/rum3d) |
| [atlas-chisel-v1](bakgrund/atlas-chisel-v1/README.md), [atlas-splat-v1](bakgrund/atlas-splat-v1/README.md), [worldlabs](bakgrund/worldlabs/README.md) | Chisel innehåller exporter för båda punktmolnen. Splat-provet mäter golvet och jämför kamerorna. `worldlabs/kasinorum-v1` ger ingången till det parkerade rummet. `lampblink-v1` och `pendelljus-kortutdrag-v1` spelas från rumsvisaren. |
| [ljusprov-v1](bakgrund/ljusprov-v1/README.md), [chisel-rum-v1](bakgrund/chisel-rum-v1/README.md) | Ljusprovet öppnas från `/bordsprov/ljusprov.html`. Chiselskissen är ett lokalt underlag med planritning och eget byggskript. Salongens separata [salong-v1.mjs](bakgrund/salong-v1.mjs) laddas i rumsvisaren. |

| Bord och fotomall | Användning och ingång |
| --- | --- |
| [filtdjup-v1](bord/filtdjup-v1/README.md), [storre-bord-v1](bord/storre-bord-v1/README.md) | Filtdjupsprovet ger modell och kameror till studion. Det större bordets eget bildpar visar det tidigare mellanprovet på 180 × 120 cm. BORD-02 i dagens panorama är 192 × 129,6 cm. |
| [polyhaven-material-v1](bord/polyhaven-material-v1/README.md), [materialval-v1](bord/materialval-v1/README.md) | Grundytor respektive valbara material. Båda mapparna läses vid visning. |
| [fotomall](fotomall/render.mjs) | Byggskriptet använder `scene.mjs` för att rendera de nio generiska dockvyerna i `studio/public/fotomall/docka`. Paulinas privata grundbilder finns i hennes avatarmapp. |

| Artefakter | Användning och ingång |
| --- | --- |
| [skoriktning-70-30](artefakter/skoriktning-70-30/README.md), [glas-marker-v1](artefakter/glas-marker-v1/foremal.mjs) | 70/30 ger banan till panoramat och kroppsrutor till rumsprovet med 08-riggen. Glas och marker är tillval i det vridbara rumsprovet. |
| [kasinorum-utdrag-100](artefakter/kasinorum-utdrag-100/README.md) | Den tidigare 100°-tagningen är spelbar med `?avatar=rigg`. [Renderingen](artefakter/kasinorum-utdrag-100/render.mjs) och [kollisionsprovet](artefakter/kasinorum-utdrag-100/kollisioner.mjs) använder `handkandidat/mhr-arm` som standard. Grundpassningen i `handkandidat` är riktmärke för [Paulinas passning v3](dealer/paulina/kasinorum-utdrag-100/README.md). |
| [skolage-v1](artefakter/skolage-v1/README.md), [skolage-vilohand-v1](artefakter/skolage-vilohand-v1/README.md) | Skolägesvisaren läser `referens`, `arbetskant-v4` och `vanster`, inklusive deras bildmappar. `arbetskant`, `arbetskant-v2` och `arbetskant-v3` dokumenterar tidigare passningar. Vilohandsprovet jämför vänstern med skons mynning i två sparade givprov. [Jämförelsens urval](artefakter/skolage-v1/jamfor.py) |
| [kortsko-utdrag-v2](artefakter/kortsko-utdrag-v2/README.md), [kortsko-vanster-v1](artefakter/kortsko-vanster-v1/render.mjs) | Äldre skogeometrier. V2 öppnar specifikt `drag-mot-filt/skoprov.html`. V1 använder även den fristående [kortsko-v1.mjs](artefakter/kortsko-v1.mjs). Båda finns i [studions filval](../studio/app/bordsprov/[file]/route.ts). |
| [kortmarkering-v1](artefakter/kortmarkering-v1/README.md) | Framtagning och jämförelse av X-trycket. Bildstandarden använder det exporterade [referenskortet](../studio/public/fotomall/kort/referenskort-x-v1.png). |

**Äldre handpassningar i 100°-provet.** `handkandidat/kontakt`, `kontakt/tangent`, `ledvolym`, `mhr-grepp` och `mhr-rymlig` har egna exporter och mätningar. `mhr-ny` och `riktig-arm` innehåller bildjämförelser. [Vald äldre tagning](http://127.0.0.1:4317/bordsprov/paulina-utdrag.html?avatar=rigg)

I `artefakter/utdrag-100-historik/` finns fyra äldre offlinevisare. Varje fil bevarar 231 granskningsbilder. De går att öppna var för sig med länkarna här. [Prov 01](artefakter/utdrag-100-historik/prov-01.html) · [Prov 02](artefakter/utdrag-100-historik/prov-02.html) · [Kontaktprov](artefakter/utdrag-100-historik/kontaktprov.html) · [Paulina v2](artefakter/utdrag-100-historik/paulina-v2.html)

Automatiska tester ligger i `tests/` och `studio/tests/`. Material och referenser som Jakob tillför har en egen [inkorg i repot](../jakob-random/).
