# Paulinas tidigare kroppar och prov

**Den nya modellen börjar med en stilla kropp och fotounderlaget.** Sittfronten anger posen, trekvart och vald profil används för att granska samma kropp. De äldre SAM-resultaten, animationerna och filmerna hör till det återställbara lokala arkivet. [Fotostarten](../avatars/paulina/fotostart/index.html) · [Arkiv och återställning](HANDOFF.md)

## Varför fanns flera riggar?

SAM skattade kropp och pose separat för varje inmatad sittbild. Bildvinkeln och de skymda kroppsdelarna gav olika resultat. I riggbygget användes frontens kropp med 127 leder som bas. För övre rygg, nacke och huvud vägdes profilens skattade vinklar till 80 % och trekvartens till 20 %. Bilder av kropp, ansikte och handryggar bidrog sedan till färgen på samma yta. [Riggbygget](../tools/mhr_seated_rig.py) · [Fotoytans bygge](../tools/paulina_utseende.py)

| Tidigare material | Roll i den tidigare studion |
| --- | --- |
| Bild 08, sittfront v1, sittmodell v2 och v3 | Alternativ för olika sittposer och ombyggnader. V2 var förvald i modellvisaren. V3 användes för jämförelse med ny profil. |
| Sittmodell v4 | Kroppen i tvåkortsgiven. Flera exportfiler kunde innehålla samma skelett med ändrat utseende eller en annan rörelse. |
| Givprov 8 och 9 | Två klipp på v4 spelades efter varandra. Stol 1 och stol 4 visade samma giv från olika kameror. |

## Hitta ett äldre prov

Den fullständiga katalogen från den 20 november 2026 beskriver 46 provmappar under `test/dealer/paulina/` och 13 namngivna GLB-exporter under `avatars/paulina/3d/`. Läs den med `git show d4acb1b:information/PAULINAS_PROV.md` från projektroten. Katalogens filvägar utgår från den dåvarande arbetskopian. För privata filer, sök på den ursprungliga sökvägen i arkivets manifest. Äldre länkar till 4317 beskriver studion före omstarten. [Aktuell överlämning](HANDOFF.md)
