# Fotograferade material för blackjackbordet

De tre materialproven kommer från Poly Haven. Varje yta har en 2K-färgkarta, en OpenGL-normalkarta och en råhetskarta. [CC0-licensen](https://polyhaven.com/license) tillåter även kommersiell användning.

| Bordsdel | Skannat material | En upprepning i modellen |
| --- | --- | --- |
| Spelyta | [Scuba Suede](https://polyhaven.com/a/scuba_suede), en tät mikromocka med kort lugg. Den skannade ljusvariationen färgas till studions gröna filt. | 28,52 × 27,89 cm |
| Vadderad reling | [Brown Leather](https://polyhaven.com/a/brown_leather), naturlig brun läderfärg och synlig narv. | 40 × 40 cm |
| Träskiva och träben | [Walnut Veneer](https://polyhaven.com/a/walnut_veneer), valnötsfaner med ådringen längs skivans kant och benens höjd. | 180 × 180 cm |

[Manifestet](manifest.json) innehåller de ursprungliga nedladdningslänkarna och MD5 för varje bild. Lägg bilderna i angivna lokala filsökvägar. Labbets Git-regler håller dem på datorn.

[Materialmodulen](material.mjs) exporterar `materialFiles` för renderarens filregister. Lägg materialet på ett färdigbyggt bord med `await applyTableMaterials(table, layout, baseUrl)`. URL:en pekar på katalogen med `maps/`. Anropet returnerar en funktion som återställer de ursprungliga materialen och frigör det nya provets resurser.

Filten behåller kortmål, spelarrutor, mittkryss och text från just det bordets tryckkarta. På relingen följer texturen båglängd och vadderingens profil. Bordskivans faner följer ytterkonturen runt den böjda kanten. Yttermått, vertexpositioner, kortmål och söm är bibehållna. Normalkartorna beskriver ytornas små variationer. Filtens gröna infärgning och fanerets satinfinish är valda för provet.
