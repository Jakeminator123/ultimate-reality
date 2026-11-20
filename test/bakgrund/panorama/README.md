# Panorama v1 · fotograferade rum i 360°

[Öppna fotostudion](http://127.0.0.1:4317/bordsprov/panorama) · [Bordet från Stol 4](http://127.0.0.1:4317/bordsprov/panorama/fotostudio?stol=4) · [Bordet från Stol 1](http://127.0.0.1:4317/bordsprov/panorama/fotostudio?stol=1) · [Lythwood Lounge](http://127.0.0.1:4317/bordsprov/panorama/lounge)

Miljöerna visas från varsin fotograferingspunkt. Dra i bilden för att se golv, tak och väggar, eller använd piltangenterna när bilden har fokus. Helskärm och **Till utgångsvyn** finns i båda rummen. I loungen öppnas blicken mot sofforna och eldstaden. I fotostudion öppnas den mot soffan och fönstret.

| Miljö | Lokalt underlag | Visad startvy |
| --- | --- | --- |
| Lythwood Lounge | [Poly Havens 4K-HDR](../polyhaven/lythwood_lounge_4k.hdr), SHA-256 `73eac612deceab404e268048c35db4b09d27d7142b5b63d11f811d6354b133c5` | [Loungen i visaren](lounge.jpg) |
| Brown Photostudio 01 | [Poly Havens 4K-HDR](../polyhaven/brown-photostudio-01/brown_photostudio_01_4k.hdr), SHA-256 `998c80351de3629f0a2cca4a1be6027dcf6ea840d95fa9eea16146d6e7cc77f9` | [Fotostudion i visaren](fotostudio.jpg) |

Jakob valde den tomma fotostudion som startvy. I de tomma rummen roterar kameran med 63° vertikalt synfält. Bordsläget använder den befintliga geometrin BORD-02, de skannade materialen YTA-02 och kortskon SKO-03 i 70/30-riktningen. Samma 4K-panorama ger både bakgrund och reflexer. Bordets riktning är antagen och placerar soffan bakom dealerplatsen från Stol 4. Kamerabytet flyttar betraktaren i förhållande till bordet. Fotot visar rummet från en enda fotograferingspunkt.

| Bordsvy | Antagen ögonhöjd över golv | Riktning (x, y, z) | Vertikalt synfält | Bild |
| --- | --- | --- | --- | --- |
| Stol 4 | 124 cm | (0, −0,24507, −0,96950) | 48° | [Stol 4](stol-4.jpg) |
| Stol 1 | 116 cm | (0,88751, −0,20061, −0,41484) | 48° | [Stol 1](stol-1.jpg) |

Bordets antagna yttermått är 192 × 129,6 cm. Filthöjden är antagen till 75 cm. [Bordsmodell](../../../studio/lib/table-layout.json) · [Fast kamerakalibrering](../../bord/filtdjup-v1/matt.json) · [Kortskons version och mått](../../artefakter/skoriktning-70-30/README.md)

De båda stolsbilderna är 1400 × 820 px. Från Stol 4 ligger soffan bakom bordet. Från Stol 1 syns fönstret över relingen. Vridning 45° åt höger och återställning provades i båda stolarna och de två tomma rummen. De återställda vyerna blev pixelidentiska med sina startbilder. Helskärm och sidbredd 390 px är kontrollerade.

## Golvkontakt från Stol 1 och Stol 4

Provet `golv-v2` utgår från `panorama-v1`, Brown Photostudio 01 och BORD-02. Öppna en stol och välj **Visa bordsfötterna**. Kryssrutan **Kontaktskugga** växlar mellan referensen och en mjuk skugga kring varje mässingsfot. Kamerans position och vertikala synfält på 48° är desamma som i stolsbilden. Blicken riktas 32,09° längre ned. [Prova Stol 1](http://127.0.0.1:4317/bordsprov/panorama/fotostudio?stol=1&vy=golv) · [Prova Stol 4](http://127.0.0.1:4317/bordsprov/panorama/fotostudio?stol=4&vy=golv)

| Kamera | Bildgranskning | Referens | Med kontaktskugga |
| --- | --- | --- | --- |
| Stol 1, 43,66° nedåt | En fot syns mot ljusa golvplankor. Skuggan möter mässingsringen och plankskarven kan följas genom skuggan. | [Utan skugga](golv-v2/stol-1-utan.jpg) | [Med skugga](golv-v2/stol-1-med.jpg) |
| Stol 4, 46,27° nedåt | Båda fötterna syns. Varje ring får en mjuk skugga utan synlig ytterkant. | [Utan skugga](golv-v2/stol-4-utan.jpg) | [Med skugga](golv-v2/stol-4-med.jpg) |

Skuggornas lägen och storlek följer 3D-modellens lägsta cylindrar. Skuggstyrkan är vald för bildprovet. Fotot är taget från en punkt och golvets verkliga avstånd till de modellerade fötterna är okänt. Vid jämförelse före JPEG-export var referensbilden pixelidentisk med v1 efter fyra piltryck nedåt. Påslagen skugga mörkade 12 275 av 771 456 pixlar från Stol 1 och 13 356 från Stol 4. [Skuggans utformning](golv-v2/kontaktskugga.mjs)
