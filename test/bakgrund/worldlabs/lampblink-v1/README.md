# LJUS-02 · En blinkande pendel i Atlas-rummet

Samma lampa sitter till höger om Paulina från Stol 4 och till vänster från Stol 1. Välj **Blinka var tredje sekund** för att dämpa den i en halv sekund. Vrid kameran eller byt stol medan provet spelar. [Öppna 3D-vyn](http://127.0.0.1:4317/bordsprov/rum3d?rum=atlas-full&stol=4&glas=1&blink=1)

- **Film.** Båda stolarna syns samtidigt i nio sekunder. H.264, 1920 × 588, 24 bilder/s. Filmen återger de två ljuslägena från samma lokala 3D-visare med synkroniserad växling. [Se filmen](lampblink.mp4) · [Se lampans detaljer](kontroll.jpg)
- **Egen inspelning.** Klicka på **Spela in vyn**, rör kameran, klicka på **Avsluta inspelningen** och sedan **Hämta din inspelning**. Webbläsaren spelar in lokalt från 3D-ytan. Den sparar WebM eller MP4 beroende på formatstöd. Blinkningen, filmen och inspelningen använder 0 Atlas-krediter.
- **Metod.** Källan är RUM-07, fullversionen av Atlasvärlden. Lampans 3D-centrum skattades till (2,147, 0,289, −3,302) meter i bordets koordinatsystem från de två kalibrerade stolarna. Spark ändrar ljusheten i två mjukt avgränsade ellipsoider kring glödlampan och nischen. Lampan ingår i originalvärlden. Blinkningen är ett lokalt tillägg. Paulina, glaset och filten behåller studioljus eftersom Atlas har bakat in ljuset i rummet. [Rummets mätningar](../../atlas-splat-v1/matning.json) · [Kamerorna](../../../bord/filtdjup-v1/matt.json)
- **Kontroll.** I båda vyerna sjönk medelvärdet i lampkärnans gröna bildkanal med 88 %. Utanför kontrollområdet på ±175 pixlar från centrum ändrades 0 pixlar med mer än fem kodsteg i samma kanal. I den avkodade MP4-filen dämpades lampan på bildrutorna 36–47, 108–119 och 180–191 (räknat från noll) i båda stolarna.

För att göra om provet, starta studion och kör `node ../test/bakgrund/worldlabs/lampblink-v1/render.mjs` från `studio/`. Skriptet använder Edge, FFmpeg och det lokala rummets befintliga resurser.
