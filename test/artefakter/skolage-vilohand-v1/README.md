# SKO-03 vid Paulinas vänsterhand

Behåll skons nuvarande placering för båda registrerade givarna. Referensen visar att vänstern möter kortet i mynningen och skjuter det in mot bordets mitt. Efter given vilar båda händerna på filten i originalet. I båda modellerna stannar vänstern vid mynningen. Ett separat rörelseprov kan behålla sko, kort, handbyte och landning och låta vänstern återgå till filten efter släppet. [Jämför utskjut, handbyte och slutläge](referens-och-giv.jpg)

### Skons läge på BORD-02

| Mått i scenens koordinater | Nuvarande värde |
| --- | --- |
| Skons mitt i filtplanet, X/Z | +460 / −310 mm |
| Skomynningens mitt, X/Y/Z | +391,1 / +18,0 / −280,5 mm |
| Skons mitt relativt dealersitsens mitt, sett uppifrån | 460 mm åt Paulinas vänster och 80 mm fram mot spelarna |
| Utskjutets riktning från spelaraxeln +Z | −66,8°, med 70 delar in mot bordets mitt och 30 fram mot spelarna |
| Kortstapelns lutning | 30° ned mot mynningen |

X växer åt Paulinas vänster, Z mot stol 4 och Y upp från filten. Sitsens mitt är X 0, Z −390 mm. Placering, riktning och lutning valdes i scenproven. Den tidigare kantmätningen gav 129,8 mm från skofoten till den konkava arbetskanten vid detta läge. Originalfilmen saknar gemensam kamerakalibrering med stolsvyerna. Delar av skons bakkant går utanför bild och de verkliga måtten på referensskon är okända. Filmen ger stöd för sidan och rörelseriktningen. En exakt fysisk omplacering i mm eller grader går inte att härleda ur den. [Stolens och bordets koordinater](../../../studio/lib/table-layout.json) · [Skons tidigare riktningsprov](../skoriktning-70-30/README.md)

### Uppmätt i de två registermodellerna

Avståndet till mynningen mäts från mittpunkten mellan vänster pek- och långfingers yttersta skelettleder. X/Z är avståndet i filtplanet. Handleden mäts från filtplanet. Skelettmåttet beskriver räckvidd. Fingerhudens kontakt med kortet har en separat mätning.

| Läge | Fingertoppar till mynning i X/Z, båda | Fingertoppar till mynning i 3D, båda | Vänster handled över filt, båda | Axel–handled, v2 / SAM v4 |
| --- | ---: | ---: | ---: | ---: |
| Sittbas vid samma bordsplacering | 406,3 mm | 474,3 mm | −167,7 mm | 427,2 / 425,8 mm |
| Givstart, ruta 0 | 19,7 mm | 23,9 mm | 171,1 mm | 239,0 / 237,6 mm |
| Aktivt utskjut, ruta 4 | 13,8 mm | 14,0 mm | 153,9 mm | 219,5 / 218,0 mm |
| Handbyte, ruta 9 | 98,3 mm | 99,0 mm | 147,8 mm | 217,4 / 215,7 mm |
| Slutläge, ruta 53 | 3,5 mm | 24,9 mm | 178,8 mm | 220,8 / 219,5 mm |

Den neutrala sittbasens fingertoppar ligger 226,7 mm under filtplanet vid samma bordsplacering. Den posen ger inget riktmärke för en avslappnad hand *på* filten. I ruta 4 motsvarar axel–handled 41,2 % respektive 40,9 % av överarmens och underarmens sammanlagda ledlängd (533,4 respektive 533,1 mm). Det finns utrymme att sträcka armen längre. Måttet fastställer inte vilken ställning som är bekväm för en mänsklig dealer.

Bildgranskaren jämförde referensens enda frontkamera med stol 4 och stol 1. I originalruta 0 ligger vänsterfingrarna redan över kortet. Vid utskjutet i originalruta 5 syns den fria kanten, i ruta 9 möter högern kortet och i ruta 38 ligger båda händerna sida vid sida. Stol 4 visar motsvarande utskjut och möte i de två givarna. Från stol 1 skyms mynningen delvis. [Originalfilmen, 39 rutor vid 24 bilder/s](../../../information/random/desk-v2-rorelsereferenser/material/pos4-v.mp4)

Kortets basgeometri, formändringar, positioner och rotationer matchar mellan de två exporterade givarna. Utskjutets framkant ligger 34,08 mm framför mynningen och 4,02 mm över filten i ruta 4. Hudavståndet från vänster pek-, lång- och ringfinger till kortet är 0,55–0,57 mm. Höger tumme och långfinger når inom 0,75 mm från märkena i ruta 9. Kortcentrum är då 22,36 mm över filten. KORT-02 landar på plats 4 vid X 0, Z +130 mm i ruta 22. De publicerade ytproven ger 0 mm fortsatt kortförflyttning och inga genomskärningar i de 54 heltalsrutorna. För sittmodell v2 kommer hud- och kollisionsmåtten från den handkomponent vars rörelsekanaler är oförändrade i givprov 5. [Handkomponentens ytprov](../../dealer/paulina/tvahandsgiv-v2-v4/matt.json) · [SAM v4:s ytprov](../../dealer/paulina/giv-sam-v4-v2/matt.json)

| Underlag | SHA-256 |
| --- | --- |
| Referensfilm `pos4-v.mp4` | `fbf7a8906d4062fedbab8911a94aa7d7778e0511982d414ce5fd5b38af03e883` |
| Giv `samspel-v2-v5` | `24dafbeb75c7157e954616379948d08b4b01bf071555d246b3203cb9e0339898` |
| Giv `giv-sam-v4-v2` | `9e3b32ff5f0cb944f8ddf42061c867cf2f51bd4348a09aac253ad6b906b7fc3e` |
| Gemensam kortbana | `bd7dfe08da0bd3b4928082120a5aa52f6610b432791a20364f3d50e09590a524` |

Kör [mat.py](mat.py) från projektroten med SAM-miljön. Skriptet verifierar de fyra modellfilerna mot registrerade SHA-256, placerar vardera sittbas med sin givexports bordstransform och läser ledpositionerna ur båda tagningarnas nyckelrutor.

```powershell
& ../sam-3d-body/.venv/Scripts/python.exe test/artefakter/skolage-vilohand-v1/mat.py
```
