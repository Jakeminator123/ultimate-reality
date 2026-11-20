# Geometrikontroll av vänsterhandens kortdrag

**Godkänd geometri i 33 av 33 bildrutor.** Den kontrollerade exportens SHA-256 är `c05b66757319c3742c8700c637dd6f32939714960b9479c37736c3b48be5577b`. Kropp och hår har samma bindgeometri och hudvikter som Fas 1 v2. Höger arm ligger fri från skivan. Kortet löper 108 mm. Inga genomskärningar hittades mellan kroppen och sko, kort eller skiva, eller mellan kort och sko eller skiva.

| Distal fingeryta | Glapp till kortets kontaktyta | Minsta avstånd till sko | Minsta avstånd till filt |
| --- | --- | --- | --- |
| Vänster pekfinger | 0,085–0,151 mm | 1,481 mm | 0,540 mm |
| Vänster långfinger | 0,031–0,149 mm | 1,480 mm | 0,489 mm |

Kontrollen läser den slutliga animerade GLB-filen och utvärderar de 33 visade poser som delas av Stol 4 och Stol 1. Den använder styrleden och hudvikterna för varje enskilt hörn i Paulinas kropp och hår. GLB-filens bindgeometri, trianglar och vikter jämförs med den texturerade Fas 1 v2-filen.

KORT-02 följer de 65 stationerna längs varje kortkurva i `skoriktning-70-30/bana.json`. Kortet bär en markerad kontaktyta på 14 × 14 mm för vardera pek- och långfinger. Rapporten mäter den minsta höjden från den aktuella fingerytan till kortets översida i just det kontaktfältet. Ett positivt mått är ett modellerat glapp. Ett uteblivet mätvärde betyder att det fingret saknar en yta över fältet inom sökområdet. Måttet kan användas för att bedöma passningen. Greppkraft, fingerfriktion och hudkompression kräver andra underlag.

Skons elva fasta delar och filtskivans triangulerade kontur hämtas från studions geometri. Rapporten kontrollerar hela kroppen och kortet mot dessa volymer vid en tolerans på 0,001 mm. Den redovisar även det närmaste avståndet från vardera kontaktfingrets distala hudtrianglar till skon och filtens yta. Alla mått är i modellens bordskoordinater.

[Mätning per ruta samt SHA-256 för rigg, animation och kortbana](matt-v2-grepp.json) · [Källversion för kortbanan](../../../../../artefakter/skoriktning-70-30/README.md)

Kör från `studio/` med projektets pinnade Node. För att bedöma en annan export, ange den som första argument och välj en egen utdatafil som andra argument.

```powershell
node ../test/bakgrund/polyhaven/brown-photostudio-01/handljus-v2/granskning/mat_grepp.mjs
```
