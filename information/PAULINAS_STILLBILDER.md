# Paulinas stillbilder

Börja med [de tolv bilderna bredvid varandra](http://127.0.0.1:4317/bildstandard#utgavekontroll) eller [öppna det lokala bildarket](../avatars/paulina/fas-1/v1/index.html). Sittseriens tredje bild är profilen. Filen med prefixet **03** är ett annat motiv, Paulina bakom bordet. Den är identitetsreferens för hår, kläder och tatueringar.

## De tolv vyerna i fas-1/v1

| Vyer | Vad bilderna ger | Begränsning i originalen |
| --- | --- | --- |
| Stående framifrån, trekvart, profil | Kläder, skor, proportioner och silhuett. | I profil skyms bortre handen och foten. |
| Sittande framifrån, trekvart, profil | Fronten ger kroppens grundform. Sidovyerna hjälper till att passa hållningen. | Bildutsnittet varierar. Kameran är okalibrerad. |
| Ansikte framifrån, trekvart, profil | Hud, drag, bena och tatueringar till huvudets fotoyta. | Porträtten visar främst främre och sidovända ytor. Bakhuvudet saknar egen vy. |
| Båda handryggarna | Formen på tio synliga naglar och hudens utseende uppifrån. | Små tecken på högerhanden avviker från identitetsbilden. |
| Vänster kortdrag | Pek- och långfingrets läge mot ett plant kort. | Den bortre vita kortkanten har låg kontrast. |
| Höger kortvändning B | Tumme och pekfinger vid vändning i luften. | Motkontakten skyms. Pekfingret har ett extra X. |

Alla **12/12** PNG-filer matchar bildregistrets SHA-256 och pixelmått. I den versionsbundna granskningen är **7 användbara** och **5 användbara med begränsningar**. [Bildregister](../avatars/paulina/fas-1/v1/bildregister.json) · [Bedömning per bild](../avatars/paulina/fas-1/v1/utgavegranskning-v1.json)

## Hur mycket avviker sittprofilen?

| Bild | Hjässa till skosula | Skillnad mot front | Roll |
| --- | ---: | ---: | --- |
| [Sittfront](../avatars/paulina/fas-1/v1/sittande/front.png) | 1 340 px | 0 % | Bas för kroppen |
| [Sittande trekvart](../avatars/paulina/fas-1/v1/sittande/trekvart.png) | 1 340 px | 0 % | Hållning och fotoyta |
| [Tredje bilden i fas-1/v1](../avatars/paulina/fas-1/v1/sittande/profil.png) | 1 288 px | −3,88 % | Profil i sittmodell v2. Utanför granskningsgränsen. |
| [Vald profil till givmodell v4](../avatars/paulina/fas-1/v1/granskning/sittprofil-front-v3/profil.png) | 1 316 px | −1,79 % | Profilprov 3. Inom granskningsgränsen. |

Alla fyra bilder är 1 083 × 1 452 px. Vi räknar synliga bildrader från hjässa till sula, inklusive båda ändraderna, och jämför andelen av bildhöjden med frontens. **2 %** är studions gräns för att granska utsnittet. I originalprofilen syns mer golv under skorna. Fysisk sitthöjd kräver kalibrering. [Mätpunkter i serien](../avatars/paulina/fas-1/v1/sittande-bildskala.json) · [De tre profilförsöken](../avatars/paulina/fas-1/v1/granskning/sittprofilprov.json)

## Övriga stillbilder i Paulinas bildkedja

| Var de finns | Vad de används till |
| --- | --- |
| [Avatarens numrerade underlag](../avatars/paulina/fotounderlag-v2.json) | 01 och 03 är tillförda grundbilder. 02 och 04 är friläggningar. 05/05b är tidiga sittprofiler. 06/07 visar stående vinklar. 08 visar händerna vid bordet och gav den äldre 08-riggen. 09/11 visar vänstergrepp. 10/10b visar handryggar. 12–14 är porträtten och 15/16 sittfront och trekvart. |
| [Profilförsök 1–3](../avatars/paulina/fas-1/v1/granskning/sittprofilprov.json) | Tre genererade alternativ till originalprofilen. Den valda tredje varianten är den som hör till givmodellen. |
| [Kortvändning A](../avatars/paulina/fas-1/kallor/kortvandning-a.png), [B](../avatars/paulina/fas-1/v1/rorelsereferens/kortvandning-hoger.png), [C](../test/dealer/paulina/fas-1-granskning-v1/kortvandning-c.png) och [D](../avatars/paulina/fas-1/v1/granskning/kortvandning-d.png) | A var underlag för B. C gör nypet tydligare. D rättar det extra tecknet på pekfingret. Alla visar en vändning i luften. [Kortprovet](../avatars/paulina/fas-1/v1/granskning/kortprov.png) visar trycket. |
| [Handgranskning i given](../test/dealer/paulina/handgranskning-v8-v9/v9-nagelrand-och-tumflack-kallpixlar.png) | Närbilder ur riggen visar vilka pixlar från sittfront och handryggar som hamnat på fel hudyta. [Jämförelse med och utan ljus](../test/dealer/paulina/handgranskning-v8-v9/v9-hander-bordsljus-basfarg-neutral.png) |

Det finns 18 numrerade källfiler inklusive friläggningarna. Åtta är byteidentiska med vyer i utgåvan. De 13 PNG-filerna i labbets inkorg matchar bilder i denna kedja. Handryggsbilden i utgåvan är en egen bearbetning av 10b med vit bakgrund. För nagelgranskningen behöver just den versionen följas in i modellen. [Handryggarna i utgåvan](../avatars/paulina/fas-1/v1/hander/handryggar.png)

## En kropp för båda stolarna

1. **Bygg kroppen en gång.** SAM skattar en pose per sittbild. Sittfrontens triangelyta och skelett med 127 leder blir bas. Övre rygg, nacke och huvud passas med 80 % vikt från profilens uppskattade vinklar och 20 % från trekvartens. [Riggbygget](../tools/mhr_seated_rig.py)
2. **Lägg till utseendet.** Tre sittbilder, tre porträtt och en bild av handryggarna bidrar till samma fotoyta. Givprov 8 och 9 har dessutom korrigeringar vid axel och bena. [Fotoytans bygge](../tools/paulina_utseende.py)
3. **Spela en rörelse och välj kamera.** V2 är grundmodell i modellvisaren. V4 är kroppen vid bordet. I tvåkortsgiven spelar den först tagning 8 (REDO), sedan 9 (VILA). Det första kortet ligger kvar. Stol 1 och stol 4 ser samma fingrar och samma kort vid samma tidpunkt. [Modellval](../avatars/paulina/3d/versioner/aktiv.json) · [V4-registret](../avatars/paulina/fas-1/v1/granskning/sittmodellprov.json) · [Sekvensspelaren](../studio/public/blackjack-sekvens.mjs)

Målet är en igenkännbar dealerfilm från flera spelarplatser. Riggen gör det möjligt att ändra kameran, kontrollera kortbanan och ta ut precis samma grepp eller landning som bildreferens. För sjuan gäller stol 4, sekvensruta 76–78, lokal ruta 22–24 i givprov 9. Ingen av handreferenserna visar högerhandens fingerblommor i den posen. Det är den första luckan inför arbetet med handytan. [Sjuans landning](http://127.0.0.1:4317/modellering/sekvens?dealer=paulina&id=3003aba81a5e84f1afc19143b9fab370e1a508360e5aa8849bd68d690c0d8a59&stol=4&ruta=76)
