# Foto- och scenprov

**Börja med Paulinas stillbilder.** Hennes tillförda original och den valda sittprofilen finns i avatarmappen. Den tidigare tvåkortsgiven och dess modellresultat finns i det lokala återställningsarkivet. Scenarbetet med bakgrunder och bord är pausat. [Fotostart](../avatars/paulina/fotostart/index.html) · [Bildmått](../information/PAULINAS_STILLBILDER.md) · [Arkiv och återställning](../information/HANDOFF.md)

| Mapp under `test/` | Vad proven avser |
| --- | --- |
| `dealer/paulina/` | Fotojämförelser, exempelvis sittskala och kortvändning. Äldre prov här utvärderade kropp, fotoyta, handkontakt och rörelse. [Tidigare riggar och tagningar](../information/PAULINAS_PROV.md) |
| `fotomall/` | Skript för den generiska provdockan. [Renderingsskript](fotomall/render.mjs) |
| `bakgrund/` | Pausade rum, panoramor och ljusprov. [Rumsregister](../studio/lib/panorama-rooms.ts) |
| `bord/` | Pausade prov av bordets geometri, layout och material. [Materialregister](../studio/lib/table-finishes.ts) |
| `artefakter/` | Kort, kortsko, markeringar och äldre utdragsprov. Referenskortet används också för stillbilder. [Referenskort](../studio/public/fotomall/kort/referenskort-x-v1.png) |

Den tidigare scenkatalogen med 23 provfamiljer finns i Git. Läs den med `git show d4acb1b:test/README.md` från projektroten. Dess sökvägar utgår från den dåvarande mappen `test/`. Spårade recept kan läsas i samma revision. För flyttade privata resultat används ursprunglig sökväg i arkivets manifest. [Överlämning](../information/HANDOFF.md)

Automatiska tester ligger i `tests/` och `studio/tests/`. Material som Jakob tillför repot har en egen [inkorg](../jakob-random/).
