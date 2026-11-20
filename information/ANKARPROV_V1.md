# Ankarprov v1 med Paulina vid kortskon

En gemensam rigg med två handposer ger 120 reproducerbara kameravyer av Paulina. Två Grok-filmer med samma givprompt och var sin startvy gav olika korthantering och olika landning. Fotoprovet undersöker en annan fråga, om en film kan föra Paulina från vila till rätt grepp vid skon. [RFGCA, studiorna och Dealers originalankare](RFGCA_OCH_ANKARBILDER.md)

## Två ankare från våra egna bilder

Jakob har godkänt A1 och A2.3 som underlag. Den gula framsidan är helt gul ända ut till kanterna. Vitt i skon tillhör korten som ligger bakom. Storleksskillnader kan justeras i efterbehandlingen. [Formulering till modellerna](RUNWAY_DEALER.md#paulinas-gula-kort)

| Ankare | Fotobild | Pose i den gemensamma riggen |
| --- | --- | --- |
| A1, vila | Original 03 gav ansikte, kostym, tatueringar och båda handryggarna mot bordet. ImageGen lade till grön filt och svart kortsko på Paulinas vänstra sida. | Blick mot frontkameran, händer på filten, inga lösa kort. |
| A2.3, redo | Samma A1-foto redigerades med vår 3D-pose som handreferens. Vänster pek- och långfinger vilar över gult. Höger hand ligger på grönt framför mynningen. | Vänster pek- och långfinger ligger 0,27 respektive 0,22 mm från kortytan. Högerhandens närmaste hudpunkt ligger 15,86 mm från skons mynning. |

Kamera och skala är kända för riggen. Millimetermåtten gäller modellens hudhörn. Fotobilderna är genererade referenser. Sidorna ovan är Paulinas egna. Fotobearbetningens posereferens var arbetsprov 3, och de låsta Runway-startbilderna till givarna kommer från slutscenen `ae129ea1…`. [Fotobildernas källor](../avatars/paulina/prov-ankare/v1/foto/bildregister.json) · [Handpose och kontakt](../avatars/paulina/prov-ankare/v1/rigg/posematning.json) · [Händer i båda kamerorna](../avatars/paulina/prov-ankare/v1/granskning/rigg-ae129ea1-ankare-handbild.jpg)

## Vad 120 virtuella kameror gav

Vi renderade A1 och A2.3 vid var tredje grad från 0° till 357°. Det gav **120 olika kameramatriser och 240 stillbilder**, med samma kropp, 127 leder och samma skogeometri. I A2.3 syns det gula kortet i **102 av 120 vinklar (85 %)**. Mellan 168° och 219° skyms det helt. Vid 0° syns 1 395 gula bildpunkter, vid +70° syns 247. De 55 rutorna från A1 till A2.3 renderades också från fronten och +70° med samma bildrutetider. Gult kan döljas bakom Paulinas arm och skon medan handens verkliga position i scenen ligger fast. [Spela rörelsen från båda kamerorna](http://127.0.0.1:4317/api/assets?name=paulina-a1-a23-synkron-v1--4971ddb6f51ea99f.mp4) · [Rotera runt A2.3](http://127.0.0.1:4317/api/assets?name=paulina-a23-kameraorbit-v1--c5cf4d2fabeaf2f8.mp4) · [Samtliga 120 kameror](../avatars/paulina/prov-ankare/v1/kameror/kameror.json)

## Runway-proven

| Studiorevision | Beställning | Vad bildgranskningen visade |
| --- | --- | --- |
| v3, Grok 1.5 Lite, 10 krediter | A1-foto och text, 3 s. Blick ner, vänsterfingrar på gult, högerhand på filt. | Ruta 0 stämmer med A1. I ruta 32 går vänsterhanden mot den ljusa kortstapeln. I rutorna 48 och 72 täcker **höger** hand det gula. Händernas bildcentrum stannar inom fyra pixlar från slutläget under de sista 0,83 s. [Original](http://127.0.0.1:4317/api/runway/film?v=3&original=1) · [Närbilder](../avatars/paulina/prov-ankare/v1/granskning/grok-v3-a74de81f-hander-och-sko.jpg) |
| v4, Grok 1.5 Lite, 10 krediter | 3D-ankare A2.3, front. Dra ett gult kort, ge det till mitten och återgå. | I ruta 24 håller två händer kortet. Ett tydligt släpp syns från ruta 57. Det enfärgade gula kortet ligger fritt och högerhanden stannar ute på filten i ruta 72. [Original](http://127.0.0.1:4317/api/runway/film?v=4&original=1) |
| v5, Grok 1.5 Lite, 10 krediter | Exakt samma text och samma 3D-pose som v4, kamera +70°. | I ruta 24 håller högerhanden ensam det gula kortet. Tydligt släpp från ruta 55. I ruta 67 når högerfingrarna det lösa kortet igen och täcker en del av det i ruta 72. [Original](http://127.0.0.1:4317/api/runway/film?v=5&original=1) · [Närbilder ur båda givarna](../avatars/paulina/prov-ankare/v1/granskning/grok-v4-v5-kort-i-narbild.jpg) |
| v6, Kling 4, 39 krediter | Samma A1-foto och text som v3. Här ingår även vår fotobild av A2.3 som sista bild. | Högerhanden går först **264 px bort från skon** till ruta 28 och klipps i bildens underkant i rutorna 34–40. Vänsterfingrarna når gult i ruta 52. I rutorna 58 och 72 täcker vänster pek- och långfinger kortets överkant och högerhanden ligger på filten. [Original](http://127.0.0.1:4317/api/runway/film?v=6&original=1) · [Omvägen och slutposen](../avatars/paulina/prov-ankare/v1/granskning/kling-v6-omvag-och-slutpose.jpg) · [Målbild och båda filmresultaten](../avatars/paulina/prov-ankare/v1/granskning/grok-v3-kling-v6-ankare-i-narbild.jpg) |

Varje film beställdes genom studions synliga beställningsvy i 720p med tre sekunders beställd speltid. De fyra originalen gav 73 bildrutor vardera vid 24 fps. Ruta 72 börjar vid 3,000 s. Jämförelsefilmen bevarar varje presentationstid med **0 ms avvikelse**. De båda fotoproven använde samma skickade JPEG-fil och samma text. Både modellvalet och slutbilden ändrades i v6, så deras enskilda bidrag kan inte beräknas ur det här paret. Pris enligt de fyra beställningsvyerna var **10 + 10 + 10 + 39 = 69 krediter**, eller 8,6 % av ramen 800 för detta prov. [Alla fyra filmer i samma spelare](http://127.0.0.1:4317/prov-ankare/v1/film.mp4) · [Bildrutetider, modellval och kontrollsummor](../avatars/paulina/prov-ankare/v1/visning/jämförelse.json) · [Runways API-priser](https://docs.dev.runwayml.com/guides/pricing/)

## Hamnar kortet på samma plats från två håll?

I ruta **63 (2,625 s)** ligger ett löst kort synligt på filten i båda Grok-givarna. Vi markerade dess fyra hörn, tog diagonalernas skärning och projicerade bildpunkten på den kända filten i varje kamera. De två uppskattade landningspunkterna ligger **19,4 cm från varandra**. Bildlokaliseringens marginal ger ungefär ±0,9 cm framifrån och ±1,0 cm från sidan. Fyra fasta bordsdetaljer per vy låg kvar på samma heltalspixel i alla 73 rutor. [Sex bildrutor med mätpunkter](../avatars/paulina/prov-ankare/v1/geometri/grok-kortcentrum.jpg) · [Kameramätning och marginaler](../avatars/paulina/prov-ankare/v1/geometri/grok-kortcentrum.json)

För samma verkliga punkt bestämmer den ena kamerabilden en linje där punkten måste ligga i den andra. Ett fast GLB-korthörn gav bara **0,32 px** avstånd till den linjen. Det utdelade kortets centrum gav **0,35/0,33 px** i ruta 30, **33,94/31,43 px** i ruta 39 och **91,27/85,04 px** i ruta 63. Två visuellt rimliga givar kan alltså råka stämma i ett ögonblick och sedan följa olika banor. Mätningen gäller just dessa två oberoende tagningar. [Kontrollhörnet i båda kamerorna](../avatars/paulina/prov-ankare/v1/geometri/kontroll-skohorn.jpg) · [Råmätningar](../avatars/paulina/prov-ankare/v1/geometri/grok-kortcentrum.json)

## Hur nära dealerfilm är vi?

Den fotobaserade fronten bevarar fler synliga detaljer i naglar, tatueringar och ansikte. I 3D-vyn från 180° är bakhåret suddigt och det finns en skarp ljus fläck på kavajryggen. De 120 kamerorna gör sådana fel lätta att hitta. Alla använder samma underliggande hår, hud och kavaj. För spelaren är målet att kunna flytta sig mellan stolarna och fortfarande se samma Paulina ge samma kort till rätt plats. Nästa kvalitetsprov är en sådan giv med låst kortbana och fotobaserad kontroll av ansikte, handgrepp, släpp och återgång från spelarvinklarna. [Välj själv pose och kameravinkel](http://127.0.0.1:4317/prov-ankare/v1) · [Bakhår och kavaj vid 180°](http://127.0.0.1:4317/prov-ankare/v1?pose=a23&vinkel=180) · [Fotobildernas källor](../avatars/paulina/prov-ankare/v1/foto/bildregister.json)
