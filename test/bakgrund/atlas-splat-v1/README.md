# RUM-07 · Atlas fulla 3D-version

[Jämför fyra helbilder i studion](http://127.0.0.1:4317/bordsprov/rum3d/atlas-jamforelse.html) · [Öppna bildparet offline](atlas-jamforelse.html) · [Vrid rummet från Stol 4](http://127.0.0.1:4317/bordsprov/rum3d?rum=atlas-full&stol=4&glas=1)

Atlas använde de nio kamerabilderna från [RUM-05 · Chisel-iteration 1](../atlas-chisel-v1/README.md) för båda SPZ-versionerna. Förgrunden är BORD-02 och GLAS-01 med Paulinas 08-rigg, utseende 01/03, första rödryggade kortet och tagning `skoriktning-70-30-v1`, ruta 1 av 33. Exponering 1,05 och tidigare studioljus är fasta.

## Jämförelsen

Stol 4 visar två pendellampor med urskiljbara kupor och en sammanhängande mässingslist i fullversionen. Stol 1 visar ådringen i sidopanelen och smala väggarmaturer där snabbförhandsvisningen gav ett rutmönster. Den mörkgröna bakväggen har fortfarande kornig yta. Bordets förgrund är låst. Ett rektangulärt filtutsnitt per stol är pixelidentiskt i båda versionerna (Stol 4 X 560–849, Y 592–674, Stol 1 X 470–674, Y 682–739). [Fyra bilder i översikt](jamforelse.jpg)

| Export | Antal splats | Filformat och storlek | Golv under bordet i exporten | Förskjutning i studion |
| --- | --- | --- | --- | --- |
| Snabbförhandsvisning RUM-06 | 947 213 | SPZ v3, 6 208 420 byte | Tidigare inpassning −0,4509 m, ommätt centrum −0,4539 m | Y −0,2991 m enligt tidigare prov |
| Full 3D-version RUM-07 | 2 000 000 | SPZ v2, 31 195 069 byte | Ommätt centrum −0,460449 m | Y −0,289551 m |

Källfilerna ligger i `test/bakgrund/atlas-chisel-v1/`. Fullversionen heter `full-splat-v1.spz` med SHA-256 `41d190b1d7f7a426fa03257bc2361033409b570f5b2869ba1bfb30708d816ba2`. Fullversionen har 12 bråkbitar för positioner och SH-grad 0. [Mätning, båda filernas header och hash](matning.json)

Båda studievyerna använder 16:9, vertikalt synfält 48° och höjd över referensgolvet 124 cm vid Stol 4 respektive 116 cm vid Stol 1. Kamerorna, bordet och figuren hämtas från [den vridbara scenen](../kasinorum-fri-v1/README.md).

## Inpassning

X går åt sidan, Y uppåt och +Z mot Stol 4. Vi kontrollerade den nya filens positioner och orientering mot det tidigare punktmolnet och vyerna från båda stolarna. Skala, rotation och förskjutning i X/Z behåller exportens värden. Golvet flyttas i Y så att regionen under bordet möter studiogolvet på −0,75 m. För fullversionen har medianer i 16 celler om 30 × 30 cm ett spann av cirka 3 cm. Höjden är en skattning från den rekonstruerade ytan. Väggarnas exakta mått och kvalitet utanför de två kontrollerade spelarkamerorna är öppna frågor.

## Återskapa

Starta studion på port 4317. Python med NumPy läser filhuvud och positioner direkt ur de två SPZ-filerna, och skriver mätningen atomärt. Kör sedan bildfångsten med studions Volta-pinnade Node och Edge. Den väntar på att Spark sorterat den valda versionen för respektive kamera, verifierar förgrund och dimensioner samt skriver fyra PNG-original och HTML-visaren.

```powershell
python test/bakgrund/atlas-splat-v1/mat_golv.py
Push-Location studio
try { node ../test/bakgrund/atlas-splat-v1/render.mjs } finally { Pop-Location }
```
