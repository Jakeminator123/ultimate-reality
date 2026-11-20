# RUM-06 · Gå runt samma blackjackbord

[Öppna Jakobs GLB-rum](http://127.0.0.1:4317/bordsprov/rum3d) · [Öppna Atlas-rummet från Stol 4](http://127.0.0.1:4317/bordsprov/rum3d?rum=atlas&stol=4)

Dra i bilden för att vrida, rulla för att zooma och högerdra för att flytta blickpunkten. Stol 4 och Stol 1 återställer de kalibrerade spelarkamerorna. Välj bakgrund för att behålla aktuell kamera och byta hela rummet. Avmarkera **Bord och sko** och **Paulina** för att se rummet tomt. Marker och dricksglas kan visas var för sig. Starta studion enligt [projektets README](../../../README.md).

## Det som går att jämföra

- **RUM-03** är [Jakobs ursprungliga Blender-rum](../kasinorum-v1/README.md). Bänkar, nischer, lampor och paneler är fysisk geometri. Den här versionen är grunden för möblering och för att sätta lampor på kända platser.
- **RUM-06** visar Atlas förhandsvisning av [Chisel-iteration 1, RUM-05](../atlas-chisel-v1/README.md). Exporten innehåller 947 213 Gaussian-splats. Lokalt SPZ-original är `../atlas-chisel-v1/forhandsvisning-v1.spz`, 6 208 420 byte, SHA-256 `7805374b88608a3553a17bca7e7dfab7efeefe6d3579134d224eab30ee58029c1`. Förhandsvisningen laddades ned från den tidigare iterationen. Atlas Free-materialet används här för personligt, icke-kommersiellt prov. Punktmolnet visas med [Spark](https://sparkjs.dev/docs/splat-mesh/).
- Båda visar samma 192 × 129,6 cm stora BORD-02, YTA-02, SKO-03 och Paulina 08. Första rödryggade kortet, tagning `skoriktning-70-30-v1`, ruta **1 av 33**. Hud, händer och föremål följer samma scenkoordinater när kameran vrids. [Spela hela utdraget](http://127.0.0.1:4317/bordsprov/paulina-utdrag.html?riktning=70-30) · [Kontroll av grepp och kollisioner](../../artefakter/skoriktning-70-30/README.md)
- **MARKER-01** har två staplar om fem och tre marker, diameter 39 mm och höjd 3,3 mm per marker. **GLAS-01** är ett tumblerglas, diameter 80 mm och höjd 104 mm, med räfflor och 9 mm tjock botten. Det är antagna provmått. [Föremålens geometri och placering](../../artefakter/glas-marker-v1/foremal.mjs)

## Inpassning och ljus

Y är uppåt, +Z pekar mot Stol 4. Filten ligger på Y 0 och golvet på Y −0,75 m. Bordets konturcentrum ligger på X 0, Z +12,8 cm, det fasta referenskrysset på X 0, Z +2 cm och kortmålet på X 0, Z +13 cm. Skons centrum är X +46, Z −31 cm. Mynningens riktning är vår tolkning av Jakobs bild, 70 delar mot mittlinjen och 30 mot Stol 4. Modellmåtten är antagna för studion.

| Kamera | Ögonhöjd över golv | Blickriktning XYZ | Synfält vertikalt / horisontellt vid 16:9 |
| --- | --- | --- | --- |
| Stol 4 | 124 cm | 0 / −0,24507 / −0,96950 | 48° / 76,72° |
| Stol 1 | 116 cm | +0,88751 / −0,20061 / −0,41484 | 48° / 76,72° |

Atlas-golvets median under bordet var Y −0,4509 m. Punktmolnet flyttades ned 29,91 cm. Väggarnas läge och skala behöver mätas separat för fast inredning. Bordet får huvudljus snett uppifrån och reflexer från originalrummet och två diffusionsytor. Punktmolnets rumsbelysning är inbakad. I denna jämförelse behåller förgrunden samma ljus och reflektionsmiljö vid rumsbyte.

## Bildgranskning och nästa prov

Från Stol 4 syns två nischer bakom Paulina. Från Stol 1 täcker sidoväggen den ena nischen och glaset kommer fram i förgrunden. I Atlas blir träpanel, mässingslist och golv prickiga redan från Stol 1. GLB-rummet håller skarpa kanter när man rör sig. Glaset behöver tydligare reflexer och Paulinas ljus behöver matchas mot de synliga armaturerna.

[Originalrum med möbler](originalrum-med-bord.jpg) · [Atlas från Stol 4](atlas-med-bord.jpg) · [Atlas från Stol 1](atlas-stol-1.jpg) · [Mellan kamerorna](atlas-fri-blick.jpg)

För nästa realismprov, sätt faktiska ljuskällor vid GLB-rummets armaturer och jämför handen på filten och skuggan under bordet från båda stolarna. Lägg nya fasta möbler i `test/bakgrund/` och flyttbara föremål i `test/artefakter/` som separata modeller i meter. En GLB i `jakob-random/` kan användas som underlag till nästa version. [Metodregister](../../../information/METODER.md)
