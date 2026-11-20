# Första studion

**Målet är att kunna beställa en bra dealerfilm och se exakt var kortet hamnar.** Första försöket är en giv till plats 4 från vila, via sko och grepp, till ett kort som ligger kvar på bordet. Stol 4 och stol 1 visar samma händelse på samma tidslinje.

Redigeringsvyn och den gemensamma 3D-scenen är genomförda i Next.js, React och TypeScript. JSON-förhandsvisningen stöder Kling 2.5 Turbo Pro, Kling 4, WAN 3 och Grok Imagine Video 1.5 Lite på Runways bild-till-video-endpoint. Verklig beställning är en senare etapp.

[Scenmiljö](http://127.0.0.1:4317/scenmiljo) samlar **Bakgrund och ljus**, **Bord och kortsko**, **Kort och markeringar** samt **Scenprov**. Skons placering och riktning hör till bordets geometri. Det utbytbara trycket hör till kortet. I Scenprov kan samma frysta grepp visas från stol 4 och stol 1 i fotostudion RUM-02. Filmen LJUS-05 visar utdraget i kasinorummet RUM-03. [Jämför poser och rörelse](http://127.0.0.1:4317/scenmiljo/scenprov)

Under **Bakgrund och ljus** visar [Fotopanorama (360°)](http://127.0.0.1:4317/scenmiljo/bakgrund/fotopanorama) en förhandsbild per rum. Sidan och visaren använder samma [rumsregister](lib/panorama-rooms.ts). Öppna det tomma rummet eller välj stol 4 eller stol 1 i visaren. Vid ett direkt rumsbyte följer stol, bordsmatta och vald pose med. Brown Photostudio 01 är den valda fotostudion för Paulinas placeringsprov.

## Grundbilder för en sittande dealer

Använd [3D-modellering](http://127.0.0.1:4317/#modellering) för den aktiva Fas 1-serien och sittmodellen v2. [Bildstandarden](http://127.0.0.1:4317/bildstandard) anger kamera och pose för varje vy. [Övrigt](http://127.0.0.1:4317/ovrigt) innehåller den tidigare dockmallen och SAM-försöken.

SAM 3D Body skattar en kropp per bild. Till Paulina v2 används sittfronten som kroppskälla, med trekvart och profil som jämförelser. Modellutgåvans profil har 3,88 % mindre bildskala än sittfronten. Det nya profilprovet från samma sittfront har 1,79 % mindre bildskala och visas bredvid v2. Studion visar originalens mätpunkter, markerar utsnitt som avviker och jämför ögonens bildläge med riggen. Kamera och riktpunkt kan flyttas i höjdled tillsammans. Fysisk sitthöjd och fotots höjdvinkel behöver kalibrerat underlag. [Ny sittprofil och v2](http://127.0.0.1:4317/bildstandard/sittprofil#jamforelse) · [Kamerakontroll](http://127.0.0.1:4317/bildstandard/sitthojd) · [Bildstandard och granskningsgränser](../information/BILDPIPELINE.md#sittserie-och-kamerakontroll) · [SAM 3D Body](https://github.com/facebookresearch/sam-3d-body)

Paulinas tre porträtt och handryggsbilden bidrar till v2:s fotoyta. Kortbilderna visar kontakt och fingerställning. Kortfilmen LJUS-05 använder samma MHR-rigg som modellvyn. I v2:s exporterade GLB-filer påverkar käken och fingerlederna ytan. Ögonlederna ger positionsreferenser och filerna har inga blendshapes för ögonlock och läppar. Prova käken i ansiktsvyn. Nästa underlag för rörelse är ett kortdrag synkat framifrån och från sidan samt en ansiktsfilm med blinkning och ett kort yttrande. Det externa förslaget om LHM++ och SMPL-X avser en alternativ representation där MHR-rörelsen behöver passas in. [Modellens aktuella materialrapport](http://127.0.0.1:4317/api/material?dealer=paulina&report=md) · [Metas MHR–SMPL-X-konverterare](https://github.com/facebookresearch/MHR/blob/main/tools/mhr_smpl_conversion/README.md)

| Foto | Vad som ska synas |
| --- | --- |
| 1. Stående framifrån | Helkropp från huvud till skor, armarna något ut från kroppen. Detta ger silhuett, klädsel och ansikte. |
| 2. Sittande framifrån | Flytta undan bordet. Visa hela sittposen med bäckenet mitt på stolen, axlarna avspända och fötterna på golvet. |
| 3. Sittande i ren sidoprofil | Flytta kameran 90° runt samma sittpose. Håll den i våg på brösthöjd. Visa stol, höft, knän och fötter med fri sikt. |
| 4. Båda handryggarna ovanifrån | Skarpa fingertoppar, naglar och tatueringar med ett spelkort intill för skala. |

För en ny dealer innehåller [bildstandarden i studion](http://127.0.0.1:4317/bildstandard) elva grundbilder. Ta stående helfigur, sittande helfigur utan bord och ansiktsporträtt framifrån, i 45° trekvart och i 90° profil. Flytta kameran åt samma håll och behåll posen inom varje serie. Ta sedan båda handryggarna ovanifrån och kortgreppet från tumsidan cirka 20° över den vita ytan. Den extra rörelsebilden visar högerhanden under kortvändningen. Referensfoton för identitet, kläder, pose och korttryck styr prompterna. Hela serien kan hämtas som JSON med fält för filuppgifter, synliga egenskaper och osäkerheter. Om ryggen ska visas i slutscenen kan en bild bakifrån ge underlag för håret och kläderna.

I [Paulinas Fas 1, upplaga 1](http://127.0.0.1:4317/fotomall.html/fas-1/v1/index.html) visar sittbilderna en neutral stol utan armstöd och händerna på låren. Hand- och kortbilderna har matt vit bakgrund med en svag kontaktskugga. Referenskortets mörkröda rygg har en vit punkt i ett hörn för orientering. En extra bild visar högerhandens nyp när kortet vänds i luften. För att följa en verklig snabb vändning behövs film med synliga hörn och liten rörelseoskärpa. I den egna 3D-scenen går kortets position och rotation att läsa direkt från kortobjektet.

**Blandade foton av en ny person.** Runways bildbeta tar exempelvis fyra foton där personen syns från olika håll och skapar alltid en ny stående front. Personens synliga drag hämtas från hela originalurvalet. Den genererade fronten är sedan huvudreferens för kläder, proportioner och de båda stående sidovyerna. Sittande front använder samma ståfront. Sittande 45° och 90° använder sittfronten. Varje steg behåller personens egna original som stöd. [Synlig beställningsvy](http://127.0.0.1:4317/bildpipeline) · [Pipelineplan och format](../information/BILDPIPELINE.md)

**Korttryck för nya handbilder.** `referenskort-x-v1` är 63 × 89 mm. Den fasta PNG-filen har 252 × 356 pixlar. I sRGB är ryggen (152, 1, 9), X:et (241, 240, 242) och hörnpunkten (222, 198, 250). Punkten är 6 mm i diameter och centrerad 10 mm in från kortets övre vänstra kanter. I en senare 3D-rendering kan kortet få en ny färgtextur. I film kräver samma byte att kortets hörn går att följa och att fingrar framför det täcker trycket. [Kortstandard och PNG](http://127.0.0.1:4317/bildstandard#referenskort) · [Färgtexturer i Three.js](https://threejs.org/manual/pages/color-management.html)

För kortgivningen ger några sekunders verkligt utdrag från grepp till släpp underlag för tempo och fingerkontakt. Paulina har redan 01 för helkropp och 03 för utseende. 05 och 05b är genererade sidoprofiler. Den mest värdefulla nya bilden är en fotograferad sidoprofil i neutral sittpose. Tidigare bilder med lutning kan användas för ansikte, kläder och arbetsrörelser.

## Från Paulinas rigg till dealerfilm

Jakobs externa granskning i `3D-TIPS` avser projektet `3d-dealer`. I Ultimate Reality kan vi prova dess förslag om identitet, handkontakt och en gemensam rörelse med våra egna foton, riggar och kameror. [Metas SAM 3D Body](https://ai.meta.com/research/publications/sam-3d-body-robust-full-body-human-mesh-recovery/) · [Momentum Human Rig](https://github.com/facebookresearch/MHR)

| Spår | Underlag i Ultimate Reality | Föreslaget nästa prov |
| --- | --- | --- |
| Styrbar avatar | Sittfronten gav Paulinas v2-kropp med 127 MHR-leder. Tre sittbilder, tre porträtt och ett handfoto gav det valbara fotoutseendet. | Inspektera bakre hårfäste och kavajrygg från nya vinklar. Använd bakre trekvartsfoto om konturerna behöver rättas. |
| Rörelse och kort | V2 drar KORT-02 ur 70/30-skon med vänster pek- och långfinger. Pose 17 visar höga armbågar i fotostudion. | Filma ett verkligt utdrag framifrån och från sidan samtidigt. Passa armbågar, handled och fingrar. Animera hela given till plats 4 med släpp, landning och återgång till vila. Rendera samma tagning från stol 4 och stol 1 med kortet kvar på filten. |
| Videokvalitet | Det versionsbundna Brown-provet visar hela scenen och handens grepp från stol 4 och stol 1 med samma fotoyta och ljus. | Jämför fryst ruta och rörelse med verklig film i spelarens utsnitt. Om hud eller tyg brister, prova filmprojektion från en känd kamera och fyll skymda ytor med avatarens textur. |

**Upplösning per version.** Studions materialrapport visar filernas verkliga format, originalstorlek, SAM:s inlästa bild, kropps- och handutsnitt samt den inbäddade fototexturens mått. Körningens mätningar och uppgifter från en senare kontroll av modellkonfigurationen är märkta var för sig. Behåll Paulinas nuvarande helbilder för posen. Filma greppet samtidigt från sidan för att få fingrarnas djup. För hår eller textur behövs skarpa original av de ytor som ska synas. [Aktuell materialrapport](http://127.0.0.1:4317/api/material?dealer=paulina&report=md) · [Materialstandarden och nästa kortprov](../information/MATERIALVERSIONER.md)

**Granskning i studion.** Fas 2 kan visa kroppsform, fotoutseende eller enbart riggen. Ben och ledpunkter följer de faktiska poserna i GLB-filen. Standardurvalet visar 77 leder. Alla 127 kan visas tillsammans med de interna hjälplederna. När en armbåge eller knoge böjs visas ledvinkeln och riktningen till handleden eller fingertoppen i modellens centimeter. Arbetskamerans vridning, höjdvinkel, avstånd och zoom kan avläsas och justeras. Kameraavståndet avser 3D-kamerans riktpunkt. De genererade fotonas avstånd är okända. [Paulina v2](http://127.0.0.1:4317/#modellering) · [08-riggens utdrag](http://127.0.0.1:4317/bordsprov/paulina-utdrag.html)

## Vad Jakob ska kunna göra

| Arbetsyta | Redigera | Granska och spara |
| --- | --- | --- |
| Scen | Välj identitet, pose, givmål, kortets läge, stol och kamera. | Visa två kameror på samma ruta. Frys grepp, kort på kant och släpp. |
| Beställning | Välj referensbilder, beskärning, prompt, modell och stödda inställningar. | Visa exakt bild efter beskärning och begärans faktiska fält utan autentiseringsuppgifter. Visa känd kostnad eller ange att den är okänd. Skicka är en egen handling. |
| Granskning | Stega i filmen, markera första felrutan, trimma klippet och justera kortlager, mask eller landningspunkt i en arbetskopia. | Visa mottaget original bredvid redigeringen och den frysta referensen. Spela om. Godkänn exakt version eller öppna ett nytt beställningsutkast från samma underlag. |

Runway-jobbets ID, skickad revision och mottaget original hör ihop. Spara originalfilen lokalt när den är klar och kontrollera dess hash. En trimning, ändrad mask eller ny beställning får ett eget revisions-ID. Leverantörens resultatlänkar är tillfälliga. [Runways dokumentation om utdata](https://docs.dev.runwayml.com/assets/outputs/)

## Byggordning

1. **Redigerbar lokal arbetsyta.** TypeScript och React i en enda Next.js-app under `studio`. Node hanterar labbets filer på serversidan. Börja med ett eget foto och en film som Jakob lagt i labbets inkorg. Spara ett utkast, öppna det igen och jämför original med en redigering efter omladdning. En lokal import låter oss testa hela granskningsflödet före ett betalt jobb.
2. **Kort och referensfigur.** Lägg till kortets 3D-bana och de två kamerorna. Jakob ska kunna flytta landningspunkten, stega en ruta och se ändringen från båda stolarna. Spara scenversion och tidpunkter med beställningen.
3. **En riktig Runway-beställning.** Lägg till en serveradapter för en vald modell. Skicka, följ status och hämta originalet. Ett dubbelklick eller en omladdning ska återöppna jobbet. Vid avbrott utan känt jobb-ID ska operatören se det osäkra läget innan ombeställning.
4. **Godkänd tagning.** Jämför grepp, överlämning, landning och kvarliggande kort från båda stolarna. Spara beslut med bildruta och scenversion. Export till Scoutgaming kommer efter ett godkänt lokalt försök.

## Första receptet

[Giv till plats 4](recept/giv-plats-4.json) beskriver vad vi vill spela in och vad vi bedömer. `app` innehåller redigeraren, filmgranskningen och de lokala API-rutterna. `lib` innehåller utkastets modell, bildbeskärning och disklagring. [Start och verifiering](../README.md)
