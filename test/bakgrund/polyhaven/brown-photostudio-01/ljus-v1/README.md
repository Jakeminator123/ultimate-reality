# LJUS-04 · Brown Photostudio i Jakobs kasinorum

50 % ger en synlig fönsterreflex i glasets kant och fot från båda stolarna. Vid 100 % blir ansiktet ljusare och kontrasten i den gröna filten lägre. [Vrid samma kasinorum](http://127.0.0.1:4317/bordsprov/brown-studio?stol=4) · [Jämför sex bilder](jamforelse.jpg) · [Se ansikte, vänsterhand, glas och filt i närbild](detaljer.jpg)

| Kamera | Befintlig rumsreflex | Brown Photostudio 50 % | Brown Photostudio 100 % |
| --- | --- | --- | --- |
| Stol 4 · 124 cm | [Före](stol-4-studio.png) | [50 %](stol-4-mild.png) | [100 %](stol-4-hdr.png) |
| Stol 1 · 116 cm | [Före](stol-1-studio.png) | [50 %](stol-1-mild.png) | [100 %](stol-1-hdr.png) |

**Försöket.** Scenen återanvänder Jakobs RUM-03, BORD-02, SKO-03, GLAS-01 och Paulinas 08-rigg med utseende 01/03. Första rödryggade kortet, tagning `skoriktning-70-30-v1`, ruta 1 av 33. Alla sex bilder är 1600 × 900 med 48° vertikalt synfält och samma ACES-exponering 1,05. Direktljuset, kontaktskuggorna, posen och alla modeller är låsta. Basbilderna är pixelidentiska med LJUS-01:s förebilder från båda stolarna.

**Ljusstyrka.** Befintlig rumsreflex använder en lokal kubkarta. Provet läser [4K-originalet](../README.md) och förfiltrerar det för diffus belysning och blanka reflexer i Three.js. Panoramat har yaw 0°. Vid 100 % är `scene.environmentIntensity` 0,48 och glasets `envMapIntensity` 1,25, samma reglagevärden som för basbilden. Vid 50 % är de 0,24 och 0,625. Reglaget avser HDR-bidraget. Direktljuset ligger kvar genom provet. Fönstret i glaset hör till fotostudions ljuskarta. För en naturtrogen rumsreflex behöver den placeringen motsvara en öppning eller ljusyta i det färdiga kasinorummet.

**Två miljöer.** Spelarvyn visar kasinorummets 3D-geometri. Bänkarna och väggnischerna får rätt perspektiv när kameran byter stol. 360°-vyn visar Poly Havens fotostudio från en fast fotograferingspunkt, med fri blickriktning. [Öppna panoramat](http://127.0.0.1:4317/bordsprov/brown-studio/panorama.html) · [Sparad utgångsvy](panorama.png)

**Verifiering.** Edge bytte kamera och ljusläge samt roterade och återställde panoramat. Glasutsnittets absoluta RGB-medeldifferens mot basbilden var 15,9/34,6 kodsteg från Stol 4 och 20,4/44,1 från Stol 1 vid 50/100 %. Siffrorna gäller hela utsnittet i exportens 8-bitarsbild och inkluderar bakgrunden.

För att göra om bildparet, starta studion och kör `node ../test/bakgrund/polyhaven/brown-photostudio-01/ljus-v1/render.mjs` från `studio/`. Kör sedan `python test/bakgrund/polyhaven/brown-photostudio-01/ljus-v1/jamfor.py` från projektroten för översikt och identiska utsnitt.
