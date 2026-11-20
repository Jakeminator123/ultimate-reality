# RUM-05 · Kasinorum i Atlas Chisel

Den 20 november 2026 importerades Jakobs [Kasinorum.glb](../kasinorum-v1/Kasinorum.glb) i **Atlas Studio → Chisel → Layout → Add → Import → Import mesh**. Scenen sparades som **RUM-05 · Kasinorum v1** och öppnades igen via **Recent scenes** i Codex webbvy. Atlas räknade 40 meshar. **Preserve hierarchy** gav åtta grupper, bland annat mittpanelen, nischerna, sidoväggarna och taket. Rummets rot hade position och rotation (0, 0, 0) och skala (1, 1, 1).

**Källa** · RUM-03, 2 393 432 byte, SHA-256 `6c6585a3f853aafd23761ba817f8e5b016d0a29fa36bcb331890d30ae092d73a`. Originalet har tre inbäddade kameror. Atlas meshimport gav rumshierarkin. De två spelarkamerorna lades till i Chisel, med fast rotation och perspektiv, med originalfilens kamera-transformer som referens.

| Kamera | Position X, Y, Z i meter | Rotation XYZ i grader | Höjd över golv | Synfält |
| --- | --- | --- | --- | --- |
| Stol 4 | 0 / 0,4900 / 1,5276 | −14,186 / 0 / 0 | 1,24 m | Atlas FOV 48°, original vertikalt 48° |
| Stol 1 | −1,3936 / 0,4100 / 0,6164 | −25,807 / −62,561 / −23,228 | 1,16 m | Atlas FOV 48°, original vertikalt 48° |

Koordinaterna är provmått i originalets referenssystem. Y är uppåt och golvet ligger på Y −0,75 m. Originalets bildformat är 16:9. Jämför mittfältet och nischernas fria yta från Stol 4 samt överlappet mellan sidoväggen och bakväggen från Stol 1. [Originalets lokala bildpar och kalibrering](../kasinorum-v1/README.md)

**Redigerarvyer** · [Stol 4](stol-4-layout.jpg) · [Stol 1](stol-1-layout.jpg). Bilderna visar de fasta kamerorna i Chisels geometriläge. Bord, kortsko, kort och dealer ingår i separata [metodreferenser](../../../information/METODER.md).

**Stilprov v1, prompt** · `A photorealistic private blackjack salon. Preserve the exact geometry of the imported room, the recessed arched niches, the dark green central wall panel, both side walls and the level floor. Use walnut veneer, brushed brass trim, dark green upholstery and matte terrazzo. Keep the middle of the floor completely empty for the studio's separate table. Soft warm architectural light, consistent across both views. No people, gaming tables, cards, chips, text or signage.`

**Iteration 1, genomförd 2026-11-20** · Atlas Chisel, Adherence 60 %, två valda kameror, gemensam prompt och ingen stilbild. Atlas returnerade nio färgvyer, varav sju automatiska Hero-vyer. Båda sparade spelarbilderna är RGB i 2560 × 1440. [Växla mellan stolarna offline](bildpar.html) · [Bildparet](bildpar-v1.jpg) · [Stol 4](stol-4-atlas.png) · [Stol 1](stol-1-atlas.png) · [Sparad Atlas-webbvy](atlas-resultat-webbvy.jpg)

Framifrån ligger två pendellampor i varsin nisch och mässingslisten löper tvärs över det mörkgröna mittfältet. Från sidan syns samma list i perspektiv, en nisch och valnötspanelen längs sidoväggen. Den ljusa golvytan är fri i båda bilderna. Bildparet håller ihop visuellt. Genererad ytgeometri och belysning är inte uppmätta. Behåll RUM-03 för exakt samplacering av Paulina, bord och sko.

**Originalfiler** · Stol 4 SHA-256 `12d7cd091a2ca9cacd1a84c3388ce8eecdc4c9fc6e34a340b2de3ced876d3c08`. Stol 1 SHA-256 `f6861feeaefeeac00f8f4f0e585afaa97216c6ffd7f31d03202857eb55303a75`.

**Krediter** · Atlas visade 60 krediter på kameravyn och 130 på iterationens renderingsknapp med två kameror. Efter iterationen redovisade Studio Usage 130 för atlasChisel, 90 för nio uppskalningar, 20 för en bildbeskrivning och 10 för Chisel-agenten. Sex agentkrediter var redan bokförda före renderingen. De separata posterna förklarar varför saldot förändrades mer än renderingsknappens pris. Kontosaldo och sessionslänk finns i den lokala provanteckningen. [Atlas fakturering](https://docs.atlas.worldlabs.ai/billing)

## Val av tjänst och användning

### Underlag till den fulla 3D-versionen

Jakob valde även Scoutgamings Boden/Palma som möjligt underlag. I Scoutgamings studiomaterial heter frontbilden `palma-photo-front-v1.webp` (1672 × 941, SHA-256 `8a291d55760079fc2fa54299604c4e7c749ce54c871a1e5ff4623d6440ea73dc`). Projektets konfiguration beskriver även en separat uppskattad Three.js-bod på 3 × 3 m. Fotofilen saknades i den aktiva lokala studion och den publicerade mediarutten svarade HTTP 401. Ett framtida fotoprov kan använda en frontbild och flera överlappande bilder från sidan. Med en ensam frontbild genererar Atlas det som hamnar runt hörnet. [Atlas arbetsgång från foton](https://docs.atlas.worldlabs.ai/build-a-scene)

[Brown Photostudio 01](https://polyhaven.com/a/brown_photostudio_01) innehåller ett 360°-HDRI i EXR/HDR och separata fotografier. Panoramat kan ge filt, läder och glas naturligt ljus och reflexer. Kameraförflyttning mellan stolarna kräver även djup för närliggande väggar och föremål. Poly Havens [The Shed](https://blog.polyhaven.com/the-shed/) visar hur en komplett nedladdningsbar 3D-scen med separata föremål ser ut.

För rekonstruktionen i Kasinorum användes Jakobs reservval, de nio granskade kamerabilderna från iteration 1. Atlas visade **5 000 Studio-krediter** för *Refined splat*. Alternativet som även lägger till sju nya kameror visade 5 110. Atlas bekräftade **Refined splat started** för den befintliga iterationen.

**Genomförd 20 november.** Atlas Activity redovisade *Succeeded*. Resultat v2 har 2 000 000 punkter. SPZ-originalet är `full-splat-v1.spz`, 31 195 069 byte, SHA-256 `41d190b1d7f7a426fa03257bc2361033409b570f5b2869ba1bfb30708d816ba2`. Saldot gick från 9 750 till 4 750 Studio-krediter. [Jämför den fulla rekonstruktionen med snabbprovet](../atlas-splat-v1/README.md) · [Stol 4 i Atlas](full-splat-atlas-stol-4.jpg) · [Stol 1 i Atlas](full-splat-atlas-stol-1.jpg)

| Fråga | Verifierat 2026-11-20 |
| --- | --- |
| Hur testar vi vårt befintliga rum? | Atlas Studio Free accepterade Jakobs fullständiga GLB direkt i redigeraren. Två kameror i samma iteration låter oss jämföra både material och geometri. Ett bildpar ger underlag för ett stilval. Originalets mätbara ytor finns i RUM-03. |
| Vad köper man i Marble? | Free listas med upp till fyra världar. Prislistan nämner Chisel under Free, medan hjälpsidan nämner generering från 3D-layout under Standard. Standard listas till 20 USD/mån med splat-, panorama- och kollisionsmeshexport. Pro listas till 35 USD/mån och omfattar högupplösta texturerade meshar. [Prislista](https://marble.worldlabs.ai/pricing) · [Kontohjälp](https://docs.worldlabs.ai/marble/support/account-billing) |
| Vilken version får användas i en kommersiell partnerdemo? | Märk AI-bilder från Atlas Free som **personligt, icke-kommersiellt prov**. Generera den avsedda demoversionen under Pro eller högre, betald API-åtkomst eller annan uttryckligen kvalificerad åtkomst. Uppgraderingen gäller nya resultat. Villkoren skiljer rättigheter till AI-resultat från delar som ingick i användarens egna indata. [Atlas-villkor §2.3, §9.10 och §9.23](https://docs.atlas.worldlabs.ai/terms-of-service) |
