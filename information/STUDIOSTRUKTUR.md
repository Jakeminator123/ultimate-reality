# Arbetsytor i Ultimate Reality

Paulinas fotoomstart använder en stilla sittpose. Öppna originalen och jämför samma kropp framifrån, i trekvart och från den valda profilen. [Fotostarten](../avatars/paulina/fotostart/index.html) · [Stillbilder och mätningar](PAULINAS_STILLBILDER.md) · [Aktuell överlämning](HANDOFF.md)

| Plats | Innehåll |
| --- | --- |
| `avatars/paulina/` | Tillförda original 01 och 03 samt numrerade källbilder och `fotounderlag-v*.json`. Fotostarten visar valda referenser. |
| `avatars/paulina/fas-1/v1/` | De tolv registrerade bildfilerna för upplaga 1, bildregistret och granskning. Vald profil v3 ligger i upplagans granskning och har ett eget mätkvitto. |
| `avatars/paulina/prov-70/v1/` | Versionsmapp för aktuellt prov. Samla provets tillförda och skapade filer, källhänvisningar, SAM-ID och mätningar här. Fotounderlaget återanvänds via exakt sökväg och SHA-256. |
| `avatars/<dealer>/3d/versioner/` | Registrerade GLB-filer, fotoytor, rörelser, filmexporter och granskningskvitton. Den valda kombinationen av kropp, eventuell fotoyta och bildutgåva anges i `aktiv.json`. [Versioner och registrering](MATERIALVERSIONER.md) |
| Labbdisken | `inputs` för inkorgens original, `orders` för lokala beställningsversioner och originalresultat, `runs` för tillfälliga SAM-prov och `saved` för bevarade körningar. [Underhåll och Git](UNDERHALL.md) |
| `studio/`, `tools/`, `test/` | Studio, verktyg och provrecept. Automatiska tester finns i `tests/` och `studio/tests/`. [Studioplan](../studio/PLAN.md) · [Provkatalog](../test/README.md) |
| Lokalt återställningsarkiv | Tidigare kroppar, fotoytor, SAM-körningar, animationer och filmprov från den 20 november 2026. Slå upp ursprunglig sökväg i manifestet och återläs separat när äldre utgåvor ska granskas samtidigt som dagens arbetskopia används. [Arkiv och återställning](HANDOFF.md#arkivet-från-20-november-2026) · [Äldre provkatalog](PAULINAS_PROV.md) |

Vid granskning anges version och kamera. Ange även tagning, kort och bildruta när iakttagelsen gäller ett rörligt grepp eller kortets placering. [Bildgranskarens uppdrag](../.codex/agents/bildgranskare.toml)

## Kontroll av kopior och kroppslager

- **Bildvägar.** I 57 bild- och JSON-filer i Paulinas grundbildsmapp och labbets `inputs` fanns 16 grupper med samma SHA-256. De ytterligare 21 sökvägarna representerar 36 045 536 byte. Till exempel har original 01, `fas-1/v1/staende/front.png` och inkorgens motsvarande foto samma bytes. Fotostarten, bildregistret och den tidigare SAM-källkedjan har var sin sökväg. Kontrollen bevarade dessa filer och pågående prov.
- **Arkivet.** Samtliga 2 610 arkivfiler verifierades mot manifestet. Manifestet anger 39 extra GLB-sökvägar och 20 extra filmvägar med byteidentiskt innehåll. Namngivna arbetsfiler och SHA-adresserade registreringsfiler kan ingå i samma kedja. I `giv-sam-v4-v9` pekar filmkvittot till rörelse `3d216ea7…` och film `1c942d8d…` i registret. Båda har även sina namngivna exporter i tagningens mapp. Återställningen behöver båda adresserna. [Äldre prov och exakt arkivplats](PAULINAS_PROV.md)
- **Modellagren.** Den arkiverade v4-fotoytan `c2964291…` har en kropp på 36 874 trianglar och ett hårskal på 25 600. Givprov 9 (`3d216ea7…`) har även ett omtriangulerat, rörligt ögonlocksskikt på 116 864 trianglar och en hårdel på 233 trianglar för benan. Av ögonlocksskiktets triangelcentrum projiceras 77,84 % inom 2 mm av kroppens yta med samma normalsida, mot 4,24 % i andra riktningen. Hårdelens motsvarande andel mot hårskalet är 34,76 %. Inget par har exakt gemensamma trianglar. De tre kortmaterialen ger 0 % närträffar i samma kontroll. [Kör kontrollen på en GLB](MATERIALVERSIONER.md#kontrollera-glbens-kropp-och-material)
