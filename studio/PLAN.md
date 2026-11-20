# Första studion

**Målet är att kunna beställa en bra dealerfilm och se exakt var kortet hamnar.** Första försöket är en giv till plats 4 från vila, via sko och grepp, till ett kort som ligger kvar på bordet. Stol 4 och stol 1 visar samma händelse på samma tidslinje.

Redigeringsvyn och den gemensamma 3D-scenen är genomförda i Next.js, React och TypeScript. JSON-förhandsvisningen stöder Kling 2.5 Turbo Pro, Kling 4, WAN 3 och Grok Imagine Video 1.5 Lite på Runways bild-till-video-endpoint. Verklig beställning är en senare etapp.

## Grundbilder för en sittande dealer

Använd [3D-modellering](http://127.0.0.1:4317/#modellering) för den aktiva Fas 1-serien och sittmodellen v2. [Bildstandarden](http://127.0.0.1:4317/bildstandard) anger kamera och pose för varje vy. [Övrigt](http://127.0.0.1:4317/ovrigt) innehåller den tidigare dockmallen och SAM-försöken.

SAM 3D Body skattar en kropp per bild. Till Paulina v2 används sittfronten som kroppskälla, med trekvart och profil som jämförelser. Profilens utsnitt är 3,9 % mindre i höjd än frontens. Jämförelseläget likställer bildskalan. Fysisk sitthöjd behöver kalibrerat underlag. [Mätlinjer på fotona](http://127.0.0.1:4317/bildstandard/sitthojd) · [SAM 3D Body](https://github.com/facebookresearch/sam-3d-body)

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

## Vad 3D-figuren gör

Bygg en egen enkel sittande referensfigur. Den behöver underarm, handled, tumme och pekfinger, ett bord med kända mått, en sko och ett separat kort. Ge kortet ett greppställe, en släppruta och ett mål på bordet. När kortet ligger på bordet ska dess läge vara oberoende av kameran. Visa greppet i båda stolarna och spara referensrutorna för den valda kameran. SAM-kroppen kan ge proportioner. En fungerande fingerrigg och en snygg dealerfilm kräver egna prov.

I Paulina v2 kan du böja armbågar, pekfingrar och långfingrar. **Fotoutseende · prov** visar samma sittande kropp med ansikte, hår och kostym från Fas 1. Den tidigare 08-riggen utför första vänsterhandsutdraget på samma kortbana från båda stolarna. Nästa rörelseprov är att passa v2:s hand mot samma kort och sko. För en hel giv till plats 4 återstår överlämning, landning och släpp. [Paulina v2](http://127.0.0.1:4317/#modellering) · [08-riggens utdrag](http://127.0.0.1:4317/bordsprov/paulina-utdrag.html)

Behåll Jakobs styrka i filmproduktionen. Redigera figurens rörelse och kortets bana innan de används som underlag till en tagning. En film genererad från en kamera behöver kontrolleras mot den kameran. En separat generering för nästa stol kan ändra ansikte, grepp och tidpunkt. Märk den därför som en egen tagning och jämför båda mot samma 3D-referens.

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
