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

Givprov 4 och 5 använder fortfarande sittmodell v2. Prov 4 ändrar utskjut, handbyte och placering. Prov 5 ändrar ytan vid näsan och har samma rörelsespår som prov 4. När rörelsen flyttas till sittmodell v4 används den nya kroppens viloform, hudbindning och fotoyta. Den exporterade animationen får ett eget fingeravtryck och kortkontakterna mäts om på den kroppen. Varje film registreras med sina egna granskningar från båda stolarna. [Givprov 4](paulina-rorelseunderlag-v4.json) · [Givprov 5](paulina-rorelseunderlag-v5.json) · [Mätning på SAM-sittmodell v4](../test/dealer/paulina/giv-sam-v4-v1/matning.json)

För en giv med utskjut ur skon granskar vi fingerblommornas läge på den synliga kortsidan, kortets väg längs mynningen och mottagarhandens avstånd från filten vid bytet. Källfilmen visar ordning och form. Avstånd i millimeter mäts i den animerade modellen. Kontaktkraft kräver en fysisk mätning.

Skons läge väljs för dealerns sittpose och hand som skjuter ut kortet. För Paulina på BORD-02 ligger SKO-03:s mitt 460 mm åt hennes vänster och 80 mm fram mot spelarna, räknat från sitsens mitt. Jämför räckvidden under utskjutet och var handen vilar efter släppet. Spara skons plats och riktning med tagningen när en annan dealer eller ett annat bord används. [Paulinas utskjut och slutpose jämförda med originalfilmen](../test/artefakter/skolage-vilohand-v1/README.md)

**Leder mot fotoyta.** I både sittmodell v2 och v4 har den neutrala kroppen och dess fotoyta identiska vilopositioner för alla 127 leder. Vid byte av yta läser visaren den valda GLB-filens skelett. Ögonpunkterna markerar ögonens rotationscentrum och pupillerna ligger i texturen. Den gröna huvudlinjen binder samman huvudleden och dess ändpunkt inne i skallen. I v2 ligger huvudleden 79,8 mm bakom ögonens mittpunkt i modellens framåtriktning. Markörerna har fast visningsstorlek vid zoomning. Urvalet med 77 leder ritar förbindelsen till handleden genom dess dolda vridled. [Överlägg i 3D-modelleringen](http://127.0.0.1:4317/#modellering) · [Hur ledpunkterna ritas](../studio/lib/rig-overlay.ts)

**Vad som ändras när du väljer Fotoutseende.** I utgåvan v2 gav alla 18 439 kroppshörn samma position i grå och fotograferad yta. I v4:s korrigerade fotoyta är 209 hörn förskjutna lokalt kring näsan, som mest 1,70 mm. Kroppens totala bredd, höjd och djup är identiska inom respektive utgåva. Håret har ett eget skal. Porträttet i vänstra panelen visas med originalets utsnitt. När vi växlade mellan kroppsform och fotoyta i samma högra panel bevarades riktpunkt, zoom och kamera. [Båda ytorna på v2 med samma kamera](../test/dealer/paulina/fas1-sittande-v2/kroppsform-fotoyta-samma-kamera-front.jpg)

I båda sittmodellerna har de 77 leder som visas normalt skilda centrum i viloposen. De 127 lederna har totalt 116 skilda centrum inom 0,01 mm. Elva par delar nästan samma position. Exempel är handledens vridled och själva handleden. Deras rotationer fyller olika funktioner i hudbindningen. Två leder på olika djup kan dessutom projiceras på samma bildpunkt från en stol.

I sittmodell v2 ligger bäckenroten `root` och ryggradens första led `c_spine0` 8,1 mm isär i höjd och 37,4 mm i djup. De två höftlederna ligger till höger och vänster om roten. Armbågens rotationscentrum hör till `lowarm`. Vid 20, 40, 60 och 80 % av varje underarm fördelar fyra hjälpleder vridningen till huden. Visarens **Alla 127 leder** tar med dessa punkter.

På v4 mättes det målade ögats läge mot mitten mellan den övre och nedre lockkanten i en frontvy med låst kamera. I filmprov 3 justerades irisen och ytan för slutna lock var för sig. Fotots kamerakalibrering och personens verkliga ansiktsmått är okända. [Front, trekvart och profil bredvid porträtten](../test/dealer/paulina/fas1-sittande-v4/ogonpassning/ogonpassning-tre-vinklar.jpg) · [Mätning av ögonöppningen i modellen](../test/dealer/paulina/fas1-sittande-v4/ogonpassning/iris-fore-efter.json)

En arm med rätt benlängder kan ändå vrida huden tvärt mellan två rutor. Kontrollera den verkliga GLB-filens lokala rotation i handleds- och underarmslederna och ange led, första ruta, andra ruta och vinkel. I prov 3 vrids vänster underarmsled `l_lowarm_twist3_proc` 178,07° mellan ruta 11 och 12. Det skiljer sig från vinkeln mellan underarm och handflata i en stillbild. [Mät rotationen mellan filmrutor](../tools/arm_rotation_check.py)

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

I den första filmexporten på sittmodell v4 skjuter vänsterhanden ut KORT-02 i ruta 4. Högern möter i 9, vänder i 16 och lägger kortet på plats 4 i 22. Kortet ligger kvar när högern börjar lämna i 25. Jämför samma ruta från stol 4 och stol 1 för att se fingrar som skymmer varandra. [Film på sittmodell v4](http://127.0.0.1:4317/bildstandard/sittprofil?modell=prov#givfilm) · [Uppmätt kortbana och kontaktrutor](../test/dealer/paulina/giv-sam-v4-v1/handelser.json)

1. Filma **ett verkligt kortdrag samtidigt framifrån och från sidan**. Låt tummen, pekfingret, skons öppning och kortkanten synas. Spara synkpunkten och markera grepp, kort på kant och släpp.
2. Jämför högerns lillfinger under vändningen i ruta 16 med samma händelse i referensen. Kontrollera att en justerad fingerpose behåller kantkontakt, släpp och landningspunkt från båda stolarna.
3. Granska glidning, skuggor och timing i spelarens utsnitt. Där stolen syns behövs också kontakt mellan säte, sits och golv. I viloposens profilprov syns bakgrunden under sätet.
4. Bedöm hud, hår och kavaj i de två färdiga vyerna. Ta en skarp närbild där ytdetalj saknas, till exempel bakre trekvart för håret. Om rörelsen stämmer men fotoytan brister, prova filmprojektion från en känd kamera på samma rigg.
