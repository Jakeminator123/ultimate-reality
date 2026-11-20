# Fotopanorama · fotograferade miljöer i 360°

[Välj bland fem miljöer i studion](http://127.0.0.1:4317/scenmiljo/bakgrund/fotopanorama). `rum-v2` utökar `panorama-v1` med en softboxstudio, en herrgård utomhus och en övergiven fabriksmatsal. Byt rum medan du tittar från Stol 4 eller Stol 1 för att jämföra samma bord, rigg och kort under olika ljus. Val av stol, matta, rörelseprov och synfält följer med vid rumsbyte. [Poly Havens filer, lokala bildversioner och startvyer](rum-v2/README.md)

Källan täcker 360° runt kameran och 180° från golv till tak. Visaren projicerar en del av panoramat på en plan bild. I tomt rum används normalt 63° vertikalt synfält, vid bordet 48°. **Vertikalt synfält** ger även 40° och 75° i båda lägena. Vid bildformatet 16:9 motsvarar dessa fyra val cirka 95°, 77°, 66° respektive 108° horisontellt. När visningsytans bredd ändras följer det horisontella utsnittet med.

## De ursprungliga två miljöerna

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

## Paulina v2 vid bordet

**Paulinas giv till plats 4** spelar den registrerade tagningen `samspel-v2-v1` i valfritt rum. Byt stol på samma bildruta eller använd knapparna för handbyte, landning och blinkning. [Spela från Stol 4](http://127.0.0.1:4317/bordsprov/panorama/gothic-manor?stol=4&vy=giv) · [Se handbytet från Stol 1](http://127.0.0.1:4317/bordsprov/panorama/gothic-manor?stol=1&vy=giv&ruta=15) · [Granskning och bildrutor](paulina-giv-v1/README.md)

Placeringsprovet `paulina-placering-v1` använder RUM-02 från `panorama-v1` och export E från LJUS-05. Riggen använder exportens egna bordskoordinater med skalfaktor 1. De båda kamerorna fryser pose 17 av 33 vid 16/24 s. Bord, filt och sko är BORD-02, YTA-02 och SKO-03. Det första rödryggade KORT-02 har färdats 54 mm längs 70/30-tagningens bana. [Stol 4](http://127.0.0.1:4317/bordsprov/panorama/fotostudio?stol=4&vy=paulina) · [Stol 1](http://127.0.0.1:4317/bordsprov/panorama/fotostudio?stol=1&vy=paulina)

| Kamera | Synligt i pose 17 | Fryst bild |
| --- | --- | --- |
| Stol 4, 124 cm över modellgolvet, 48° vertikalt synfält | Bålen är centrerad bakom bordet. Kortet böjs ut ur skon och vänster armbåge hålls högt. | [Bild från Stol 4](paulina-placering-v1/stol-4-pose-17.jpg) |
| Stol 1, 116 cm över modellgolvet, 48° vertikalt synfält | Kroppen syns i profil. Hand och skomynning överlappar, vilket gör kortkanten svårare att följa. | [Bild från Stol 1](paulina-placering-v1/stol-1-pose-17.jpg) |

Bildgranskaren bedömde kroppsskalan som rimlig i de två bilderna på 1602 × 901 px. Höga armbågar, kompakt hårkontur, kavajveck och svag skugga under handen ger ett renderat intryck. Bordsskivan skymmer bäcken och sits. Modellens proportioner kan bedömas mot bordet, medan fotomöblernas verkliga avstånd och fysisk sitthöjd är okända. Vid pose 17 gav exportens tidigare geometrikontroll 0,1498 mm mellan pekfingrets hud och dess kontaktyta på kortet och 0,1491 mm för långfingret. Alla fem kontrollerade objektpar var fria från genomskärning. [Geometrirapport för export E](../../dealer/paulina/kortdrag-v2-v1/kollisioner.json)

Visaren verifierar de hämtade filernas SHA-256 innan den ställer in kroppen och kortet. Animationen är `c05b66757319c3742c8700c637dd6f32939714960b9479c37736c3b48be5577b` och kortbanan är `711a8391cdf54fac06c09785f37891438a871be0dbc4206f140037e73c19543e`. Stolsbyte behåller posen. Båda bilderna stod still vid upprepad avläsning. Golv-v2, mobilbredd 390 px och LJUS-05 på pose 17 provades efter ändringen.
