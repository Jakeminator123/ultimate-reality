# Arbetsytor och prov i Ultimate Reality

Studions meny följer det som Jakob arbetar med. En specialvy ligger under den arbetsyta vars material den visar. OMVAG ansvarar för navigation, namn, visuell hierarki och länkar. [Sidomenyn](../studio/app/StudioSidebar.tsx)

| Arbetsyta | Innehåll och ansvar |
|---|---|
| Översikt | Välj dealer eller börja med en ny. |
| 3D-modellering | Fas 1 samlar bildpipeline och fotostandard. Fas 2 visar den sittande modellen. Under **3D-modell → Rörelseprov** jämförs händer, ansikte och samspel i samma rigg. **Ta över Ultimate Reality-arbetet** äger modellregister, filmvisning och kameror. [Rörelseprov](http://127.0.0.1:4317/modellering/rorelseprov) |
| Scenmiljö | **BB** äger bakgrund och ljus, bord och kortsko samt kort och markeringar. **Bakgrund och ljus → Fotopanorama** öppnar rummen. **Scenprov → Grepp och landning** öppnar det redigerbara provet på bordet. [Scenmiljö](http://127.0.0.1:4317/scenmiljo) |
| Övriga verktyg | Filmutkast, modeller och pris samt startprompter. **Övrigt** samlar tidigare modeller och parkerade försök. |

## Var materialet hör hemma

| Mapp | Lägg här |
|---|---|
| `test/` | Scen- och modellförsök under `bakgrund/`, `bord/`, `artefakter/` eller `dealer/<namn>/`. Ett sammansatt prov följer det som prövas. Automatiska tester ligger i `tests/` och `studio/tests/`. [Provkatalog](../test/README.md) |
| `avatars/<namn>/` | Dealerns lokala original, grundvyer och registrerade utgåvor. `3d/versioner/aktiv.json` väljer den aktiva modellen. [Materialversioner](MATERIALVERSIONER.md) |
| `information/` | Beslut, metod, källregister och överlämning. Filmreferensernas register länkar till sin privata lokala mediemapp. [Filmregister](random/blackjack-rorelsereferenser/MATERIAL.md) · [Underhåll och Git](UNDERHALL.md) |

När BB lämnar en ny officiell scenyta till OMVAG följer syfte, material-ID, källversion och länk med. OMVAG placerar den där Jakob söker materialet och kontrollerar att länken fungerar. [Scenvyernas register](../studio/app/scenmiljo/navigation.ts)
