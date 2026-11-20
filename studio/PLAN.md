# Första studion

**Målet är att kunna beställa en bra dealerfilm och se exakt var kortet hamnar.** Första försöket är en giv till plats 4 från vila, via sko och grepp, till ett kort som ligger kvar på bordet. Stol 4 och stol 1 visar samma händelse på samma tidslinje.

Redigeringsvyn och den gemensamma 3D-scenen är genomförda i Next.js, React och TypeScript. JSON-förhandsvisningen stöder Kling 2.5 Turbo Pro, Kling 4, WAN 3 och Grok Imagine Video 1.5 Lite på Runways bild-till-video-endpoint. Verklig beställning är en senare etapp.

## Grundbilder för en sittande dealer

Använd [fotomallen i studion](http://127.0.0.1:4317/fotomall.html). Den visar varje pose med en neutral docka och har separata exempel på handryggar ovanifrån och kortgrepp lågt från sidan.

Som arbetsstandard använder studion fyra foton. SAM 3D Body skattar en kropp per bild. Sidobilden ger en oberoende kontroll av höft, huvud och proportioner när modellen vrids. [SAM 3D Body](https://github.com/facebookresearch/sam-3d-body)

| Foto | Vad som ska synas |
| --- | --- |
| 1. Stående framifrån | Helkropp från huvud till skor, armarna något ut från kroppen. Detta ger silhuett, klädsel och ansikte. |
| 2. Sittande framifrån | Flytta undan bordet. Visa hela sittposen med bäckenet mitt på stolen, axlarna avspända och fötterna på golvet. |
| 3. Sittande i ren sidoprofil | Flytta kameran 90° runt samma sittpose. Håll den i våg på brösthöjd. Visa stol, höft, knän och fötter med fri sikt. |
| 4. Båda handryggarna ovanifrån | Skarpa fingertoppar, naglar och tatueringar med ett spelkort intill för skala. |

För en ny dealer provar vi en serie med elva bilder. Ta stående helfigur, sittande helfigur utan bord och ansiktsporträtt framifrån, i 45° trekvart och i 90° profil. Flytta kameran åt samma håll och behåll posen inom varje serie. Ta sedan båda handryggarna ovanifrån och kortgreppet från tumsidan cirka 20° över filten. Om ryggen ska visas i slutscenen kan en tolfte bild bakifrån ge underlag för håret och kläderna.

För kortgivningen ger några sekunders verkligt utdrag från grepp till släpp underlag för tempo och fingerkontakt. Paulina har redan 01 för helkropp och 03 för utseende. 05 och 05b är genererade sidoprofiler. Den mest värdefulla nya bilden är en fotograferad sidoprofil i neutral sittpose. Tidigare bilder med lutning kan användas för ansikte, kläder och arbetsrörelser.

## Vad 3D-figuren gör

Bygg en egen enkel sittande referensfigur. Den behöver underarm, handled, tumme och pekfinger, ett bord med kända mått, en sko och ett separat kort. Ge kortet ett greppställe, en släppruta och ett mål på bordet. När kortet ligger på bordet ska dess läge vara oberoende av kameran. Visa greppet i båda stolarna och spara referensrutorna för den valda kameran. SAM-kroppen kan ge proportioner. En fungerande fingerrigg och en snygg dealerfilm kräver egna prov.

I den lokala riggen kan du nu böja armbågar, pekfingrar och långfingrar. Det första vänsterhandsutdraget använder samma kortbana för båda kamerorna. För en hel giv till plats 4 återstår överlämning, landning och släpp. Därefter kan ansikte, hår, dräkt och tatueringar jämföras mot identitetsbilderna i båda spelarvyerna. [Riggen i studion](http://127.0.0.1:4317/#modellering) · [Utdragsprovet i studion](http://127.0.0.1:4317/bordsprov/paulina-utdrag.html)

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
