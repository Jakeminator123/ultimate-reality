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
