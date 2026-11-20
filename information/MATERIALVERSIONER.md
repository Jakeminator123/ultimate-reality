# Materialversioner för en dealer

Studion visar den valda bildutgåvan, kroppsmodellen, fotoytan och filmerna som faktiskt hör till dem. Öppna **Modellens underlag** för pixelmått, bildkällor och granskningsrutor. Markdownrapporten och JSON-vyn läser samma lokala material som sidan. [Modellering](http://127.0.0.1:4317/#modellering) · [Paulinas aktuella materialrapport](http://127.0.0.1:4317/api/material?dealer=paulina&report=md)

| Material | Det som följer med versionen | Hur vi använder uppgiften |
| --- | --- | --- |
| Foto | SHA-256 för originalet, bildutgåva, filformat och pixelmått. En granskning hör till exakt samma bildbytes. | Receptets 0°, 45° eller 90° beskriver önskad kamera. Granskaren beskriver synlig riktning, ljus och osäkerhet. Verkligt avstånd och objektiv kräver mätning. |
| Kroppsmodell | GLB-version, leder, SAM-körning och bildkällor för geometri respektive hållning. | Originalbildens mått, SAM:s inlästa bild och modellens kropps- och handutsnitt är separata uppgifter. Nya körningar sparar utsnitten som faktiskt konfigurerades. För äldre körningar anges när den lokala modellkonfigurationen har lästs i efterhand. |
| Fotoyta | Egen GLB-version, den rigg den byggdes på, källbilder och kroppstexturens inbäddade pixelmått. | Ett nytt porträtt, en ombakad textur eller en ny basrigg kan ge en ny version. De tidigare filerna går att granska vidare. |
| Animerad modell | GLB med tidslägen från animationsspåren, exakt grundrigg och fotoyta, tagning, kort-ID och kortbanans SHA-256. | Samma arm, fingrar och kortbana kan spelas från båda stolarna. Filmexporten anger den animerade GLB-filens SHA-256. |
| Renderad film | Filmens SHA-256, tagning, rigg, vald fotoyta, eventuellt kort, kamera och uppmätta fil- och bildrutetider. | Återanvänd samma rörelse och samma kort från olika stolar. Koppla varje iakttagelse till filmversion, kamera och nollbaserade rutor. |

## Automatisk registrering

Den första versionssiffran i `ansiktsrigg-v2-v2` anger kroppens version och den andra anger blinkprovets version. Studion visar **Blinkning · prov 2** och anger kroppen separat. En sammansatt giv använder ett skelett och en tidslinje. GLB-filen anger SHA-256 för de hand- och ögonlocksrörelser som ingår. Registret matchar deras geometri och fotoyta. Under filmen går det att öppna källrörelser och granskade bildrutor. [Rörelseprov](http://127.0.0.1:4317/modellering/rorelseprov)

När en tagning får korrigerad fotoyta anger den grundtexturens SHA-256, den inbäddade nya texturens SHA-256 och vilka porträtt som använts. Vid registrering verifieras båda texturerna och porträttens koppling till grundmodellens bildserie. Den spelbara given behåller kroppens ursprungliga leder och bindning. [Prov 2 med korrigerad yta](paulina-rorelseunderlag-v2.json)

I **Giv med blinkning · prov 3** kombineras handprov 3 och blinkprov 2 på samma sittmodell v2. Handprov 3 anger exakt vilka rutor i `pos4-v.mp4` som användes för fingerformen. I studion visas dessa källrutor under den giv där rörelsen ingår. [Givprov 3 med källor och mätning](paulina-rorelseunderlag-v3.json)

Kropps- och fotoyteverktygen registrerar färdiga avatarfiler automatiskt. Modellens inbäddade fingeravtryck bestämmer källrelationerna. Vid ny export till ett upptaget arbetsnamn får den ändrade filen ett eget versionsnamn. Återkörning av samma innehåll återanvänder det sparade objektet. En öppen studio hämtar nya uppgifter när en modellutgåva, animation, film eller granskning registreras.

När en modell och en bildserie hör ihop väljer man den kombination som studion ska visa. Då kontrolleras fotoytans grundrigg och varje källbild. Valet sparar också bildoriginalen och bildregistret för senare granskning. Tidigare val finns kvar i versionsväljaren. Original, modeller, tagningar och granskningar ligger lokalt under `avatars/<dealer>/3d/versioner/`. [Verktyget](../tools/material_versions.py)

Exempel från projektroten med labbets Python. Ange dealer, bildutgåva och filer för det aktuella försöket.

```powershell
$labPython = '..\sam-3d-body\.venv\Scripts\python.exe'
$modelRoot = 'avatars/paulina/3d/fas1-v2'
$savedRun = 'D:\ultimate-reality-lab\saved\sam-20261120T015406Z-f427a95156b7'
$rigId = & $labPython tools/material_versions.py --dealer paulina model "$modelRoot/paulina-fas1-v2.glb" --run $savedRun
$lookId = & $labPython tools/material_versions.py --dealer paulina model "$modelRoot/utseende/paulina-fas1-v2-utseende.glb"
& $labPython tools/material_versions.py --dealer paulina activate --id paulina-fas1-v2 --name 'Paulina · sittmodell v2' --edition fas-1/v1 --geometry $rigId --appearance $lookId
```

För en annan registrerad dealer öppnas `/?dealer=<namn>#modellering`. Kameraprovet körs från `studio` med `node tools/kameraprov.mjs <namn>` medan den lokala studion är öppen. Exportören läser de GLB-bytes som laddades i visaren och kamerans läge, riktpunkt, utsnitt och zoom i varje ruta. FFprobe läser färdig MP4. Andra 3D-renderare kan registrera sina exporter genom `film --file <mp4> --capture <tagning.json>` på samma verktyg. Exportören lämnar filmens hash, rigg, fotoyta, tagning, kamera och rutnummer. En fysisk referensfilm dokumenteras med egen kamera, synkpunkt och källfil när dess rörelse överförs till riggen. [Kameraprovet](../studio/tools/kameraprov.mjs)

## Nästa prov för att få Paulina naturlig

V2:s givprover visar KORT-02 till plats 4 och en blinkning vid återgången i 54 rutor från två stolar. I prov 2 sjunker armbågen, högern vänder upp kortet och huvudet följer kortbanan. Vid ruta 26 ligger kortet plant och stilla. När en handled skymmer fingrarna från ena stolen, öppna samma ruta från den andra. [Se givprov 2 och bildgranskarens rutor](http://127.0.0.1:4317/modellering/rorelseprov?dealer=paulina&revision=9ce142c1ab2ab640fc9d7e2559f6624da88bad5506eab0c15a82c6d9049cd4db&tagning=samspel-v2-v2#vald-tagning)

1. Filma **ett verkligt kortdrag samtidigt framifrån och från sidan**. Låt tummen, pekfingret, skons öppning och kortkanten synas. Spara synkpunkten och markera grepp, kort på kant och släpp.
2. Sänk armbågen vid handbytet, mjuka upp handleden och rikta blicken mot kortet. Kontrollera grepp, släpp och landning i samma rutor från båda stolarna.
3. Granska glidning, skuggor och timing i spelarens utsnitt. Där stolen syns behövs också kontakt mellan säte, sits och golv. I viloposens profilprov syns bakgrunden under sätet.
4. Bedöm hud, hår och kavaj i de två färdiga vyerna. Ta en skarp närbild där ytdetalj saknas, till exempel bakre trekvart för håret. Om rörelsen stämmer men fotoytan brister, prova filmprojektion från en känd kamera på samma rigg.
