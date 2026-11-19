# Ljus och bakgrund från två spelarplatser

[Öppna de åtta bilderna i studion](http://127.0.0.1:4317/bordsprov/ljusprov.html) eller [öppna visaren offline](ljusprov.html). Bilderna är 1600 × 900. Bordet, kortskon, målet och kamerorna kommer från [filtdjup-v1](../../bord/filtdjup-v1/README.md). Bildparet för varje miljö använder samma rum, exponering och belysning.

| Prov | Det som syns i bilderna |
| --- | --- |
| Salongens eget ljus | Kontrollbilden har mörkt läder och en byggd pelare som förskjuts framför bakväggen vid kamerabytet. |
| Salong med studioljus | Samma salong, riktade ljus och lampor. Miljökartan för materialens indirekta ljus byts till Studio Kontrast 04, med samma intensitetsinställning. Från stol 1 syns den breda ljusa reflexen längs relingens högra båge. |
| Studiofotot som rum | Studio Kontrast 04 ger både miljöljus och bakgrund. Stol 4 ser den grå fonden. Från stol 1 kommer en vit softbox och dess stativ in i bilden. Skuggan på fondgolvet är skarpare än man väntar sig från en stor softbox. |
| Fotograferad lounge | Lythwood Lounge ger varmare filt, trä och läder. En byggd golvlampa bakom bordet förskjuts mot sofforna vid kamerabytet. Fotots golv och närliggande möbler får perspektivfel, tydligast vid passagen mellan rummen. |

För en kasinomiljö skulle jag använda loungefotot för det avlägsna rummet och dess ljus. Bygg de närmaste möblerna, pelarna och golvytan i 3D där deras perspektiv och skuggor går att jämföra från båda spelarplatserna. Använd Studio Kontrast för att bedöma lädrets glans och filtens matthet under en bred ljuskälla. Paulinas ljusriktning återstår att jämföra med hennes bildmaterial.

## Underlag

- [Studio Kontrast 04](https://polyhaven.com/a/studio_kontrast_04) av Grzegorz Wronkowski och [Lythwood Lounge](https://polyhaven.com/a/lythwood_lounge) av Greg Zaal. Båda originalen är 4K Radiance HDR. [Poly Havens CC0-licens](https://polyhaven.com/license)
- [GroundedSkybox](https://threejs.org/docs/pages/GroundedSkybox.html) projicerar bildens nedre del mot golvet. Fotoögats höjd **1,5 m** och projektionens radie **9 m** är antaganden. Bilderna innehåller en enda fotograferad observationspunkt per plats. Den byggda golvlampan, bordet och kortskon har egen geometri.
- [Three.js Scene](https://threejs.org/docs/pages/Scene.html) skiljer den synliga bakgrunden från miljöljuset. Provet använder en förfiltrerad miljökarta, ACES-tonkurva och exponering 1,05. I fotovyerna uppskattas huvudljusets riktning ur bildens ljusaste område ovanför horisonten för att teckna en golvskugga.

## Återskapa provet

Lägg originalfilerna [studio_kontrast_04_4k.hdr](https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/studio_kontrast_04_4k.hdr) och [lythwood_lounge_4k.hdr](https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/lythwood_lounge_4k.hdr) i `test/bakgrund/polyhaven/`. Från `studio/` med projektets pinnade Node och Microsoft Edge, kör:

```powershell
node ../test/bakgrund/ljusprov-v1/render.mjs
```

Renderaren använder kameradata från `test/bord/filtdjup-v1/matt.json`. [Återskapa grundprovet](../../bord/filtdjup-v1/README.md) om filen saknas. Varje HDR-original kontrolleras med SHA-256. Mittkryss, kortmål och kortsko kontrolleras mot grundprovets pixelkoordinater i varje vy. En ny HTML-sökväg som sista argument ger en separat version.
