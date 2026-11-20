# Arbetsytor och prov i Ultimate Reality

För att börja med en dealer, öppna **Fas 1 → Bildpipeline**. Där går det att granska källbilderna innan en kropp eller tagning väljs. [Paulinas stillbilder](PAULINAS_STILLBILDER.md) · [Sidomenyn](../studio/app/StudioSidebar.tsx)

| Arbetsyta | Vad du hittar |
|---|---|
| Översikt | Välj dealer eller börja med en ny. |
| 3D-modellering | Fas 1 visar bildserien. Fas 2 öppnar Paulinas sittmodell v2. Under **Rörelseprov** finns tagningarna och den sparade tvåkortsgiven på v4. [Bildserien](http://127.0.0.1:4317/bildstandard#utgavekontroll) · [Rörelseprov](http://127.0.0.1:4317/modellering/rorelseprov) |
| Scenmiljö | Bakgrund, ljus, bord, kortsko, kort och markeringar. **Bakgrund och ljus → Fotopanorama** öppnar rummen. **Scenprov → Grepp och landning** öppnar provet på bordet. [Scenmiljö](http://127.0.0.1:4317/scenmiljo) |
| Övriga verktyg | Filmutkast, modeller och pris samt startprompter. **Övrigt** samlar tidigare modeller och parkerade försök. |

## Var materialet hör hemma

| Mapp | Lägg här |
|---|---|
| `avatars/<namn>/` | Lokala original och grundvyer. Paulinas valda bildserie ligger i `fas-1/v1/`. `3d/versioner/` innehåller bildregister, kroppar, fotoytor och tagningar med sina källversioner. [Materialversioner](MATERIALVERSIONER.md) |
| `tools/` | Skript för att bygga riggen, lägga foton på kroppen och registrera versioner. [Riggbygge](../tools/mhr_seated_rig.py) · [Fotoyta](../tools/paulina_utseende.py) |
| `studio/` | Användargränssnitt, kameror, filmvisning och API. [Studioplan](../studio/PLAN.md) · [Scenvyernas register](../studio/app/scenmiljo/navigation.ts) |
| `test/` | Scen- och modellförsök under `bakgrund/`, `bord/`, `artefakter/` eller `dealer/<namn>/`. Ett sammansatt prov följer det som prövas. Automatiska tester ligger i `tests/` och `studio/tests/`. [Provkatalog](../test/README.md) |
| `information/` | Beslut, metod, källregister och överlämning. Filmreferensernas register länkar till sin privata lokala mediemapp. [Filmregister](random/blackjack-rorelsereferenser/MATERIAL.md) · [Underhåll och Git](UNDERHALL.md) |

Vid ett synligt fel anger bildgranskaren materialversion och källbild. För en giv tillkommer tagning, stol, kort och ruta, så att samma vy kan öppnas efter rättningen. [Bildgranskarens uppdrag](../.codex/agents/bildgranskare.toml)

## Hur hittar jag rätt version?

| Det du letar efter | Börja här |
| --- | --- |
| Paulinas bildoriginal eller den korrigerade sittprofilen | [Stillbilderna](PAULINAS_STILLBILDER.md) anger källa till geometri, hållning och fotoyta per vy. |
| En viss rigg, ytversion, giv eller handmätning | [Paulinas provkatalog](PAULINAS_PROV.md) tar upp de 46 mapparna under `test/dealer/paulina` och de 13 namngivna GLB-exporterna i avatarmappen. |
| Bordet, kamerorna, rummet eller ett tidigare skoprov | [Scenkatalogen](../test/README.md) täcker 23 provfamiljer och de flyttade offlinevisarna. Delar av äldre ljus- och bordsprov laddas fortfarande direkt av panoramat. |
| Modell-, film- och bildkvitton | I Paulinas versionslager är 3 GLB-filer kroppsgeometrier, 5 fotoytor och 23 animationer. Där finns även 21 MP4 och 16 PNG. Av dessa PNG är 12 bildutgåvans vyer och 4 kontrollrutor som öppnas från de versionsbundna rörelseunderlagen i `information/`. [Materialregistret](MATERIALVERSIONER.md) · [Inläsningen i studion](../studio/lib/dealer-material.ts) |
| Koden bakom en vy eller ett lokalt verktyg | Studions sidor och API har sina ingångar under `studio/app`. Kameraprovets CLI finns under `studio/tools`, de generiska bildrecepten under `studio/fotomall` och provdockans nio bilder under `studio/public/fotomall/docka`. För egna modellprov startar du med [lab.ps1](../lab.ps1) eller [modellverktygen](../tools/). |

De lokala mätningarna i `information/lokalt/` och de tidigare rörelsefilmerna i `information/random/` kompletterar proven. Nya grundbilder väljs från avataren eller labbets inkorg. [Underhåll och gallringsprotokoll](UNDERHALL.md)

Gällande arbetsanvisningar finns i [överlämningen](HANDOFF.md), [Runway-guiden](RUNWAY_DEALER.md) och [underhållet](UNDERHALL.md). De tre äldre lokala dokumenten har daterade filnamn som börjar med `historik-` i `information/lokalt/`. Deras relativa länkar leder till samma underlag som när dokumenten skrevs.
