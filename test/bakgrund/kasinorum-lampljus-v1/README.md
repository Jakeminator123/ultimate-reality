# LJUS-01 · Kasinorummets lampor

[Jämför före och efter från Stol 4 och Stol 1](http://127.0.0.1:4317/bordsprov/rum3d/lampor.html) · [Öppna jämförelsen offline](lampor.html) · [Vrid den ljussatta scenen](http://127.0.0.1:4317/bordsprov/rum3d?stol=4&glas=1&ljus=armaturer)

Alla fyra originalbilder är 1600 × 900. De visar Jakobs `Kasinorum.glb`, BORD-02, glas GLAS-01 och Paulinas 08-rigg med utseende 01/03. Första rödryggade kortet ligger i skon i tagningen `skoriktning-70-30-v1`, ruta 1 av 33. Referensrum SHA-256 `6c6585a3f853aafd23761ba817f8e5b016d0a29fa36bcb331890d30ae092d73a`. Pose SHA-256 `29f45dc4d6a4b72d9b7b7b5eec09618f3fb7e54529b34e91c2e191fdd6a0920e`.

## Jämförelsen

Före använder [RUM-06:s studioljus](../kasinorum-fri-v1/README.md). Efter ersätter huvudljuset och de två simulerade diffusionsytorna med ljus från rummets armaturer. Exponeringen är 1,05 med ACES i alla bilder. Kamerahöjden är 124 cm för Stol 4 och 116 cm för Stol 1, vertikalt synfält 48° för båda. Endast belysningen och dess reflexer växlas.

| Armatur | Centrum från GLB, meter (X, Y, Z) | Ljusmodell och antagen styrka |
| --- | --- | --- |
| Två nischglober | (±2,22, 0,59, −3,42) | Rundstrålande, 2 cd vardera |
| Fyra vägglampor | (±3,28, 0,85, −1,62 eller +1,38) | Rummets sida av diffusorn, 12,2 × 45 cm, 40 cd/m² |
| Fyra taklampor | (±2,62, 2,45, −0,92 eller +1,17) | Nedåtriktade med skuggor. 6,8 cd och konens halvvinkel 66° |
| Fyra taklister | Två längs X på Y 2,39 och Z −2,762 / +3,032, två längs Z på Y 2,402 och X ±3,102 | Lysande rektanglar längs diffusorerna, 13 cd/m² |

Positioner och storlekar kommer från sammanhängande ytor med materialen *Warm opal glass* och *Cove diffuser*. GLB-filen har självlysande material och saknar exporterade ljusobjekt. Färgtemperatur, ljusstyrka, ljusspridning och indirekt ljus är skattade. Armaturernas självlysande material får sex gånger originalstyrkan i efterläget. Hemisfärljuset går från 1,05 till 0,90. Reflektionerna beräknas från rummet. Glaset får en separat reflektion från sin position med bord och hand synliga. [Ljuskällor](armaturer.mjs)

## Vad syns?

Från Stol 4 får den räfflade glasbottnen en ljus linje. Från Stol 1 syns smalare reflexer längs mynningen och foten. Den genomskinliga sidoväggen är fortfarande svår att urskilja mot den gröna filten. Högdagrarna i nischerna hör nu ihop med ljusövergången över filten. Paulinas vänsterhand blir varmare och något mörkare, med ungefär samma läsbarhet i fingrarna. Från Stol 1 drar den ljusa valvbågen bakom henne till sig blicken.

[Fyra helbilder](jamforelse.jpg) · [Närbilder Stol 4](stol-4-detaljer.jpg) · [Närbilder Stol 1](stol-1-detaljer.jpg) · [Öppnad studievy](webbvy.jpg)

Nästa prov är att behålla armaturerna och ge handen vid skon ett svagt neutralt fyllnadsljus. Granska sedan fingrarna och kortkanten genom utdraget från båda kamerorna. RUM-03 är arbetsrummet. [Atlas-provet](../kasinorum-fri-v1/README.md) har djup, men väggpanel och mässingslist förlorar skärpa när kameran flyttas i den exporterade förhandsvisningen. Atlas beskriver hur skarpa, överlappande vyer påverkar rekonstruktionen. [Atlas om splat-kvalitet](https://docs.atlas.worldlabs.ai/splat-best-practices)

## Återskapa

Starta studion på port 4317. Kör från projektroten med studions pinnade Node och Python med Pillow och NumPy. Bildverktyget beskär samma pixelområde för före och efter, med mitten projicerad från ett gemensamt ankare i 3D.

```powershell
Push-Location studio
try { node ../test/bakgrund/kasinorum-lampljus-v1/render.mjs } finally { Pop-Location }
python test/bakgrund/kasinorum-lampljus-v1/bildpar.py
```
