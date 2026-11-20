# Kortmarkering vid vändning

[Visa bildbedömningen och jämförelsen i studion](http://127.0.0.1:4317/fotomall.html/fas-1/v1/granskning/index.html). [Öppna de fyra simulerade korten](jamforelse.png) · [Öppna trycket som användes i foto D](provrygg.png).

Provet jämför formen på det 63 × 89 mm-kort som används i [SKO-03](../skoriktning-70-30/README.md). Kamera, kortstorlek och rörelse är identiska mellan trycken. Vinkeln anger hur långt kortet lutar från frontvyn runt sin långa axel. En frontalt sedd kortsida är 63 px i provets kamera. 72–84° under en exponering simuleras som medelvärdet av 13 projektioner. Den gröna bakgrundsfärgen kommer från filten i Paulinas bild 09.

Studion använder X:et och den ljuslila punkten som standardtryck för nya handbilder. Referensfilen har samma pixlar som `provrygg.png`, med inbäddad sRGB-angivelse och 4 px/mm. [Hämta kortbaksidan](../../../studio/public/fotomall/kort/referenskort-x-v1.png)

| Färgpar | Ljushetskontrast |
| --- | ---: |
| Vit ram mot vit yta i handryggsbilden | 1,03:1 |
| Rött tryck mot samma vita yta | 8,12:1 |
| Vit punkt mot rött i handryggsbilden | 7,89:1 |
| Föreslagen ljuslila punkt mot rött | 5,79:1 |
| Mörklila provpunkt mot rött | 1,27:1 |

Mätningen använder medianvärden i områden på 5 × 11 pixlar i v1-bilden `hander/handryggar.png`. Centrum för vit yta, ram, rött och vit punkt är (1210, 410), (1240, 410), (1300, 410) respektive (1270, 335), räknat från övre vänstra hörnet. sRGB-värdena är (245, 243, 245), (240, 240, 242), (152, 1, 9) och (241, 240, 242). De lila provfärgerna är (222, 198, 250) och (111, 67, 158). Ljushetskontrast beräknas med linjär sRGB-luminans som (ljusare + 0,05) / (mörkare + 0,05).

Rött till ytterkant visar hela konturen mot den vita ytan. På mörkgrön filt har den vita ramen en fördel. X:et synliggör perspektivförkortning. En ensam hörnpunkt anger vilket hörn som följs även efter ett halvt varv. Nyp, ocklusion, kantläge och oskärpa kan dölja symbolerna. Provet omfattar stillbilder och simulerade exponeringar. För att mäta faktisk spårning behövs en film med känd kortbana.

Återskapa de syntetiska PNG-bilderna från projektroten med `python -B test/artefakter/kortmarkering-v1/jamfor.py`. Skriptet använder Pillow, NumPy, OpenCV och Windows-typsnittet Segoe UI. Paulinas faser och fotoversioner ligger i labbets privata avatar- och provmappar. [Bildkällor och prompter för C och D](../../dealer/paulina/fas-1-granskning-v1/generering.json)
