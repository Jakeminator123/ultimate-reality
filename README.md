# Ultimate Reality

Ett fristående lokalt labb för att göra dealerfilmer där handen släpper rätt kort på rätt plats, sett från flera stolar. Jakob ska kunna redigera och granska både underlaget till Runway och resultatet. Scoutgaming är den framtida mottagaren.

## Börja här

1. Öppna [den lokala dealerstudion](http://127.0.0.1:4317). [Studioplanen](studio/PLAN.md) beskriver nästa etapp med figur, kort och kameror.
2. Läs [aktuell överlämning](information/HANDOFF.md) för senaste verifierade läge och nästa uppgift. I varje IDE gäller samma [agentinstruktioner](AGENTS.md).
3. Lägg egna grundbilder i `avatars/<namn>/` eller välj material i labbets `inputs`. Mediefiler och personliga prov lagras lokalt.

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
- **Runway API · lokalt utkast** visar om servernyckeln finns. **Testa API-anslutning** gör ett läsanrop till Runway. Endast status visas. Filmutkast och versionssparning görs lokalt. I filmgranskningen kan du ange **Runway MCP**, **Runway API** eller **Egen film eller annan källa** för ett importerat klipp.
- För Runway-anslutningen, lägg `RUNWAYML_API_SECRET` i `studio/.env.local`. Studion läser nyckeln på serversidan. Projektets filer ligger på den lokala labbdisken. En eventuell framtida Blob-butik ska tillhöra Ultimate Reality. För verifiering, kör `npm run build` följt av `npm test` från `studio`.

## 3D-modellering på labbdatorn

Under **Modellens underlag** ser du vilka bildoriginal som gav kroppen och fotoytan, SAM:s bildmått och vilka filmrutor som hör till den valda modellen. Sidan och rapporten läser samma versionsbundna filer. [3D-modellering](http://127.0.0.1:4317/#modellering) · [Standard för bilder, modeller och filmer](information/MATERIALVERSIONER.md)

I [Runways bildpipeline](http://127.0.0.1:4317/bildpipeline) kan du lägga in exempelvis fyra blandade foton och skapa en ny stående helfigur av personen. Spara ett lokalt utkast och välj ståfronten eller hela serien i den synliga beställningsvyn. Där finns exakt prompt, bildordning, referenser, upplösning och beräknat pris för varje steg. [Pipelineplan med bildberoenden](information/BILDPIPELINE.md)

[Bildstandarden för en dealer](http://127.0.0.1:4317/bildstandard) visar elva grundvyer och en extra kortvändning. Varje vy har en kopierbar prompt för egna foton och ett granskat exempel från Paulina. Hämta Paulinas ifyllda mall eller en tom mall för nästa avatars bildmått, observationer och osäkerheter. Båda använder samma JSON-format.

Startsidan låter dig öppna Paulina eller börja med en ny dealers egna foton. **Fas 1 · Bildpipeline** samlar bildstandarden, Paulinas tolv vyer och Runways beställningsflöde. **Fas 2 · 3D-modell** visar sittmodellen v2 och dess fotoreferenser. Välj kroppsform, fotoutseende eller enbart rigg. Skelett, ledpunkter och rutnät kan slås på var för sig. Kameravärden visar vridning, höjdvinkel, avstånd till riktpunkten och zoom. [Dealerval](http://127.0.0.1:4317/) · [Paulinas modell](http://127.0.0.1:4317/#modellering)

Valet mellan sittfront, trekvart och profil ställer också 3D-kameran. ImageGen i Codex skapade de tre sittbilderna. Hjässa till skosula upptar cirka 1 340, 1 340 och 1 288 px. [Jämför originalen och bildskalan](http://127.0.0.1:4317/bildstandard/sitthojd) · [Från kroppsskattning till fler kameror](studio/PLAN.md#från-paulinas-rigg-till-dealerfilm)

[Övrigt](http://127.0.0.1:4317/ovrigt) innehåller sittbasen v1, tidigare 08-riggar, labbets bildinkorg och parkerade rums- och ljusprov. Välj **Foto**, **Överlägg** eller **3D** för ett sparat prov. [Den äldre dockmallen](http://127.0.0.1:4317/ovrigt/fotomall) kan fortfarande sparas som fristående HTML.

## Gemensam 3D-scen

Paulinas SAM-sittmodell v4 ger till plats 4. Stol 4 och stol 1 visar samma kropp, fingrar och kort. Under Rörelseprov kan du jämföra givmönstret med källfilmerna, välja slutpose och spara en sekvens där varje kort ligger kvar när nästa hämtas. [Rörelsemönster och givsekvenser](http://127.0.0.1:4317/modellering/rorelseprov) · [Paulina vid bordet](http://127.0.0.1:4317/bordsprov/panorama/gothic-manor?stol=4&vy=giv)

I det redigerbara rumsprovet RUM-03 står BORD-02 på 192 × 129,6 cm med SKO-03. Den tidigare 08-riggen visar tagningen `skoriktning-70-30-v1` i de två stolkamerorna. [Öppna rumsprovet](http://127.0.0.1:4317/bordsprov/rum3d?rum=mesh&stol=4&glas=1)

[Se Paulinas vänsterhandsutdrag på det större bordet](http://127.0.0.1:4317/bordsprov/paulina-utdrag.html). I Kasinorum kan du jämföra 192 × 129,6 cm med 160 × 108 cm på samma bildruta. [Materialdetaljen](http://127.0.0.1:4317/bordsprov/paulina-utdrag.html?vy=material) visar Poly Havens gröntonade mikromocka, bruna läder och valnötsfaner.

I [det tomma bordsprovet](http://127.0.0.1:4317/bordsprov/rumsprov.html?dealer=0) kan du växla mellan stol 4 och stol 1 samt mellan 108 och 96 cm ytterdjup med samma sko, kortmål och rum. [Rumsprovets renderingsanvisningar](test/bakgrund/kasinorum-v1/README.md) skapar en lokal visare som fungerar även med studion stängd. [Materialmapparna](test/README.md) skiljer dealer, bord, bakgrund och artefakter. Lägg egna dokument eller referenser för chattarna i [jakob-random](jakob-random/).

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

Kör lagringsproven med `python -B -m unittest discover -s tests -v` på Windows med Python 3.11 eller senare.
