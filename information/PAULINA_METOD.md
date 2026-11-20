# Paulina från fotografier till en spelbar giv

**En kropp, ett skelett och ett klockslag hör till varje ruta.** Vi kan byta kamera utan att skapa om Paulina eller rörelsen. Denna metod beskriver den faktiska bildserien och giv V4 till plats 4. Den omfattar också två separata ansiktsprov och ett prov där en befintlig film driver V4-kroppen. [Illustrerad metod som PDF](../output/pdf/paulina-foto-till-rorelse.pdf) · [Lokal bildutgåva med Paulina](lokalt/paulina-foto-till-rorelse.pdf)

## Börja med modellen som redan finns

| Jag vill | Öppna i den lokala studion |
| --- | --- |
| Spela den rättade given eller vrida runt en pausad hand | [V4, ruta 73, händer framifrån](http://127.0.0.1:4317/giv-plats-4/v4?kamera=120&ruta=73&vinkel=0&utsnitt=hander) |
| Jämföra en Runway-film med rörelsen och kortet på V4 | [Det upphållna röda kortet i Kling och V4, ruta 0](http://127.0.0.1:4317/giv-plats-4/filmrorelse?ruta=0) |
| Vrida ögonen eller låta huvudet följa blicken | [Paulinas egen vänster, fast spelarkamera](http://127.0.0.1:4317/giv-plats-4/blick?riktning=vanster) |
| Prova det sneda leendet och inspektera materialet | [3D-reglage och MP4](http://127.0.0.1:4317/giv-plats-4/minspel) |

På labbdatorn ligger projektet i `C:\Users\jakem\dev\ultimate-reality`. Den spelbara givfilen är `avatars/paulina/giv-plats-4/v4/rigg/giv.glb`, SHA-256 `3eee4c5579967fca5e7e0fb11a709b486d05f1568af9cdf802a0570fa32da954`. Kroppsytan, hårnätet, skelettet, sex inbäddade texturbilder, rekvisitan och givens animationsklipp följer med filen. Kamerorna skapas av spelaren. De sex texturbilderna kan packas upp byte för byte från V3 och matchar V4. Privat fotounderlag, modellfiler och filmer tillhandahålls av labbdatorn. [Packa upp texturerna](../tools/paulina_textures.py) · [Lagring och Git](UNDERHALL.md)

## 1. Vad vi faktiskt fotograferade och genererade

Två tillförda bilder visar Paulina. **01** visar henne stående framifrån. **03** visar henne sittande bakom bordet och är identitetsreferensen för ansikte och handtatueringar. I avatarens rot finns 16 numrerade PNG-filer. De två originalen och 14 genererade filer ingår i antalet. 05/05b och 10/10b är olika bildrevisioner. 02 och 04 i mappen för friläggningar är bearbetningar av originalen. [Bildkällor och proportioner](PAULINAS_STILLBILDER.md) · [Fotostarten på labbdatorn](../avatars/paulina/fotostart/index.html)

Fas 1 valde **elva grundvyer och en extra rörelsebild**. De tolv rollerna är tre ståvyer, tre sittvyer, tre porträtt, båda handryggarna i en bild, vänster kortdrag och extra höger kortvändning. Åtta filer i denna utgåva har exakt samma bytes som numrerade källbilder. Fyra tillkom för utgåvan. Varje fil har egen källa, bildstorlek och kontrollsumma. För sittprofilen valdes en senare revision på 1 316 synliga bildrader mot frontens 1 340, en höjdskillnad i bilden på −1,79 %. Samma mått på första profilen gav −3,88 %. [Bildutgåvan](../avatars/paulina/fas-1/v1/bildregister.json) · [Sittprofilens mätning](PAULINAS_STILLBILDER.md)

Den nuvarande bildbeställningen tar **1 till 14 original** av samma person. Tre, fyra eller fem ryms i ett utkast. Börja med ståfronten, fortsätt via sittfronten till sittvinklar och via ståfronten till porträtt. Lägg till handbilderna med den valda kortreferensen. Saknad rygg, hårvolym, handflata och fotdjup uppskattas. Täckning och likhet bedöms mot tillförda foton innan en vy väljs. Paulinas äldre referenser är registrerade bildförsök med bland annat ChatGPT och ImageGen. Den senare Runway-beställningsvyn är ett reproducerbart arbetssätt för nya bildserier. [Kodens urvalsgräns](../studio/lib/bildpipeline.ts) · [Bildrecepten och beställningen](BILDPIPELINE.md)

## 2. Från sittvyer till en riggad kropp

1. SAM 3D Body skattar kropp och leder separat ur sittfront, trekvart och vald profil v3. Den sparade körningen heter `sam-20261120T081259Z-50d5daf1f142`. Frontens yta och topologi blir basen. För övre rygg, nacke och huvud vägs mål för hållningen med 20 % trekvart och 80 % profil. Handhöjden justeras mot lårens ytor. Resultatet är 18 439 grundhörn, 36 874 trianglar och 127 MHR-leder. [Riggverktyg](../tools/mhr_seated_rig.py) · [Kroppens lokala kvitto](../avatars/paulina/prov-70/v1/modell/kropp.json)
2. Tre sittvyer, tre porträtt och handryggsbilden gav den första fotoytan sju källbilder. En separat skattning av en genererad bakvy gav projektionen till kavajrygg och bakhår. En genererad handflata kompletterade handens insida. Skornas läder hämtades från den valda sittprofilen. Varje komplettering använder samma kropp. [Fotoytans källor](../avatars/paulina/prov-70/v1/modell/fotoyta/kallor.json) · [Fotoyta och skor](../tools/paulina_trial_surface.py)
3. V2 gav ansikte, handryggar och tatueringar nya passningar mot original 03. V3 använde 23 punktpar i frontbilden, ändrade 4 259 hörn mer än 0,1 mm och målade ansiktet efter ljusmätning i samma kamera. Djupet längs den kamerans siktlinje bevarades. Ögonytan knöts till ögonlederna och håret fick en sluten hjässa. V4 ändrade sex tumleders rotationsspår. I slutfilen använder kropp och hår samma skin. De två meshobjekten har sammanlagt 65 766 trianglar, varav 29 006 i håret. [Ansikte](../tools/paulina_face_fit.py) · [Ögon](../tools/paulina_eye_skin.py) · [Hår](../tools/paulina_original_hair.py) · [Tummar](../tools/paulina_thumb_surface.py)

### Återskapa sittmodellen med den valda profilen

Kör från projektroten. Den tredje filen nedan är den registrerade profilrevisionen. `fas-1/v1/sittande/profil.png` är den äldre bilden. Verktyget kontrollerar alla tre fotografier mot källkörningen innan modellerna läses ihop.

```powershell
$samPy = (Resolve-Path '..\sam-3d-body\.venv\Scripts\python.exe').Path
$fas = (Resolve-Path 'avatars/paulina/fas-1/v1').Path
$front = "$fas/sittande/front.png"
$trekvart = "$fas/sittande/trekvart.png"
$profil = "$fas/granskning/sittprofil-front-v3/profil.png"
$sparad = 'D:/ultimate-reality-lab/saved/sam-20261120T081259Z-50d5daf1f142'
$ny = Join-Path $env:TEMP ('paulina-sittmodell-' + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $ny | Out-Null
& $samPy tools/mhr_seated_rig.py --run $sparad --photos $front $trekvart $profil --model '../sam-3d-body/checkpoints/sam-3d-body-dinov3/assets/mhr_model.pt' --output "$ny/kropp.glb" --report "$ny/kropp.json"
Get-FileHash "$ny/kropp.glb" -Algorithm SHA256
```

Ett ombygge från de tre registrerade fotografierna och den sparade körningen gav byte för byte samma grundkropp, SHA-256 `99d219798241196fc7c6de42704622982f0c066b06fac66ed943e7c936e6ed8c`. För en ny skattning av tre sittvyer körs `.\lab.ps1 sam $front $trekvart $profil`. Välj sedan den nya avslutade SAM-körningen till `--run`. En ändrad vy eller modellvikt ger ett eget versionsunderlag.

### Från de första poserna till giv V2

| Utgåva | Underlag och steg | Kontrollerbar fil |
| --- | --- | --- |
| A1 och A2.3 | Den texturerade sittmodellen får stol, filt, sko och kort. [Ankarverktyget](../tools/paulina_anchor_trial.py) binder vilan och greppet till samma skinnade kropp. | `prov-ankare/v1/rigg/ankare.glb` |
| Giv V1 | [Den första givens rörelse](../tools/paulina_deal_p4.py) är en ny animation av ankarscenen. Den leder kortet fram till mitten av bordet. | `giv-plats-4/v1/rigg/giv.glb` |
| Giv V2 | [Skjutet längs filten](../tools/paulina_sliding_deal.py) ger en väntande högerhand. [Handmaterialet](../tools/paulina_hand_material.py) och [porträttpassningen](../tools/paulina_original_portrait.py) lägger på underlag från original 03. | `giv-plats-4/v2/rigg/giv.glb`, SHA-256 börjar `f2605ffe` |

Sökvägarna i tabellen räknas från `avatars/paulina/`. Tidigare fel, händelseruta och källversion finns i [överlämningen](HANDOFF.md). För det första ytlagret hör [kroppens fotoyta](../tools/paulina_utseende.py), [baksida och handflator](../tools/paulina_trial_surface.py), [skorna](../tools/paulina_trial_boots.py) och [blackjackscenen](../tools/paulina_blackjack_scene.py) till den registrerade kroppens materialkedja.

### Återskapa de passade V3-delarna från registrerad V2

Kör från projektroten med den lokala SAM-miljön, original 03, V2-scenen och dess kvitto tillgängliga. För samma resultat används de registrerade ljusbilderna från V2 i `v3/underlag/ansiktsljus` och från den passade formen i `sammansatt/52f3144d/ljus`. Kodens materialpass verifierar bilderna mot deras kvitton. För en ny kalibrering körs `tools/portrattljus.mjs --narbild <modell.glb> <ny-ljusmapp>` från `studio` med servern på port 4317. I kommandona används V3-kedjans utmappar. När parametrar eller källor byts, använd en ny utgåvemapp.

```powershell
$samPy = (Resolve-Path '..\sam-3d-body\.venv\Scripts\python.exe').Path
$giv = (Resolve-Path 'avatars/paulina/giv-plats-4').Path
$v3 = Join-Path $giv 'v3/underlag'
$steg = Join-Path $v3 'sammansatt/52f3144d'
$node = 'C:/Program Files/Volta/node.exe'

& $samPy tools/paulina_waiting_hand.py
Push-Location studio
& $node -p 'process.version'
Pop-Location
& $samPy tools/paulina_face_fit.py form "$v3/vilohand/kort-till-vilohand/giv.glb" "$steg/form"
& $samPy tools/paulina_face_fit.py foto "$steg/form/giv.glb" "$steg/foto" --lighting "$steg/ljus"
& $samPy tools/paulina_eye_skin.py "$steg/foto/giv.glb" "$steg/ogon"
& $samPy tools/paulina_original_hair.py --source "$steg/ogon/giv.glb" --out-dir "$steg/slut"
Get-FileHash "$steg/slut/giv.glb" -Algorithm SHA256
```

Kontrollsummornas början är `52f3144d` för rörelsen, `8639cc72` för formen, `6c6e9a88` för fotoytan, `9b746545` för ögonvikterna och `e0d5bc34` för slutmodellen. Den registrerade V3-filen och kvittot i `v3/rigg` hör ihop. Utifrån den registrerade versionen återskapar `paulina_thumb_surface.py` V4 i `v4/rigg`. [Den verifierade arbetskedjan](HANDOFF.md)

Med V3 i `v3/rigg` kan samma verktygsmiljö skapa V4 och de två portabla ansiktsproven. Från `studio` behöver kameraverktygen Node-versionen i `package.json`, Edge, FFmpeg och den lokala webbservern på port 4317.

```powershell
& $samPy tools/paulina_thumb_surface.py
& $samPy tools/paulina_face_expression.py --node $node
& $samPy tools/paulina_gaze_trial.py
& $samPy tools/paulina_textures.py
Push-Location studio
& $node tools/filma-plats-4.mjs "$giv/v4/rigg/giv.glb" "$giv/v4/visning"
& $node tools/kontrollera-giv-orbit.mjs v4
& $node tools/filma-minspel.mjs
Pop-Location
```

## 3. Så skapas och kontrolleras givens rörelse

Vila A1 och kortskoposen A2.3 bildar början på rörelsen. Skelettets ledrotationer styr huden. Målpunkter vid kort och filt styr armarnas och fingrarnas passning. Det lösa kortet är ett separat scenobjekt med läge och rotation över tid. V4 består av 155 rutor vid 24 b/s, numrerade 0–154. Kortet mäter 63 × 89 × 0,4 mm. Den gula framsidan är helt gul ända ut till kanten. Allt vitt i kortskon hör till korten bakom.

| Händelse i V4 | Ruta | Mätning |
| --- | ---: | --- |
| Kortet ligger plant | 77 | Alla fyra hörn följs mot filten |
| Vänstern för kortet till vilande höger | 78 | Pekfingers hud ligger 0,56 mm från kortytan |
| Högern börjar följa med | 83 | Vänstern har flyttat kortet ytterligare 21,95 mm sedan ruta 78 |
| Högern släpper | 105 | Kortet glider ytterligare 12,41 cm |
| Slutläge på plats 4 | 122 | Kortet ligger still till slutet av given |

I V3 vek vänstertummen över sin egen handrygg i ruta 73 och höger tumhud trängde in i sin hand senare under skjutet. V4 kontrollerades genom alla 155 rutor mot egen hand, andra fingrar, kort, sko och filt. Den oberoende kontrollen fann noll korsningar mellan distala tumhuden och den egna handytan på båda sidor. Fram till ruta 82 färdades höger tumme sammanlagt 0,0011 mm. Gångna avstånd och en kontakts tolerans är olika mätetal. [Tre bildversioner av tummarna](http://127.0.0.1:4317/giv-plats-4/v4/tummar.jpg) · [Kontroll av animerad hud](../tools/paulina_thumb_surface.py)

## 4. Film till kropp, och kropp till Runway

**SAM-dashboarden.** Den ligger i `C:\Users\jakem\dev\sam-3d-body\jakob-start`. Starta `START.bat` där, eller kör `..\.venv\Scripts\python.exe app.py` från samma mapp. Bildfliken skattar en person ur en bild. Videofliken läser ett klipp och levererar en överlagrad film, rörelsedata och en statisk GLB från en vald ruta och person. För att animera V4, välj en film med en person och spåra hela klippet med rutsteg 1. Använd den fulla `rorelse.json` och originalfilmen i V4-importören. Gradio väljer personen och mäter pose. Dealerstudion använder Paulinas GLB som mål. [Öppna SAM-dashboarden](http://127.0.0.1:7860) · [V4-importören](../tools/paulina_film_motion.py)

Den kompakta dashboard-NPZ-filen lagrar 70 ledpunkter, medan JSON-exporten dessutom innehåller hand-, kropps- och skalparametrar. Importören återskapar 204 MHR-modellparametrar per bildruta med Metas hand- och skalbaser. I dashboardens 97-rutorsprov gav jämförelsen mot de 127 sparade ledpositionerna mindre än 0,00025 mm största skillnad. Hela klippet gav en animerad V4-GLB med SHA-256 som börjar `ac209346`. MP4-originalets SHA-256 börjar `56d7186d` och JSON-exportens `478a2a85`. Det här är en kontroll av samma modellutdata. Figurens verkliga djup, fingrarnas läge bakom ett kort och hudens kontakt med bordet måste fortfarande bedömas mot bilder eller ett extra kameraperspektiv.

```powershell
$spar = 'C:/Users/jakem/dev/sam-3d-body/jakob-start/output/2026-11-20_082434_video/rorelse.json'
$film = (Get-Content -LiteralPath $spar -Raw | ConvertFrom-Json).source
$ut = Join-Path $env:TEMP ('paulina-film-' + [Guid]::NewGuid())
& $samPy tools/paulina_film_motion.py --video $film --dashboard-json $spar --out-dir $ut
```

Välj din egen versionsmapp till `$spar`. Spara filmoriginalet tillsammans med motsvarande rörelse-JSON. Om Gradio har gallrat den refererade originalfilen kan importören läsa ett äldre källkvitto med båda kontrollsummorna via `--source-register`. Spela den exporterade `filmrorelse.glb` i en glTF-spelare. Studions registrerade filmprov har en egen inbyggd webbsida.

### Jakobs ZIP från den längre kasinofilmen

Jakob beskriver filmposen som halvstående. Bordet skymmer höfter, knän och fötter i kasinobilden. Underkroppen i dashboardens GLB är därför SAM:s uppskattning. Dansprovets ståfoto visar hela Paulina och är en separat källa.

Skrivbordsfilen `2026-11-20_135617_video.zip` har SHA-256 `a20d587f247a9ef5e75c52790605ed1d090979207b262d5e06044de21737ee63`. Alla elva poster matchar dashboardens sparade körning. Filmoriginalet `mera.mp4` har **2 983 rutor**, 1 464 × 790 bildpunkter, 30 b/s och en längd på 99,43 s. Originalets sökväg återfanns i JSON-exporten och filmbytesen kontrollerades separat. Råfilens SHA-256 börjar `ecb548dc`.

| Fil i exporten | Vad den berättar |
| --- | --- |
| `meshes/ruta000000_person00.glb` | Ytan för en person i första rutan, med 18 439 hörn och 36 874 trianglar. GLB:n har noll skin och noll animationsklipp. |
| `rorelse.json` | 40 uppskattade poser, en person i varje vald ruta. Rutsteg 5 vid 30 b/s ger sex analyserade poser per sekund. Första källtiden är 0,000 s och sista är 6,500 s. |
| `rorelse.npz` och `overlay.mp4` | Ett kompakt numeriskt utdrag och en visuell överlagring av SAM:s tolkning. Överlagringen är exporterad med 6 b/s. |

Spelarens tidslinje omfattar källrutor 0–195. **40 poser** har underlag från exakt de analyserade källrutorna. **156 mellanrutor** visar interpolering på V4-riggen. I visaren betyder *mätt* att SAM analyserade just den källbilden. Handens startläge passas därefter mot V4:s sko och filt. Den sista visade posen har underlag från ruta 195. De övriga 2 787 källrutorna hör till filmoriginalet. [Jämför Jakobs film med den animerade riggen](http://127.0.0.1:4317/giv-plats-4/dashboardklipp?ruta=0)

Kasinobordet skymmer benen i källfilmen. V4 har sin egen sittställning, filt och kortsko. I källruta 0 möter vänster tumme och pekfinger det gula kortet vid skon. På V4 ligger samma fingers hud cirka 12,8 respektive 15,9 mm från kortet. Där syns handens rörelse mot skon, men det fotograferade nypet återstår att passa. Det blå kortet vid handen i exempelvis källruta 70 har ingen bana i SAM:s personspår. Ett separat kortspår behövs för en spelbar giv med just den rekvisitan.

Den spelbara GLB:n har SHA-256 `da46ad2b0830409cd802ae337e2736a0d48660510ba3cc60a03d37a51dbc4bcd`. Handhudens hörn går fria från bord och skoföremål i alla 196 kontroller. Tummarna går fria från den egna handen. Vänster lång- och ringfinger korsas i ruta 35. Övriga 195 poser klarade fingerkontrollen. [Spela vid det synliga kortet i källruta 70](http://127.0.0.1:4317/giv-plats-4/dashboardklipp?ruta=70) · [Hela rörelsekvittot](http://127.0.0.1:4317/giv-plats-4/dashboardklipp/v1/rorelsematning.json)

Åt andra hållet kan V4:s animation renderas till en film som dashboarden kan analysera, eller till ett startankare för Runway. För att animera själva grå GLB:n från ZIP krävs först ett skelett och hudvikter som binder ytan till lederna. De hör till Paulina V4 och saknas i den exporterade enrutemodellen.

Den här körningen använder källfilmen som JSON-exporten pekar på. Spara ZIP:en tillsammans med det kontrollerade MP4-originalet så att båda går att hitta efter att Gradio har rensat sin arbetsyta. Den registrerade källkopian på labbdatorn ligger i `dashboardklipp/v1/kalla/original.mp4`.

```powershell
$zip = Join-Path ([Environment]::GetFolderPath('Desktop')) '2026-11-20_135617_video.zip'
$utgava = 'avatars/paulina/giv-plats-4/dashboardklipp/v1'
& $samPy tools/paulina_dashboard_clip.py --source $zip --out-dir $utgava --start-anchors shoe-left-table-right
Push-Location studio
& $node tools/filma-dashboardklipp.mjs
Pop-Location
```

För ett annat klipp finns läget `absolute`, där startposen kommer från filmspåret. Startankarna till sko och filt valdes för just Jakobs film. Det andra kommandot renderar riggen i studions frontkamera till en vanlig MP4 i 1 280 × 720 vid 30 b/s. Filmens sista bildruta har tidsstämpeln 6,500 s. [Importören för dashboard-ZIP och glesa rutor](../tools/paulina_dashboard_clip.py) · [SAM:s statiska förstaruta](http://127.0.0.1:4317/giv-plats-4/dashboardklipp/v1/sam-ruta-000.glb) · [SAM:s överlagring](http://127.0.0.1:4317/giv-plats-4/dashboardklipp/v1/overlay.mp4) · [Spela V4:s renderade rörelse som MP4](http://127.0.0.1:4317/giv-plats-4/dashboardklipp/v1/v4-front.mp4)

Om Gradio har rensat sin cache, använd `--video "$utgava/kalla/original.mp4" --source-register "$utgava/kalla/kallregister.json"` och ange en ny `--out-dir`. Då beskriver det nya mätkvittot hur de sparade film- och JSON-kontrollsummorna verifierades.

**Film till rörelse.** Kling 4-filmen som beställdes via Runway innehåller 121 bildrutor vid 24 b/s. Den sparade filmen har SHA-256 som börjar `9e05f279`. För varje avkodad ruta registrerar `sam_video_motion.py` en person, källtid, kamerauppgifter, ledpunkter och fulla MHR-parametrar. Den registrerade filmrekonstruktionen `60744fff` driver överkropp och fingrar och har ett eget rött kort. V4 och källriggen har identiska lednamn, föräldrar och bindmatriser för alla 127 leder. [SAM-spårning per bildruta](../tools/sam_video_motion.py) · [Filmens pose, grepp och kort](../tools/paulina_motion_trial.py)

**Rörelse relativt V4:s vila.** Filmöverföring v1 tillämpar ledrotationernas förändring från första källrutan på V4:s befintliga sittpose. Bäcken och fötter behåller sittstödet. Bordets filt begränsar för låga handlägen. Höger handled korrigerades som mest 190,87 mm och fingrarna begränsades i 116 av 121 rutor. V1 startar därför med händerna vid filten och lämnar filmens hållna föremål utanför klippet. Den här historiska GLB:n är `086e8b39`. Samma metod kan användas för en ny dashboardfilm vars rörelse ska starta i figurens egen vilopose. [Relativ V4-överföring](../tools/paulina_film_motion.py) · [Kvittot för v1](http://127.0.0.1:4317/giv-plats-4/filmrorelse/v1/rorelsematning.json)

**Filmens startgrepp och röda kort på V4.** I Kling håller Paulina redan ett upprätt rött kort i sin egen högerhand i ruta 0. Filmöverföring v2 utgår från filmens absoluta arm-, hand- och fingerpose. Kortet är ett animerat föremål med egna hörn, lägen och rotationer. V4-bordets filt ligger 46,53 mm högre än filten i filmrekonstruktionen. Kortets bana och greppet anpassas tillsammans fram till landningen. I ruta 42 är armen utsträckt, i ruta 62 ligger kortet plant och i ruta 73 släpper hon. Det röda kortet ligger kvar när handen dras tillbaka. Det gula kortet syns i skon och har en helt gul framsida. [Jämför det verkliga startgreppet](http://127.0.0.1:4317/giv-plats-4/filmrorelse?ruta=0) · [Kontrollera släppet](http://127.0.0.1:4317/giv-plats-4/filmrorelse?ruta=73) · [V2-verktyget](../tools/paulina_film_card.py)

```powershell
& $samPy tools/paulina_film_motion.py
& $samPy tools/paulina_film_card.py
Push-Location studio
& $node tools/granska-filmrorelse.mjs
Pop-Location
```

Det första kommandot återskapar v1 från det låsta Kling-klippet. Det andra bygger dess filmgrepp på V4 som en egen v2. Det sista sparar fem bildpar och kvitton från den lokala spelaren. Ett nytt klipp med ett föremål i handen behöver sitt eget spår för det föremålet, dess skala och kontakthändelser.

| Kontroll av det röda kortet | Resultat i v2 |
| --- | --- |
| Ruta 0, nypet | Kortytan lutar 68,71° mot filten. Avståndet från tumhuden är 0,044 mm och från pekfingret 0,000 mm vid den sparade precisionen. Hand och kort har flyttats tillsammans 32 mm uppåt för frigång mot V4-bordet. |
| Ruta 42 och 70, fortsatt grepp | I ruta 42 ligger tumme och pekfinger 0,350 och 0,000 mm från kortet. I ruta 70 ligger pek- och långfinger 0,521 och 0,691 mm från det. |
| Ruta 73, släpp | Pek- och långfinger har 9,34 och 10,21 mm avstånd. I rutor 62–120 stöds alla fyra hörn inom 0,06 mm från filten. |
| Fotokanten på den röda baksidan | Papperets ljusa kant avgränsades i den verkliga källfilmens ruta 0. Ett hörn som skymdes av fingret fylldes från motsvarande synliga pappershörn. |

Under hela greppfasen, ruta 0–55, var det största tumgapet 0,563 mm och pekfingrets största gap 0,069 mm. Två byggen gav samma GLB, SHA-256 `ac3cf5cb6db3026903e3d0de241985e564a1281ef8f6066e548fffa1092710d2`, och samma mätkvitto. [V2-riggens fullständiga mätkvitto](http://127.0.0.1:4317/giv-plats-4/filmrorelse/v2/rorelsematning.json) · [Spara tidsmatchade bildpar från spelaren](../studio/tools/granska-filmrorelse.mjs)

**Från kropp till film.** Ställ in pose, ruta, kamera och utsnitt i studion. Rendera en stillbild som startankare och vid behov ett slutankare. Lägg in bilderna i studions versionssparade beställning och skicka den valda revisionen. Fyra registrerade Grok- och Kling-prov visar den riktningen. Två prov använde samma A2.3-pose och text från front respektive +70°. Grepp och släpp skilde sig i de genererade filmerna. För exakt samma kortbana från alla håll kan kamerorna rendera den lokala 3D-animationen direkt. [De fyra leverantörsproven](ANKARPROV_V1.md) · [Modell- och promptguide](RUNWAY_DEALER.md)

### Dansprovet med ett foto och en rörelsefilm

Original 01 visar Paulina i helfigur. Beskär originalets 1 083 × 1 452 px till 810 × 1 440 px från x = 136, y = 6. Båda skorna ligger innanför utsnittet. Den lokala PNG-filen har SHA-256 `426096cc010cb0d54b23976a788481f0c7ec58a5d9cdba35a1edbf87573eab37`. På kasinofilmens första ruta skymmer bordet benen. [Ståfotot i labbstudion](http://127.0.0.1:4317/rorelseprov-dans/v1/paulina.png)

SAM skattar utgångsposen från original 01. Kroppsverktyget ställer Paulinas V4-rigg i den posen och animerar sidosteg, armsvängar, knäböj och ett tvåfotahopp. Ögonlocksverktyget använder två av MHR-modellens ansiktsformer. En fast frontkamera filmar 96 rutor vid 24 b/s i 720 × 1 280 px. [Kroppens koreografi](../tools/paulina_dance_motion.py) · [Ögonlockens rörelse](../tools/paulina_dance_blink.py) · [Kameran och MP4-exporten](../studio/tools/filma-rorelseprov-dans.mjs)

Följande kommandon utgår från projektroten med labbstudion igång. Ståspåret har SHA-256 `370e908d…`. Första kommandot med Python verifierar en befintlig fil eller beräknar den från fotot med de lokala SAM-vikterna. [Exportera ståposen](../tools/paulina_standing_track.py)

```powershell
$dansPython = (Resolve-Path '..\sam-3d-body\.venv\Scripts\python.exe').Path
& $dansPython -B tools/paulina_standing_track.py --device cpu
& $dansPython -B tools/paulina_dance_motion.py
& $dansPython -B tools/paulina_dance_blink.py
Push-Location studio
try { node tools/filma-rorelseprov-dans.mjs } finally { Pop-Location }
```

I beställningsvyn sparas fotot, den renderade rörelsefilmen och instruktionen i en egen revision. Kling 4 får foto i `promptImage` och MP4 i `referenceVideos`. Resultatet är en ny 2D-film. Studions jämförelse visar båda filmerna på samma tidslinje, och ett bildblad tar åtta prover utifrån respektive fils faktiska bildtider. [Beställningsvyn](http://127.0.0.1:4317/rorelseprov-dans/bestallning) · [Dansprovet](http://127.0.0.1:4317/rorelseprov-dans) · [Tidsmatchade bildpar](../tools/compare_paulina_dance.py)

Kling levererade 97 rutor vid 24 b/s i 1 080 × 1 920 px från beställningsversion 1. Både rigg och Kling flyttar sig åt höger i bilden och når hopptoppen i ruta 64. I ruta 68 har båda landat. Riggens ögonlock möts i ruta 12–13. I fotofilmen är ögonen delvis öppna och Paulinas vänstra hand samt hjässan hamnar delvis utanför bilden under hoppet. [Jämför rörelsen vid åtta tider](http://127.0.0.1:4317/rorelseprov-dans/v1/samma-tid.jpg) · [Studera ögonlocken i samma rutor](http://127.0.0.1:4317/rorelseprov-dans/v1/blinkning.jpg)

## 5. Vad de 120 kameravinklarna gör

`0°, 3°, …, 357°` ger 120 valbara positioner runt samma scen. Varje gång spelaren vrids används samma GLB, samma animation och samma tid. Helbilden har radie 1,62 m. Frontkameran står 1,40 m över golvet. Vid minst 70° från fronten är höjden 1,792 m. Hand- och ansiktsnärbilderna har egna kameraavstånd och siktpunkter. En separat modellvisare ger kontinuerlig orbit och zoom. I givspelaren väljer drag, pilar och reglage ett av de 120 lägena.

Ankarprovet gav 240 stillbilder, två poser gånger 120. För V4 exporteras en frontfilm vid exakt 0°, en sidofilm vid exakt +70° och en jämförelsefilm med båda. Närmaste valbara webbvinkel till +70° är +69°. I ruta 92 syntes kortet i 108 av 120 helbilder och 113 av 120 handnärbilder. Kortet eller kontakten kan skymmas bakom arm, huvud eller sko. [Kameraformeln](../studio/app/giv-plats-4/orbit-cameras.mjs) · [Kamerakontrollen](../studio/tools/kontrollera-giv-orbit.mjs)

I filmgrepp v2 provades det upphållna **röda kortet i ruta 0** i samma 120 lägen. Minst en bildpunkt av kortobjektet syntes i 109 helbilder respektive 106 handnärbilder. Rakt bakifrån skymdes hela kortet. Framifrån täckte det 1 959 bildpunkter i helbild vid 1 280 × 720. Antalen mäter synlighet och omfattar också papperskanten. [Lokalt kvitto för startgreppets 120 vinklar](../avatars/paulina/giv-plats-4/filmrorelse/v2/granskning/120-startgrepp.json)

## 6. Så styrs ansikte och blick

Givens två ögonleder påverkar 85 respektive 102 punkter i ögonytan. Käkleden har 1 693 viktade hudpunkter men står still i given. Det separata leendet är ett namngivet glTF-morfmål som flyttar 2 864 hörnpunkter. Vikterna går från 0 till 1, ligger kvar och återgår till 0 vid tiderna 0, 1, 1,5 och 2,5 s. Höger mungipa höjs 11,2 mm och vänster bryn 8,4 mm. Att mun, haka eller bryn har många hörnpunkter säger hur detaljerad ytan är. För att kunna beställa ett nytt uttryck behövs också specificerade förflyttningar eller ansiktsleder som driver dessa punkter. [Morfmålets beräkning](../studio/app/giv-plats-4/face-expression.mjs) · [Portabelt minspel](../tools/paulina_face_expression.py)

Blickprovet startar i V4:s sittande vila. Valen avser **Paulinas egna sidor**. Med huvudet låst roteras ögonlederna ±24°. Rörelsen i irisbilden är subtil, cirka 1,3–1,5 bildpunkter i den testade 1 204 × 604 stora frontvyn. När huvudet får följa med roteras det ±23° och ögonen ytterligare ±11° relativt huvudet. Frontkameran är fast genom jämförelsen. [Blickverktyget](../tools/paulina_gaze_trial.py)

**72 ansiktsreglage i grundmodellen.** Vi höll Paulinas form och pose fasta i lokala `mhr_model.pt` och ökade varje uttryckskoefficient en i taget från 0 till 1. Alla 72 formade huden. Skelettet stod still i alla 72 prov. För den första koefficienten flyttades 1 373 av 18 439 grundhörn mer än 0,01 mm, som mest 11,47 mm. I varje prov gick 100 % av de berörda hörnen att hitta via V4-ytans källindex `_SAM_INDEX`. Den lokala bildestimatorn nollställer ansiktsuttryck och käkrotation vid bildskattning. Giv V4 innehåller ännu inget av de 72 morfmålen. För fler synliga miner behöver förflyttningarna omvandlas till V4:s bindkoordinater och exporteras som namngivna mål. Käköppning, tänder, tunga och fonemer behöver därefter inspekteras på de faktiska ytorna. [Lokalt kvitto för alla uttryck](../avatars/paulina/giv-plats-4/v3/granskning/minspel/mhr72-kontroll-v4.json) · [Metas MHR](https://github.com/facebookresearch/MHR)

## Metodens plats bland tidigare arbeten

**Vad modellen tillför en blackjackfilm.** En spelare kan byta stol mitt i given och fortfarande se samma kort, hand och klockslag. Vi kan också höja eller sänka spelarkameran, upprepa en handrörelse och granska om huden träffar filten. I en fast 2D-tagning kommer kameravinkeln och de synliga detaljerna från den inspelningen. För att visa att V4 når samma visuella kvalitet som en filmad dealer behövs en verklig referenstagning vid samma ljus, bildvinkel, avstånd och händelserutor. Nuvarande prov visar fungerande rörelse och geometrisk kontroll. Hårdjup, en skymd handflata och filmens rörelser i djupled är delvis skattade. [Fotot och V3 i porträtt](http://127.0.0.1:4317/giv-plats-4/v3/ansikte-original.jpg) · [Filmjämförelsen i studion](http://127.0.0.1:4317/giv-plats-4/filmrorelse?ruta=0)

SiTH beskriver hur en texturerad människomodell kan rekonstrueras från en enda bild. HumanNeRF beskriver hur en rörlig person kan betraktas från nya kameravinklar utifrån en monokulär film. Vår dokumenterade tillämpning är den sittande blackjackgivaren, samma bestämda kortbana och mätbar handkontakt genom 155 rutor samt kontroller från 120 namngivna vinklar. Underlaget räcker för att beskriva kombinationen och upprepa kontrollerna. Global ensamhet för den kombinationen är obelagd. [SiTH, ETH Zürich och CVPR 2024](https://ait.ethz.ch/sith) · [HumanNeRF, CVPR 2022](https://grail.cs.washington.edu/projects/humannerf/) · [SAM 3D Body, Meta](https://github.com/facebookresearch/sam-3d-body)

### Bygg om PDF-utgåvorna

Använd Python med ReportLab och Pillow. Den öppna utgåvan läser de spårade trädockorna från `studio/public/fotomall/docka`. Utgåvan med Paulina hämtar original, modellvyer och de lokalt verifierade filmrutorna. Den sparas under `information/lokalt` på labbdatorn. Sidhänvisningar och figurer byggs i samma [PDF-verktyg](../tools/paulina_method_pdf.py).

```powershell
& 'C:/Program Files/Python313/python.exe' tools/paulina_method_pdf.py
& 'C:/Program Files/Python313/python.exe' tools/paulina_method_pdf.py --local
```
