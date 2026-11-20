# Runway för en givning

**Välj modell efter den första felrutan.** En felplacerad landning behöver en tydlig bild av mål och kontakt. En onaturlig handrörelse behöver en rörelsereferens där fingrar, kortkant och släpp går att följa. Detta är labbets provstrategi. Resultatet från en generativ modell behöver mätas i filmen.

För en redan lyckad giv är Aleph 2.0 första sidovinkelprovet. För en ny giv, välj kamera och kontrollera kortets kontakt före beslut om 1080p eller 4K.

För en ny dealers grundbilder finns en egen lokal beställningsvy. Den skapar ståfronten först och använder den i följande vinklar. [Bildpipelinen i studion](http://127.0.0.1:4317/bildpipeline) · [Recept, format och pris för stillbilder](BILDPIPELINE.md)

## Modellval för agenter

Runway publicerar utvecklardokumentationen som Markdown. Börja med agentöversikten. Använd indexet för att hitta den aktuella modellen, slå upp dess endpoint och referensfält i API-kontraktet och hämta kreditpriset från prissidan. Denna läsväg fungerar även i en agent utan Runway Dev-plugin. [Utvecklarportal](https://docs.dev.runwayml.com/) · [Agentöversikt](https://docs.dev.runwayml.com/ai-context.md) · [Dokumentationsindex](https://docs.dev.runwayml.com/llms.txt) · [API-kontrakt](https://docs.dev.runwayml.com/api.md) · [API-priser](https://docs.dev.runwayml.com/guides/pricing/)

För en agent med Runway Dev-plugin ger `runway-dev` stöd för API-integrationen, `runway-dev-models` för modellval och `runway-dev-setup` för projektanslutningen. Dev MCP kan kontrollera vilka modeller och gränser som gäller för det valda utvecklarprojektet. [Officiella skills för Codex, Cursor, Grok Bot och Claude Code](https://docs.dev.runwayml.com/guides/plugin/) · [Dev MCP](https://docs.dev.runwayml.com/guides/mcp/)

Kontrollerat mot Runways publika dokumentation den 19 november 2026. Längden gäller den angivna uppgiften. Modellåtkomst, priser och krav kontrolleras igen i det valda API-projektet före en verklig beställning.

Låt agenten redovisa modell-ID och endpoint, längd, upplösning, varje referensfils roll och tillåtna kombinationer samt uppskattad kostnad för just den begäran. Kontrollera särskilt priset med ingående video. Den lokala studion kan spara nyckelbilder för alla spåren. Bildutkasten stöder Kling 2.5 (5 eller 10 s), Grok Imagine Video 1.5 Lite (1–15 s), WAN 3 (2–30 s) och Kling 4 (3–30 s). Välj mall under Startprompter. De generella mallarna versionshanteras i Git och egna varianter på labbdisken.

| Problem eller underlag | Modell-ID | Längd | Använd referenserna så här |
| --- | --- | --- | --- |
| Äldre lokala utkast och grundrecept | `kling2.5_turbo_pro` | 5 eller 10 s | Startbild och valfri slutbild. Äldre revisioner utan modellfält öppnas med detta kontrakt. [Indata](https://docs.dev.runwayml.com/assets/inputs/) |
| En kort paus eller blinkning | `grok_imagine_1_5_lite` | 1–15 s | En startbild. I labbets bildutkast kostar 720p tre krediter per sekund plus en för bilden. [Pris](https://docs.dev.runwayml.com/guides/pricing/) · [Indata](https://docs.dev.runwayml.com/assets/inputs/) |
| Blick, andning eller en enkel rörelse | `gen4.5` | 2–10 s | Text eller en skarp startbild. Låt fotot ge utseende och komposition. Beskriv händelseordning och kamera i text. [Gen-4.5](https://help.runwayml.com/hc/en-us/articles/46974685288467-Creating-with-Gen-4-5) · [Promptguide](https://help.runwayml.com/hc/en-us/articles/48324313115155-Image-to-Video-Prompting-Guide) |
| Känd början och slutpose | `wan3` | 2–30 s | Använd start och slut som nyckelbilder. Välj separat referensläge om en film eller ett ljud ska styra tagningen. Lägena kan inte kombineras. [Indata](https://docs.dev.runwayml.com/assets/inputs/) |
| Kortet landar fel | `kling_4` | 3–30 s | Välj fullversionen. En startbild, upp till åtta ordnade mellanbilder och valfri slutbild. Prova först redo, filt­kontakt och återgång. `kling_4_flash` tar endast startbild som nyckelbild vid bild-till-video. [Kling-kontrakt](https://docs.dev.runwayml.com/assets/inputs/) |
| Fingrarna öppnas för tidigt eller handen accelererar fel | `seedance2_5` | 4–30 s för generering | Bind dealerns foto till identitet och den egna handfilmen till rörelse och tempo. Referensvideo ska vara minst 480p. Redigering av befintlig video har egna fält. [Indata](https://docs.dev.runwayml.com/assets/inputs/) · [Seedance-promptguide](https://runway.com/resources/seedance-2-5-prompt-guide) |
| En filmad person utför gesten | `act_two` | Upp till 30 s | Prestationsfilm och en stillbild av dealern för styrning av hand- och kroppsgester. Ha händer och ansikte synliga vid start. Minsta debitering är tre sekunder. [Act-Two](https://help.runwayml.com/hc/en-us/articles/42311337895827-Performance-Capture-with-Act-Two) |
| En befintlig film behöver visuell rättning | `aleph2` | Källfilm 2–30 s | Redigera källfilmen. Den får ha högst 30 bilder/s. Jämför också grannrutorna kring rättningen. [Indata](https://docs.dev.runwayml.com/assets/inputs/) · [Modellkatalog](https://docs.dev.runwayml.com/guides/models/) |

### Vad kostar en tagning?

Studions jämförelse omfattar tio utvalda modeller. Den lokala pristabellen och kalkylen ligger i samma källfil. Runways katalog innehåller även `gen4_turbo`, `veo3.1` och `veo3.1_fast`. Veo-priset beror bland annat på om ljud ingår. [Modeller och pris i studion](http://127.0.0.1:4317/#modeller) · [Lokal kalkyl](../studio/lib/runway-prices.ts) · [Runways modellkatalog](https://docs.dev.runwayml.com/guides/models/)

Den 19 november 2026 motsvarar 100 API-krediter 1 USD före eventuell skatt. Kling 4 utan ingående video har listpris 15,7 krediter/s i 720p och 23,5 i 1080p. Kampanjpriserna är 12,56 respektive 18,8 till och med 30 november UTC. Runway avrundar klippets listkostnad uppåt, drar av rabatten och avrundar uppåt igen. Fem sekunder i 720p kostar därför 64 krediter under kampanjen och 79 till listpris. [Runways pris- och avrundningsregler](https://docs.dev.runwayml.com/guides/pricing/)

För dealerns handrörelse påverkar valet av underlag kostnaden. Fem sekunder Seedance 2.5 i 720p kostar 150 krediter med en identitetsbild. Med ytterligare fem sekunder handfilm blir det 225 krediter. För Grok Lite kostar startbilden en extra kredit. Kalkylen behöver även ta hänsyn till modellens minimipris och eventuella tillägg för leveransformat. [Runways priser per referenstyp och format](https://docs.dev.runwayml.com/guides/pricing/)

## Från scen till prompt

### Två kort från samma REDO-bild

Använd samma vilobild som utgångspunkt för varje tagning. Ange kortmål, givhand och när handen återgår till vila. Granska kontakt, släpp och skarv vid uppspelning.

| Prov | Exempel på prompt efter kontroll av utsnittet |
| --- | --- |
| Start, kontakt, slut från stol 4 | *One continuous five-second shot from a fixed camera. The pads of the dealer's left fingers press the back of one card and slide it out of the shoe toward the felt. Her right hand receives the exposed edge close to the table, turns the two of spades face up and places it flat inside the center mark in one sweep. Her right fingers release. The card stays in place as her left hand returns to the next card.* |
| Foto och filmad givning | *Use the portrait for the dealer and clothing. Follow the motion clip for the left fingertips pushing out the card, the low handover and the right hand turning and placing it. Keep the camera fixed on the studio table and hold on the card as the hands return to the chosen end pose.* |

Byt referensnamn mot syntaxen i den valda modellen. Om Seedance-mallen används, ange en tagning på fem sekunder och granska dess omskrivning före sparning. [Runways promptmall](https://d3phaj0sisr2ct.cloudfront.net/site/assets/runway-sd-enhancer-skill.md) · [Runways exempel](https://runway.com/prompts/a-game-of-horse)

## Anslutningar och första verkliga provet

| Väg | Uppgift |
| --- | --- |
| Runway MCP · `mcp.runwayml.com/mcp` | Generering från en agent med Runway-appens krediter. [Appens MCP och krediter](https://help.runwayml.com/hc/en-us/articles/51931843164691-Connecting-to-Runway-MCP) |
| Runway Dev-plugin och Dev MCP · `dev.runwayml.com/mcp` | Modellkontrakt, projekttillgång, pris och diagnostik. Claude Code har en särskild MCP-sökväg. Guiden beskriver även installation för Codex och Cursor samt färdigheten `runway-dev-models`. [Plugin](https://docs.dev.runwayml.com/guides/plugin/) · [Dev MCP](https://docs.dev.runwayml.com/guides/mcp/) |
| Runway API via studion | Servernyckel finns för den lokala anslutningskontrollen. Knappen läser `GET /v1/organization`. Genereringsunderlagen är lokala utkast och visar modellens API-pris. När beställning införs ska skickad revision, jobb-ID och mottaget original bevaras tillsammans. [API](https://docs.dev.runwayml.com/api/) · [Priser](https://docs.dev.runwayml.com/guides/pricing/) |

**När är det läge?** När Jakob sett en trovärdig kontakt från båda stolarna, valt identitetsunderlag och bestämt om kortet ska ligga i filmen eller spelas som ett separat lager. Föreslå då **en** femsekundersgiv från en stol, med referenser, modell, fält och aktuell kostnad synliga. Vänta på Jakobs besked före generering. Granska först i normal hastighet, sedan ruta för ruta. Dokumentera första felrutan och kontrollera kortets ocklusion, skala, släpp och kvarliggande slutläge.
