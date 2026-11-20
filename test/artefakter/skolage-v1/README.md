# SKO-03 · Kortskons läge på det stora bordet

[Öppna jämförelsen i studion](http://127.0.0.1:4317/bordsprov/skolage.html) · [Öppna offline](skolage.html) · [Bildpar och ovanvyer vid halva utdraget](jamforelse.jpg)

**Helvy v2.** Välj **Hela bordet ovanifrån** för att se den rundade spelarfronten och urtaget vid dealern. Kameran är lodrät och ortografisk med ett utsnitt på 231,47 × 173,6 cm i samtliga tre lägen. Bakgrunden är neutral så att rummets tak och väggar lämnar bordskonturen fri. **Arbetskanten ovanifrån · närbild** visar 98 × 55,125 cm kring greppet. Det tidigare utsnittet klippte bort relingen och nästan hela spelarhalvan så att bara en sned del av urtaget syntes. [Originalvisare v1](skolage-v1-original.html) · [Originalets bildmatris](jamforelse-v1-original.jpg)

Prova **10 cm mot arbetskanten** för Jakobs önskade läge. Avståndet från skons fot till dealerns kant minskar från 18,29 till 10,68 cm. Att flytta skon åt hennes vänster ökar avståndet till den konkava kanten till 24,73 cm.

| Version | Mittpunkt X / Z (cm) | Fot till arbetskant | Axelreferens till handled, ruta 1 → 33 | Finger till kort, 33 lägen |
| --- | --- | --- | --- | --- |
| [Utgångsläge](../kasinorum-utdrag-100/README.md) | +46 / −21 | 18,29 cm | 19,40 → 13,01 cm | 0,0003–0,0494 mm |
| [Arbetskant v4](arbetskant-v4/bana.json) | +46 / −31 | 10,68 cm | 21,35 → 16,90 cm | 0,0003–0,0494 mm |
| [Åt vänster](vanster/bana.json) | +56 / −21 | 24,73 cm | 28,68 → 20,14 cm | 0,0173–0,0665 mm |

Alla tre använder Kasinorum, 192 × 129,6 cm bord, −100° sko, samma lutning, ljus och ögonpositioner. Utdraget av det första rödryggade kortet på 63 × 89 × 0,4 mm är 108 mm. Kortbanans form följer skons förflyttning. Tagningarna omfattar nio exporter och 24 interpolerade lägen. Visaren jämför ruta 1, 17 och 33 ovanifrån, från stol 4 och stol 1 samt från båda stolarnas handkameror.

**Mätning.** Den gula linjen går från skofotens roterade omslutning till närmaste segment på den faktiska, konkava arbetskanten. Skofotens fyra hörn ligger på filten. Axel–handled är ett rakt modellmått från riggens fasta axelreferens vid X +16,3, Y +23,1, Z −36,9 cm. Alla tre klarade 33 av 33 lägen för kropp mot sko/kort/skiva och kort mot sko/skiva vid tolerans 0,001 mm. Finger–kort avser minsta hudavstånd i 14 mm kontaktfält. Greppkraft och självkontakt inom kroppen är omätta. [Mått och linjeändpunkter](matt.json) · [Kollisionsrapport v4](arbetskant-v4/matt-kollisioner.json)

**Överlämning till Paulina.** Tagning `skolage-v1-arbetskant-v4`, posekatalog `arbetskant-v4/` med `drag-00.glb` till `drag-08.glb`, tillhörande [bana.json](arbetskant-v4/bana.json). V4 utgår från referensens nio kroppar i `kasinorum-utdrag-100/handkandidat/mhr-arm/`. Förflyttningen använder modellens MHR-vikter och en tvåledslösning med bibehållna armsegment och fingerform. Sidoprovet använder samma upprätade 08 med ompassad MHR-rigg.

**Bildgranskning.** I v4 syns fingret på kortet från stol 1 i ruta 1 och kortet fritt på filten i ruta 33. Handleden håller samman. I ruta 17 från stol 4 förbättras axelns kontur. Armbågen stiger ungefär till hakans höjd i ruta 33. Granska slutarmbågen vid nästa förbättring.

| Tidigare passning vid samma arbetskant | Utfall |
| --- | --- |
| `arbetskant` | Direkt passning gav hög armbåge och synlig handledsskarv. 0 genomskärningar i 33 lägen. |
| `arbetskant-v2` | Gradvis ompassning sänkte armbågen och förbättrade handleden. Vänster axel drogs upp intill huvudet. 0 genomskärningar i 33 lägen. |
| `arbetskant-v3` | Alternativ armbågsriktning gav kropp mot skiva i 21 av 33 lägen. Största observerade inträngningsmarginal var 0,7874 mm. Varianten valdes bort. |

## Återskapa

Kör `placering.py` från projektroten med lokala SAM-miljön. Det skapar v4 och sidoprovet. Använd projektets pinnade Node från `studio/` för mätning och tre renderade granskningsrutor per vinkel. När referensen mäts används originalets posekatalog och banfil. Visaren hämtar referensbilderna från originalets utdrag.html och verifierar alla nio GLB-hashar.

```powershell
$provsokvag = '../test/artefakter/skolage-v1'
$ursprung = '../test/artefakter/kasinorum-utdrag-100'
foreach ($lage in @('arbetskant-v4', 'vanster')) {
    $katalog = Join-Path $provsokvag $lage
    node "$ursprung/kollisioner.mjs" $katalog "$katalog/matt-kollisioner.json" "$katalog/bana.json" "$katalog/kontur.json"
    node "$ursprung/render.mjs" $katalog "$katalog/bilder" --poseprov "$katalog/bana.json"
    node "$ursprung/render.mjs" $katalog "$katalog/bilder" --helvyprov "$katalog/bana.json"
}
New-Item -ItemType Directory -Force "$provsokvag/referens" | Out-Null
node "$ursprung/kollisioner.mjs" "$ursprung/handkandidat/mhr-arm" "$provsokvag/referens/matt-kollisioner.json" "$ursprung/bana.json" "$provsokvag/referens/kontur.json"
node "$ursprung/render.mjs" "$ursprung/handkandidat/mhr-arm" "$provsokvag/referens/bilder" --helvyprov "$ursprung/bana.json"
python "$provsokvag/jamfor.py"
```
