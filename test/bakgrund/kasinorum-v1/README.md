# Kasinorum och kortsko

[Jämför rummen från stol 4 och stol 1](http://127.0.0.1:4317/bordsprov/rumsprov.html) · [Se mynningen och utdragsriktningen ovanifrån](http://127.0.0.1:4317/bordsprov/skoprov.html) · [Öppna jämförelsen offline](referensvinkel.html)

Jakobs bifogade `Kasinorum.glb` är en Blender-export med åtta grupper av mesh, elva material, tre inbäddade texturer och tre kameror. Originalet från Downloads har kopierats oförändrat till denna mapp. SHA-256 är `6c6585a3f853aafd23761ba817f8e5b016d0a29fa36bcb331890d30ae092d73a`.

**Jag skulle använda Kasinorum.glb till nästa dealerprov.** Från stol 4 ger det mörkgröna mittfältet lugn bakom huvudet. Från stol 1 syns nischens sida och bänken längs väggen. I studions salong ligger en lampglob nära huvudet framifrån och en pelare bakom kroppen från sidan. Det mörka golvet i GLB-rummet ger svag separation mellan bordsskugga och golv. Visaren låser direktljus, miljöreflexer, exponering, kamera och pose mellan rummen. Filmbelysningen behöver jämföras mot Paulinas tagning.

| Kontroll | Resultat |
| --- | --- |
| Kameror och golv | De inbyggda spelarkamerorna matchar bordsprovets positioner inom 0,001 mm och riktningar inom 0,00001°. Vertikalt synfält 48°, ögonhöjd 124 respektive 116 cm. Golvet ligger 75 cm under filten. |
| Sikt | Ingen rumsgeometri skymmer skons mynning, dealerplatsen eller kortmålet från stol 4 eller 1. |
| Riktning | Skons mitt ligger vid X +46 cm och Z −21 cm från origo. Mynningen pekar in mot bordets mitt och något mot spelarna, −70° från +Z. Kortstapeln lutar 30° ned mot mynningen. Vinklarna är provmått valda utifrån Jakobs två exempelbilder. |
| Frigång | Vid X +42 cm korsade kortet den vilande handens mesh. Vid +46 cm gav kontrollen av sittmodellens 36 874 trianglar noll skärningar med skons omslutning och kortets elva utdragslägen. Samma kontroll passerade vid visningens tre vinklar, −70°, −45° och 0°. Skons botten har stöd på filten vid båda bordsdjupen. |
| Pose | Samma lokala sittmodell från `kortsko-vanster-v1/sankt-arm.glb` i alla spelarvyer. Modellen håller händerna i vila. Den rörliga referensfiguren i studions Grepp och landning använder samma vinklade sko vid givningen. Paulinas fingerkontakt under en verklig givning behöver en egen kontroll. |

**Återskapa** genom att lägga Jakobs fil med angiven hash här och köra `node ../test/bakgrund/kasinorum-v1/render.mjs` från `studio` med projektets pinnade Node och installerade Edge. Visaren innehåller alla 72 bilder. De alternativa skovinklarna går att jämföra även offline. [Bordsmått och kalibrering](../../bord/filtdjup-v1/README.md)

I studions rumsprov väljer **Sittpose** mellan de lokalt renderade kropparna. När båda upprätade viloposerna finns väljs 08 först. Ett byte av sittpose behåller vald stol, bordsdjup och skovinkel. Skapa till exempel det lokala rumsprovet för 08 genom att från `studio` köra

```powershell
node ../test/bakgrund/kasinorum-v1/render.mjs ../test/bakgrund/kasinorum-v1/referensvinkel-08-bordsvila-v2.html ../test/dealer/paulina/bordsvila-v2/08-bordsvila-scen.glb
```

## Browseragentens World Labs-uppgifter

Det här rumsprovet körs lokalt med den bifogade filen. Kostnaden hos World Labs för vårt prov är 0 USD. Filmetadata anger Blender. Uppgift om vad skaparen betalade kan inte läsas ut ur modellen.

- Prislistan anger Chisel under Free, Standard för 20 USD/mån med export av splats, och Pro för 35 USD/mån med texturerade mesh. Hjälpsidan placerar generering från en 3D-layout under Standard. Tillgången till just den funktionen på ett gratiskonto är därför obekräftad. [Prislista](https://marble.worldlabs.ai/pricing) · [Kontohjälp](https://docs.worldlabs.ai/marble/support/account-billing)
- Prislistan anger kommersiella rättigheter vid Pro. Användarvillkorens definition av betalkonto omfattar även Standard. §3.3 knyter rättigheterna till kontostatus när materialet genereras och anger särskilda villkor för API. Bekräfta vilken rättighet som gäller för vald plan inför en partnerdemo med genererat material. [World Labs användarvillkor](https://worldlabs.ai/terms-of-service) · [Prislista](https://marble.worldlabs.ai/pricing)
- AtlasChisel kan styra stilprov med en djupkarta och kalibrerad kamera för vardera spelarplatsen. Atlas rekommenderar 8–16 skarpa överlappande bilder som utgångspunkt för ett statiskt rum. Att återge samma ögonblick i en rörlig givning från flera vinklar kräver synkroniserade kameror. [AtlasChisel](https://docs.atlas.worldlabs.ai/atlas-chisel-tutorial) · [Atlas om filmade rum och rörelse](https://docs.atlas.worldlabs.ai/using-video-footage)
