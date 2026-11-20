# LJUS-03 · Pendelljus vid kortdraget

Samma pendel i Atlas fulla RUM-07 lyser nu på bordets 3D-föremål. När den dämpas syns skillnaden tydligast i dricksglaset från Stol 1. Handen som drar kortet ligger till största delen i skugga för pendeln. [Spela scenen från Stol 4](http://127.0.0.1:4317/bordsprov/rum3d?rum=atlas-full&stol=4&glas=1&blink=1&drag=1) · [Spela från Stol 1](http://127.0.0.1:4317/bordsprov/rum3d?rum=atlas-full&stol=1&glas=1&blink=1&drag=1)

- [Film från båda stolarna, 3 sekunder](pendelljus-kortutdrag.mp4). Vänsterhanden drar det första rödryggade kortet 108 mm. Bilden håller kvar slutläget. Vid omspelning börjar det ursprungliga draget om.
- [Fast och dämpad pendel på ruta 17](pendelljus-ruta17.jpg) · [Samma utsnitt av hand, glas och filt](pendelljus-detaljer.jpg). Pausa 3D-vyn, välj ruta 17 och växla mellan **Fast sken** och **Dämpat sken**. Kryssrutan **Pendelns ljus på bordet** styr kopplingen till förgrunden.
- Föreprovet har fast studioljus på bordet och den blinkande nischen från LJUS-02. Efterprovet lägger till pendelns direkta ljus på föremålen. Kameror, studiobelysning, exponering 1,05, handpose, glas, bord och sko behålls i jämförelsen. Lokala original finns i filerna `stol-{4,1}-ruta17-{bakgrund,bord}-{steady,dim}.png`. [Källvärlden](../kasinorum-v1/README.md) · [Föregående lampanimation](../lampblink-v1/README.md)

## Uppmätt på ruta 17

Minskning av medelluminans när pendeln dämpas, mätt efter sRGB-linjärisering i samma pixelrutor. I glasområdet ingår kanten och filten som syns genom glaset. Tabellen visar det sammanlagda synintrycket.

| Utsnitt | Stol 4 | Stol 1 |
| --- | ---: | ---: |
| Hand vid kortskon | 0,46 % | 0,00 % |
| Dricksglas | 3,46 % | 34,90 % |
| Filt vid kortmålet | 2,59 % | 1,87 % |

I föreprovet gav lampblinkningen 0,00 % i samtliga sex utsnitt. Från sidan ligger glaset framför ljusfallet på filten. Ljusfallet är även visuellt svagare vid handens grepp än över relingen. [Pixelrutor och råvärden](ljusmatning.json)

## Källor och tid

- Paulinas 08-rigg med utseende 01/03 och tagningen `skoriktning-70-30-v1`. Nio GLB-poser och fyra delsteg mellan källposerna ger 33 visade lägen. Handens vertexpositioner och kortets böjkurva följer samma interpolation som i det tidigare kollisionsprovet. [Kortbana, skoriktning och 33 kontrollerade lägen](../../../artefakter/skoriktning-70-30/README.md)
- Kamera 4 står 124 cm och kamera 1 står 116 cm över referensgolvet. Båda har 48° vertikalt synfält. Bordet BORD-02 är 192 × 129,6 cm. [Kamerornas ögonpunkter och riktningar](../../../bord/filtdjup-v1/matt.json)
- Lampcentrum (2,147, 0,289, −3,302) m är skattat från de två spelarvyerna. Ett varmt ljus `#ffd19b` lyser från nischens öppning mot bordet med inverskvadratavtagande. Styrkorna 12 och 1,44 cd, 55° halvvinkel och skuggans parametrar är visuella provvärden. Atlas-rummets övriga ljus är inbakat. Ljuset är en lokal simulering.
- En cykel är 3 sekunder. Vid 24 bilder/s dämpas lampan i videoruta 36–47 (räkning från 0) mellan 1,50 och 2,00 s. H.264, 1920 × 588, 72 videorutor. Bildraderna använder samma tidsfunktion i 3D-vyn och i exporten. [Pose och ljus för varje videoruta](tidslinje.json)

Starta studion på port 4317. Kör sedan `node ../test/bakgrund/worldlabs/pendelljus-kortutdrag-v1/render.mjs` från `studio/` och `python test/bakgrund/worldlabs/pendelljus-kortutdrag-v1/mat_ljus.py` från reporoten. Renderingen använder Edge, WebGL och FFmpeg lokalt. 0 Atlas-krediter.
