# LJUS-05 · Paulina v2 drar kortet i Brown Photostudio 50 %

Öppna [Stol 4](http://127.0.0.1:4317/bordsprov/handljus?stol=4) eller [Stol 1](http://127.0.0.1:4317/bordsprov/handljus?stol=1). Spela kortdraget eller ställ reglaget på valfri ruta. Slå av och på **Mjukt ljus på vänsterhanden** vid samma pose. Båda stolarna använder den fotograferade och animerade 127-ledersriggen `paulina-kortdrag-v2-v1` i bordets koordinatsystem.

- [Film med helbild och handutsnitt från båda stolarna](http://127.0.0.1:4317/bordsprov/handljus/kortdrag-v2.mp4). Vänsterhanden tar det första rödryggade kortet ur SKO-03 vid 70/30. De nio kontrollerade KORT-02-kurvorna interpoleras till samma 33 lägen som riggexporten.
- [Hand, kort och skomynning i ruta 1, 17 och 33](http://127.0.0.1:4317/bordsprov/handljus/grepp.jpg). Varje kolumn visar samma tidpunkt med och utan handljus. Utsnitten förstoras från de fasta kamerornas 1600 × 900-bilder.
- [Hela bordet på ruta 17](http://127.0.0.1:4317/bordsprov/handljus/jamforelse.jpg). Bord, rum, kamera, kroppspose och fototextur är identiska för respektive A/B-par.

## Ljus och kamera

Jakobs RUM-03, BORD-02, SKO-03 och glaset står kvar som i [LJUS-04](../ljus-v1/README.md). Brown Photostudio 01 är samma lokala 4K-HDRI. Förfiltrerad miljöstyrka är 0,24 och glasets miljöstyrka 0,625. Huvudljus, hemisfärljus och ACES-exponering 1,05 är låsta. Kamerahöjder över golvet är 124 cm och 116 cm med 48° vertikalt synfält. Inga externa bildjobb beställs.

Handljuset motsvarar en liten avskärmad diffusor. Fyra lika ljuskällor samplas över en öppning på 6,4 × 3,8 cm, centrerad vid (0,29, 0,13, −0,08) m. De riktas mot (0,35, 0,073, −0,285) m i bordets system, cirka 22 cm från mitten. Varje ljus har antagen intensitet 0,018 cd, mjuk kon med halvvinkel 32° och penumbra 0,72. Överlappande skuggor från de fyra ljuspositionerna mjukar upp konturen. En provad större oskärmad yta gav en bred ljusfläck på filten.

[Ljusmätningen](ljusmatning.json) jämför medelluminansen från linjäriserade sRGB-pixlar på ruta 17. Posterna anger de faktiska pixelrutorna för hud, kort, filt och bakvägg. Handljusets synliga styrka beror på fingrarnas riktning och om handen skuggar sitt eget grepp. De tre filtutsnitten representerar olika delar av bordet. Ljuset kan ändå falla på filten direkt intill skons mynning.

| Skillnad med fyllning, ruta 17 | Stol 4 | Stol 1 |
| --- | ---: | ---: |
| Fingerhud nära kontakten, 6 × 5 px | +31,3 % | +60,0 % |
| Hudyta närmare handleden | +17,8 % | +0,1 % |
| Hela utsnittet med hand och kort | +28,9 % | +11,4 % |
| Tre filtutsnitt samt bakväggen | 0,0 % | 0,0 % |

Rörelsen i film och visare kommer från export E, SHA-256 `c05b66757319c3742c8700c637dd6f32939714960b9479c37736c3b48be5577b`. Kamerorna renderar samma ögonblick. Stol 4 visar fingrarna mot kortets mönstrade rygg. Från Stol 1 ligger handflatan framför en del av kortet. Ljusets ökade kantteckning syns även där, men själva kontakten är delvis skymd. [Geometrikontroll för export E](../../../../dealer/paulina/kortdrag-v2-v1/kollisioner.json)

## Återskapa

Den lokala [animerade riggexporten och passningen](../../../../dealer/paulina/kortdrag-v2-v1/) används tillsammans med [KORT-02-banan](../../../../artefakter/skoriktning-70-30/bana.json). Filmen innehåller 72 rutor vid 24 bilder/s. Poserna 1, 17 och 33 återfinns på videoruta 12, 28 och 44 med nollindexering. Första posen får ytterligare tolv stilla rutor före rörelsen och slutposen ytterligare 27 efter rörelsen. [Filmhash, laddad rigghash och verkliga kamerapositioner](filmunderlag.json) · [Bildruta till kortpose](tidslinje.json)

Starta den lokala studion på port 4317. Kör `node ../test/bakgrund/polyhaven/brown-photostudio-01/handljus-v2/render.mjs` från `studio/` för att rendera med Edge, FFmpeg och Python/Pillow/NumPy. Flaggan `--stills` skriver endast bilderna och ljusmätningen.

Kör `python -B registrera.py` från den här provmappen efter en full export. Registreringen använder den laddade animationsfilens SHA-256, den färdiga filmens SHA-256 och kamerornas uppmätta positioner. [Film i Paulinas lokala versionsrapport](http://127.0.0.1:4317/api/material?dealer=paulina&report=md) · [Oberoende hud- och kollisionskontroll](granskning/README.md)
