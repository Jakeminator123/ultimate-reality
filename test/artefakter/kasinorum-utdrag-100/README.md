# Paulina drar ett kort i Kasinorum

[Spela utdraget i studion](http://127.0.0.1:4317/bordsprov/paulina-utdrag.html) eller [öppna visaren offline](utdrag.html). **Hela bordet** visar samma bildruta från båda stolarna. Byt bordsstorlek där. **Handdetalj** visar vad vänster pek- och långfinger gör. **Ovanifrån** visar kortets rörelse i förhållande till kroppen.

| Del | Material och mått |
| --- | --- |
| Tagning | `kasinorum-utdrag-100`, ett rödryggat kort 63 × 89 × 0,4 mm. Nio kroppsexporter och tre mellanlägen per intervall ger 33 bilder. Pek- och långfingret följer kortets översida 108 mm tills hela kortet ligger på filten. |
| Skon | Den lutande utformningen som Jakob föredrog vid X +46 och Z −21 cm. −100° från spelaraxeln +Z runt bordets lodlinje. Mynningen ligger vid X +38,61, Y +1,80 och Z −22,30 cm. Kortytans lutning är 30°. Origo ligger i filtplanet. |
| Bordet | Tidigare 160 × 108 cm. Det valda bordet är 192 × 129,6 cm, 20 % mer i båda led. De 32 extra centimeterna i bredd fördelas lika på sidorna. Framkanten flyttas 21,6 cm mot spelarna. Skons position, den konkava arbetskanten vid kroppen, de tryckta ankarmärkena och kortmålet ligger kvar. |
| Rum och kameror | Jakobs oförändrade `Kasinorum.glb`. Hela bordet har antagna ögonhöjder 124 cm från stol 4 och 116 cm från stol 1, blickens nedåtvinkel 14,19° respektive 11,57° och 48° vertikalt synfält. Närbilderna behåller kamerans ögonposition och riktas mot utdraget med 12° synfält. Båda ger 1280 × 720 pixlar. [Kameraunderlag](../../bord/filtdjup-v1/README.md) |

**Kontroll av sko och grepp.** I Dealer vid revision `c9d006d` räknar `shoeFit` ut riktningen från fotens bakre hörn mot dess främre hörn, och använder det bortre framhörnet för att placera bredden. I Ultimate Reality kontrolleras mynningen på samma sätt mot skons lokala +Z. Mittlinjen från bakänden genom mynningen går snett inåt mot dealern från hennes vänstra sida. Kortet ligger synligt i öppningen. Samtliga längder och vinklar avser provmodellerna. [Dealers placering av skon](https://github.com/Jakeminator123/dealer/blob/c9d006d/src/game3d-props.ts)

**Materialdetalj** visar gröntonad mikromocka på spelytan, brun lädernarv på relingen och längsgående valnötsfaner på sargen. Färg-, normal- och råhetskartorna kommer från Poly Haven och appliceras i skannad skala. Välj **Tidigare material** för att jämföra exakt samma vy och belysning. [Material, källor och licens](../../bord/polyhaven-material-v1/README.md)

**Vald pose** är den upprätade bordsvilan 08 med en rörlig vänsterarm i MHR-riggen. Huden över pek- och långfingerområdet ligger 0,0003–0,0494 mm från kortytan. Ingen genomskärning i något av de 33 synliga lägena vid tolerans 0,001 mm. Från stol 1 följer fingertopparna kortets lutande framsida. Vänster armbåge har fortfarande en skarp kontur i slutrutan från stol 4. Rörelsen styrs av rigg och kortbana. Friktion och greppkraft är inte uppmätta.

**Mätningen** använder Paulinas exporterade hudtrianglar, kortets böjda volym, skons faktiska väggar, stapel och läpp samt stora bordets skiva. Den testar de 33 lägen som verkligen visas, med samma linjära interpolering. Rapporten anger komponent, möjlig penetration, fingertoppsavstånd och hash för respektive kroppsruta. [Mätningen per bildruta](matt-kollisioner.json)

**Återskapa** genom att köra `kortbana.py` med labbets Python från roten. Från `studio` körs `node ../test/artefakter/kasinorum-utdrag-100/kollisioner.mjs` och `node ../test/artefakter/kasinorum-utdrag-100/render.mjs` med samma posemapp. Visaren innehåller rumsbilder, handbilder, det gamla bordets bildpar och ovanvyer, så den kan spelas upp utan nätanslutning. [Kortbanans geometri](bana.json)
