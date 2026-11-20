# Metoder för dealerscenen

Det aktuella utdragsprovet kombinerar Jakobs rum **RUM-03**, det större bordet **BORD-02**, skannade bordsytor **YTA-02**, den vridna skon **SKO-03**, kortbanan **KORT-02** och Paulinas rigg **DEALER-01**. [Se samma utdrag i 70/30-riktning från Stol 4 och Stol 1](../test/artefakter/skoriktning-70-30/README.md).

## Bakgrund

| ID | Metod och källversion | Status och jämförelse |
| --- | --- | --- |
| RUM-01 | Bygg salongen med Three.js. [salong-v1](../test/bakgrund/salong-v1.mjs) | Provad. Pelaren flyttar sig framför bakväggen när kameran byts. [Bildpar och mätning](../test/bord/filtdjup-v1/README.md) |
| RUM-02 | Använd ett 4K-panorama som synlig bakgrund och källa till ljus eller reflexer. Brown Photostudio 01, Studio Kontrast 04 och Lythwood Lounge från Poly Haven. | Jakob valde fotostudion. I `panorama-v1` kan samma bord ses framför soffan från Stol 4 och mot fönstret från Stol 1. Fotograferingspunkten är gemensam. [Fotostudion, bordsbilder och kameror](../test/bakgrund/panorama/README.md) · [Tidigare ljusprov](../test/bakgrund/ljusprov-v1/README.md) |
| RUM-03 | Importera ett färdigbyggt rum. Jakobs Blender-export `Kasinorum.glb`, version identifierad med SHA-256. | Vald. Nischer och bänkar har eget djup. Båda spelarkamerorna har fri sikt mot dealerplats, sko och kortmål. [Filhash, kameror och jämförelse med RUM-01](../test/bakgrund/kasinorum-v1/README.md) |
| RUM-04 | Skissa väggar, pelare och dörr i meter som underlag för Marble Chisel. [chisel-rum-v1](../test/bakgrund/chisel-rum-v1/README.md) | Lokal GLB och planritning framtagna. Marble-generering är ett planerat försök. Jämför dörrens och pelarens läge från båda stolarna. |
| RUM-05 | Importera RUM-03 i Atlas Chisel och återskapa spelarvyerna för ett stilprov. [Scen, kameror, prompt och bilder](../test/bakgrund/atlas-chisel-v1/README.md) | Provad. I iteration 1 syns samma mässingslist och nisch i båda kamerorna. Golvet är fritt för studions bord. Två sparade AI-bilder i 2560 × 1440. Personligt, icke-kommersiellt prov på Atlas Free. [Växla stol](../test/bakgrund/atlas-chisel-v1/bildpar.html) |
| RUM-06 | Lägg Atlas-iterationens exporterade 3D-punktmoln bakom samma bord och dealer. [Vridbar jämförelse med RUM-03](../test/bakgrund/kasinorum-fri-v1/README.md) | Provad på labbdatorn. Nischerna får parallax när kameran vrids. Stol 1 visar prickmönster i golv och sidopanel. |
| RUM-07 | Rekonstruera samma nio kamerabilder med Atlas fulla Splat och passa golvet mot bordet. [Jämförelse och mätning](../test/bakgrund/atlas-splat-v1/README.md) | Klar, Atlas v2, 2 000 000 punkter, 5 000 befintliga Studio-krediter. Stol 1 visar valnötsådring och skarpare lister. Det mörkgröna mittfältet är kornigt och några ljusa prickar syns i golvet. Privat stilprov. |

**LJUS-01 · Rummets armaturer.** 14 ljuskällor följer de självlysande ytorna i RUM-03. Två kameror jämför studioljus med armaturernas ljus och reflexer på glas, filt och hand. Armaturernas lägen kommer från GLB-filen. Styrkorna är skattade. [Före och efter, LJUS-01 v1](../test/bakgrund/kasinorum-lampljus-v1/README.md)

**LJUS-02 · Blinkande pendellampa.** Ljuset i en av RUM-07:s nischer dämpas lokalt en gång var tredje sekund. [Animation och inspelning från båda stolarna](../test/bakgrund/worldlabs/lampblink-v1/README.md)

**LJUS-03 · Pendelljus under kortdraget.** En varm ljuskälla placerades vid den uppmätta pendeln i RUM-07. Ljuset dämpas i takt med nischen under tagningen `skoriktning-70-30-v1`. Glaset reagerar tydligast från Stol 1. Handen skuggar kortet och ljusskillnaden på handen är svag. [Stol 4 och Stol 1 på samma tidslinje](../test/bakgrund/worldlabs/pendelljus-kortutdrag-v1/README.md)

**LJUS-04 · Brown Photostudio 01.** Poly Havens 4K-panorama enligt RUM-02 ger miljöljus och reflexer i Jakobs RUM-03. De båda kamerorna jämför det befintliga ljuset med 50 % och 100 % HDR-styrka vid fast exponering. Vid 50 % blir glaset tydligt samtidigt som Paulinas ansikte behåller mer teckning. [Sex bilder och vridbar vy](../test/bakgrund/polyhaven/brown-photostudio-01/README.md) · [Utforska den fotograferade studion i 360°](http://127.0.0.1:4317/bordsprov/brown-studio/panorama.html)

**LJUS-05 · Handljus på Paulina v2.** Jakobs val av Brown Photostudio på 50 % kombineras med en avskärmad mjuk ljuskälla vid vänsterhanden. Samma perspektivkameror, fotoyta och böjda KORT-02 visar den nya riggens kortdrag. Frys en ruta och växla handljuset för att bedöma fingrarnas kontakt och ljusets spill på filten. [Stol 4, ruta 17](http://127.0.0.1:4317/bordsprov/handljus?stol=4&ruta=17) · [Stol 1, samma ruta](http://127.0.0.1:4317/bordsprov/handljus?stol=1&ruta=17) · [Kollisionsmätning](../test/bakgrund/polyhaven/brown-photostudio-01/handljus-v2/granskning/README.md)

## Bord, dealer och flyttbara föremål

| ID | Metod och källversion | Status och jämförelse |
| --- | --- | --- |
| BORD-01 | Bygg ett måttsatt blackjackbord i Three.js. Egen kontur, filt, vadderad reling och underrede. | Provad i 160 × 108 och 160 × 96 cm. Ett mellanprov jämförde 180 × 120 cm med grundstorleken. [Bordsdjup](../test/bord/filtdjup-v1/README.md) · [Mellanprov](../test/bord/storre-bord-v1/README.md) |
| BORD-02 | Förstora samma kontur 20 % i bredd och djup med fast arbetskant och fast kortmål. | Vald provstorlek 192 × 129,6 cm. Växla mot 160 × 108 cm på samma bildruta. [Bordsjämförelse](../test/artefakter/kasinorum-utdrag-100/README.md) |
| YTA-01 | Skapa filttryck, trä och läder i bordsmodellen. [Grundmaterial](../test/bord/filtdjup-v1/bord.mjs) | Provad. Välj **Tidigare material** i utdragsprovets materialdetalj för jämförelse mot YTA-02. |
| YTA-02 | Klä geometrin med skannad mikromocka, läder och valnötsfaner från Poly Haven. 2K färg-, normal- och råhetskartor. | Använd i bordsprovet. Jämför filtens lugg, relingens narv och sargens ådring under samma ljus. [Skala och källmanifest](../test/bord/polyhaven-material-v1/README.md) |
| SKO-01 | Bygg en fristående sko och flytta den över filten. [kortsko-v1](../test/artefakter/kortsko-v1.mjs) | Provad med vilopose och statisk räckpose. [Mätning av kropp, skiva och skons volym](../test/artefakter/kortsko-vanster-v1/mat.py) |
| SKO-02 | Modellera slits och frontplatta med gemensam utdragsaxel. [kortsko-utdrag-v2](../test/artefakter/kortsko-utdrag-v2/README.md) | Provad vid −110° från spelaraxeln +Z tillsammans med KORT-01. |
| SKO-03 | Luta kortstapeln 30° och vrid öppningen mot dealern. [Gemensam skomodell](../studio/lib/card-shoe.mjs) | Provvinkel −100°. Utgångsläge X +46, Z −21 cm. Arbetskant v4 vid X +46, Z −31 cm ger 10,68 cm till kanten och 0 kollisioner i 33 lägen. [Utdrag](../test/artefakter/kasinorum-utdrag-100/README.md) · [Tre skoplaceringar](../test/artefakter/skolage-v1/README.md) |
| KORT-01 | För ett separat kort på 63 × 89 mm genom slitsen. | Provad med SKO-02. Utdrag på 77 mm i nio beräknade lägen. [Kortbana v2](../test/artefakter/kortsko-utdrag-v2/README.md) |
| KORT-02 | Styr ett böjligt kort på 63 × 89 × 0,4 mm efter skons lutning och filtens höjd. [Kortbanans kod](../test/artefakter/kasinorum-utdrag-100/kortbana.py) | Provad med SKO-03 och DEALER-01. Rörelsen är 108 mm lång. Noll genomskärningar i 33 visade lägen vid tolerans 0,001 mm. [Tagning och kontroll](../test/artefakter/kasinorum-utdrag-100/README.md) |
| DEALER-01 | Skatta kroppen från foto med SAM 3D Body och styr vänsterarmen i MHR-riggen. Upprätad bordsvila 08. | Använd i utdragsprovet. Stol 1 visar fingerkontakten. Stol 4 visar kvarvarande skarp armbågskontur i slutrutan. [Pose, tagning och fingeravstånd](../test/artefakter/kasinorum-utdrag-100/README.md) |
| GLAS-01 | Modellera ett genomskinligt tumblerglas med räfflad fot. [Geometri](../test/artefakter/glas-marker-v1/foremal.mjs) | Valbart i RUM-06. 80 × 104 mm, antagna mått. Reflexen är svag mot den gröna filten. |
| MARKER-01 | Modellera separata marker med kantinlägg och tryck i två staplar. [Geometri](../test/artefakter/glas-marker-v1/foremal.mjs) | Valbara i RUM-06. Antagna mått Ø 39 × 3,3 mm. |

SKO-03 har även tagningen [skoriktning-70-30-v1](../test/artefakter/skoriktning-70-30/README.md) vid samma centrum som arbetskant v4. Mynningen pekar −66,80° från +Z. Avståndet till arbetskanten är 12,98 cm och 33 av 33 lägen är kontrollerade utan genomskärning.

## Lägg till ett försök

Behåll metodens ID vid nya tagningar. Ange version och källfil eller hash, ändrade parametrar, vad som kördes och länken till bilder eller mätning. En annan metod får nästa lediga ID i sin kategori. Märk vem som valde versionen och vilka delar som återstår att granska. Vid generering, spara även prompt, modell och faktisk kostnad. Privata sessionslänkar och jobb-ID hör hemma i `information/lokalt/`. Vid grepp eller placering ska provet ange kamera, kort, tagning och bildruta.
