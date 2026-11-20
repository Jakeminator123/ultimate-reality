# Ultimate Reality

Ett fristående lokalt labb för att göra dealerfilmer där handen släpper rätt kort på rätt plats, sett från flera stolar. Jakob ska kunna redigera och granska både underlaget till Runway och resultatet. Scoutgaming är den framtida mottagaren.

## Börja här

1. Öppna Paulinas fotostart. Där finns original 01 och 03, de valda sittvyerna, porträtten och handbilderna. [Fotostarten på labbdatorn](avatars/paulina/fotostart/index.html) · [De tolv vyerna i studion](http://127.0.0.1:4317/bildstandard#utgavekontroll)
2. Öppna Paulinas rörelseprov. Samma sittande kropp och blackjackbord kan ses framifrån eller från 70°. Filmoriginal, friläggning och kamerajämförelse hör till samma lokala provversion. [Rörelseprovet](http://127.0.0.1:4317/prov-70/v1) · [Från film till 3D](information/FRAN_FILM_TILL_3D.txt) · [Sittprofilens bildmått](http://127.0.0.1:4317/bildstandard/sittprofil)
3. Välj vila eller händer vid kortskon och rotera samma Paulina genom 120 kameravinklar. Fyra filmprov visar hur Grok och Kling använder ankarbilderna. [Kameravisaren](http://127.0.0.1:4317/prov-ankare/v1) · [Filmer och mätningar](information/ANKARPROV_V1.md)
4. Spela given till mittplatsen eller stanna på en ruta och vrid runt Paulina i 120 lägen med 3° mellan varje. I V4 ligger vänstertummen längs handen när kortet dras. Högerhanden vilar tills den tar emot kortet. Frontfilmen och kontrollfilmen från +70° har samma tidslinje som 3D-visaren. [Aktuell giv](http://127.0.0.1:4317/giv-plats-4/v4) · [Tummarna jämfört med V3 och originalet](http://127.0.0.1:4317/giv-plats-4/v4/tummar.jpg)
5. Prova Paulinas sneda leende och låt henne titta åt sin egen vänster eller höger. Välj enbart ögon eller huvud och ögon i den fasta spelarkameran. [Minspel och material](http://127.0.0.1:4317/giv-plats-4/minspel) · [Blickprovet](http://127.0.0.1:4317/giv-plats-4/blick)
6. Spela Kling-filmens startgrepp eller Jakobs egen dashboardfilm bredvid V4. I dashboardprovet ser du exakt vilka rutor SAM analyserade. Metoden beskriver hur du överför rörelser från egna klipp och renderar en ny kameravy från 3D. [Kling-film till V4](http://127.0.0.1:4317/giv-plats-4/filmrorelse?ruta=0) · [Dashboardfilmen på V4](http://127.0.0.1:4317/giv-plats-4/dashboardklipp?ruta=0) · [Arbetsgång och kommandon](information/PAULINA_METOD.md) · [Illustrerad PDF](output/pdf/paulina-foto-till-rorelse.pdf) · [Bildutgåvan med Paulina i labbstudion](http://127.0.0.1:4317/giv-plats-4/metod/bildutgava.pdf)
7. Följ överlämningen för nästa uppgift. Egna grundbilder hör hemma i `avatars/<namn>/` eller i labbets `inputs`. [Aktuell överlämning](information/HANDOFF.md) · [Studioplan](studio/PLAN.md) · [Agentinstruktioner](AGENTS.md)

Äldre Paulina-modeller, tagningar och filmprov finns i det återställbara arkivet från den 20 november 2026. Det nya provet har en egen kropp, stol, bord och kort i `avatars/paulina/prov-70/v1/`. [Versioner och arbetsytor](information/STUDIOSTRUKTUR.md) · [Arkiv och återställning](information/HANDOFF.md#arkivet-från-20-november-2026)

## Redigerbar dealerstudio

Öppna [Startprompter](http://127.0.0.1:4317/#promptmallar) för labbets sju recept eller dina egna sparade varianter. Välj ett klipp, redigera texten och använd den i filmutkastet. **Spara egen mall** lagrar namn, text, modell och längd på labbdisken.

Starta från projektroten på Windows. Node är pinnad via Volta i `studio/package.json`.

```powershell
.\lab.ps1 list
cd studio
npm ci
npm run dev
```

- Under **Beställningsutkast** kan du byta startbild, lägga till en slutbild, ändra prompt, välja bildmodell och ange en längd som modellen stöder. **Beskär** ändrar JPEG-bilden i monitorn och i beställningsutkastet.
- Under [Modeller och pris](http://127.0.0.1:4317/#modeller) kan du filtrera tio modeller efter klipplängd och jämföra dem, räkna API-pris i krediter och USD och se uppmätta format och gröna bakgrunder från tidigare tagningar. Beställningsutkastet visar sitt eget pris och behåller sina inställningar när du provar kalkylen.
- Filmgranskningen visar den öppnade filens bildmått, genomsnittliga fps, behållare, kodek, pixelformat och videobitrate när dessa uppgifter finns.
- Under **Runway-anrop** finns endpoint, headers och JSON. Kryssa i **Visa fullständiga bilddata**, kopiera eller hämta filen för att se de riktiga bildbytesen. Förhandsvisningen följer vald bildmodell. Grok Lite tar en startbild, Kling 2.5, Kling 4 och WAN 3 stöder även en slutbild. [Runways bild- och videoparametrar](https://docs.dev.runwayml.com/assets/inputs/)
- Under **Filmgranskning** väljer du en egen film från inkorgen eller importerar från datorn. Stega mellan filmens uppmätta bildtider, sätt in- och utpunkt och lägg en kommentar på en bildruta. Utsnitt och kommentarer sparas som metadata. Filmens originalbytes bevaras. Bildrutetider kräver `ffprobe` i PATH och uppspelning kräver en videokodning som webbläsaren kan visa.
- **Spara version** bevarar det exakta underlaget, referensbilderna efter beskärning och granskningsnoteringarna i `orders/giv-plats-4/vN.json` på labbdisken. Nästa öppning visar senaste versionen. Äldre versioner finns i versionsväljaren.
- **Runway API · anslutning** visar om servernyckeln finns. **Testa API-anslutning** läser åtkomsten. **Skicka version N till Runway** beställer den valda sparade versionen och visar det uppskattade priset. **Hämta jobbstatus** följer jobbet och läser in originalfilen med bildtider och kontrollsumma. [Filmbeställningen](http://127.0.0.1:4317/#film) · [Lagring av jobb och filmoriginal](information/RUNWAY_DEALER.md#anslutningar-och-filmorder)
- För Runway-anslutningen, lägg `RUNWAYML_API_SECRET` i `studio/.env.local`. Studion läser nyckeln på serversidan. Projektets filer ligger på den lokala labbdisken. En eventuell framtida Blob-butik ska tillhöra Ultimate Reality. För verifiering, kör `npm run build` följt av `npm test` från `studio`.

## 3D-modellering på labbdatorn

Under **Modellens underlag** ser du vilka bildoriginal som gav kroppen och fotoytan, SAM:s bildmått och vilka filmrutor som hör till den valda modellen. Sidan och rapporten läser samma versionsbundna filer. [3D-modellering](http://127.0.0.1:4317/#modellering) · [Standard för bilder, modeller och filmer](information/MATERIALVERSIONER.md)

I [Runways bildpipeline](http://127.0.0.1:4317/bildpipeline) kan du lägga in exempelvis fyra blandade foton och skapa en ny stående helfigur av personen. Spara ett lokalt utkast och välj ståfronten eller hela serien i den synliga beställningsvyn. Där finns exakt prompt, bildordning, referenser, upplösning och beräknat pris för varje steg. [Pipelineplan med bildberoenden](information/BILDPIPELINE.md)

[Bildstandarden för en dealer](http://127.0.0.1:4317/bildstandard) visar elva grundvyer och en extra kortvändning. Varje vy har en kopierbar prompt för egna foton och ett granskat exempel från Paulina. Hämta Paulinas ifyllda mall eller en tom mall för nästa avatars bildmått, observationer och osäkerheter. Båda använder samma JSON-format.

Startsidan öppnar Paulinas bildserie. En framtida registrerad modell kan visas som kroppsform, fotoutseende eller rigg. De genererade sittbilderna mäter 1 340 px mellan hjässa och sula i front och trekvart, 1 288 px i den ursprungliga profilen och 1 316 px i den valda profilen. [Dealerval](http://127.0.0.1:4317/) · [Tre sittvyer](http://127.0.0.1:4317/bildstandard/sitthojd) · [Vald profil](http://127.0.0.1:4317/bildstandard/sittprofil)

## Gemensam 3D-scen

Scenen gör det möjligt att se samma kropp, fingrar och kort från flera spelarplatser. I rörelseprov v1 följer två kameror en ny kropp riggad med MHR. Den tidigare tvåkortsgiven använde en v4-kropp och två rörelseklipp efter varandra och går att återställa från arkivet. [Rörelseprov v1](http://127.0.0.1:4317/prov-70/v1) · [Paulinas tidigare prov](information/PAULINAS_PROV.md)

I [det tomma bordsprovet](http://127.0.0.1:4317/bordsprov/rumsprov.html?dealer=0) kan du växla mellan stol 4 och stol 1 samt mellan 108 och 96 cm ytterdjup. [Den äldre dockmallen](http://127.0.0.1:4317/ovrigt/fotomall) kan sparas som fristående HTML. Lägg egna dokument eller referenser för chattarna i [jakob-random](jakob-random/).

### Provdockan i Övrigt

Övrigt innehåller mätverktyget **Provdocka · grepp och landning**. Figuren byggs av enkla former. **Stol 4** och **Stol 1** visar samma pose och kort vid samma bildruta. Justera högerhandens grepp längs kortkanten, extra glapp och lutning. Flytta målet med **Sidled** och **Djup**, eller välj **Placera direkt i bild** och dra på filten. **Handdetalj** förstorar kontakten från båda stolarna. Tumme visas i orange och pekfinger i blått. [Övrigt](http://127.0.0.1:4317/ovrigt) · [Öppna provdockan](http://127.0.0.1:4317/?vy=webview#scen)

**Kontakt** visar kortkanten på filten, **Släpp** inleder fingrarnas frigöring och **Slut** visar kortet kvar när handen har återgått. Givningen är fem sekunder med 24 bilder/s. **Spara version** lagrar sceninställningarna med utkastet. **Spara bildpar** lägger två PNG-filer i inkorgen för vidare granskning eller manuellt val i filmutkastet. [Modeller, referensmaterial och promptförslag](information/RUNWAY_DEALER.md)

Figuren, måtten och stolkamerorna är labbets egna referenser. Kortet följer en styrd bana även när du öppnar ett avsiktligt glapp. Bedöm fingerkontakt visuellt från båda stolarna. Rörelsen beräknas kinematiskt och har ingen simulering av friktion eller greppkraft.

## Första SAM-provet

Kör `.\lab.ps1 list` i PowerShell från projektmappen för att se labbets inkorg. Lägg ett eget foto där och använd dess faktiska filnamn. För ett kroppsprov behöver huvud, händer och fötter synas. Ett kommando kan även ta flera bilder.

```powershell
.\lab.ps1 sam 'D:\ultimate-reality-lab\inputs\dealerfoto.png'
.\lab.ps1 list
.\lab.ps1 view <körnings-id>
.\lab.ps1 keep <körnings-id>
```

Ersätt `<körnings-id>` med namnet från `list`. Öppna HTML-filen som `view` skriver ut. Dra för att vrida och använd mushjulet för att zooma. Visaren innehåller både modellen och Three.js och fungerar som lokal fil.

| Fil | Användning |
| --- | --- |
| PNG | Jämför fotot, modellen ovanpå fotot och kroppen vriden 45°. |
| OBJ | Inspektera kroppens triangelyta i exempelvis Blender. Kameraförskjutningen ligger separat i NPZ. |
| NPZ | Pose, fingrar, kroppsform, kameratal, råa hörn, trianglar och bildmått. Bildpunkterna gäller inferensbilden. |
| run.json | Källfilernas sökvägar och SHA-256, metod, modellinstallation, tider och status. |

## Lagring och gallring

- På Jakobs dator ligger materialet i `D:\ultimate-reality-lab`. `inputs` är inkorgen, `orders` är avsedd för beställningar, `runs` är för tillfälliga SAM-prov och `saved` är för bevarade resultat.
- Före varje nytt SAM-prov gallras märkta körningar som har varit färdiga i **sju dygn**. Avbrutna körningar räknas från starten. `keep` flyttar en körning till `saved` utan att dubblera den. En låst fil som hindrar gallring rapporteras och kan prövas vid nästa körning.
- `.\lab.ps1 clean --dry-run` listar vad som är gammalt nog. `.\lab.ps1 clean` gallrar direkt enligt samma regler. Gallringen körs när labbet används. Ett körningslås skyddar pågående modelljobb.
- På en dator utan D-disk används projektets ignorerade `.lab-data`. För annan disk, sätt `ULTIMATE_REALITY_STORAGE` till en absolut föräldramapp. Labbet skapar alltid sin egen undermapp `ultimate-reality-lab`.
- SAM-provet använder en befintlig modellinstallation via `SAM3D_ROOT` eller systermappen `sam-3d-body`. Det är ett verktygsberoende. Nya personer, filmer och poser tillförs via labbets egen inkorg. De vanliga lagringskommandona fungerar även med en separat Windows-Python 3.11 eller senare.

## Källkod och lokala prov

GitHub innehåller studion, provskripten, generella recept och tester. Bilder, film, kroppsskattningar, maskinrapporter och färdigrenderade visare lagras lokalt. Ett bordsprov med en avatar behöver motsvarande egen modell. Följ respektive provs renderingsanvisningar.

Kör lagringsproven med Python 3.11 eller senare från projektroten.

```powershell
python -B -m unittest discover -s tests -p test_storage.py -v
```

Hela Python-testsviten använder bland annat NumPy och SciPy för att kontrollera riggens rotationer. De finns i projektets SAM-miljö. För standardinstallationen i systermappen på Windows används följande kommando.

```powershell
& ..\sam-3d-body\.venv\Scripts\python.exe -B -m unittest discover -s tests -v
```
