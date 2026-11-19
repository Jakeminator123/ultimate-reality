# Lagring, Git och överlämningar

| Plats | Ägare och innehåll | Livslängd |
| --- | --- | --- |
| `studio/` i Git | Appens källkod, plan och generella recept. | Versionshistorik i Git. |
| `information/` i Git | Beslut, verifierade slutsatser, handoff och tidigare skriftliga projektöversikter. | En aktuell handoff. Äldre versioner finns i Git. |
| `tools/`, `tests/` i Git | Lokala modellverktyg och isolerade tester. | Versionshistorik i Git. |
| `inputs/` på labbdisken | Egna källfoton, filmer och ljud som Jakob lägger in. | Original bevaras. |
| `orders/` på labbdisken | Versionssparade lokala utkast med exakt JSON, beskurna referensbilder och filmgranskning, under `giv-plats-4`. | Sparade revisioner bevaras. Verkliga leverantörsjobb är en senare etapp. |
| `runs/` på labbdisken | Märkta tillfälliga SAM-prov. | Sju dygn, gallring vid nästa SAM-körning eller via clean. |
| `saved/` på labbdisken | Prov som bevarats med keep. Teknisk referens och visuellt godkännande dokumenteras var för sig. | Bevaras tills ägaren uttryckligen väljer bort dem. |
| `saved/promptmallar/` på labbdisken | Jakobs egna namngivna mallar. Varje sparning skapar en separat JSON-fil med text, modell och längd. | Bevaras vid gallring och ingår i lokal backup. |

På Jakobs dator är labbdisken `D:\ultimate-reality-lab`. Kör `.\lab.ps1 list` från projektroten för att skapa och se grundstrukturen. Tömning av arbetsytan ska aldrig påverka källmaterial, beställningar eller sparade referenser. För ett låst försök, identifiera processen som använder just den filen, avsluta den när arbetet är klart och kör gallringen igen.

## Vad ska till GitHub?

- Versionshantera källkod, delade agentinstruktioner, tester, generella recept, beroendelåsfil, exempelfält utan hemligheter och korta textbeslut. Dela reproducerbara anvisningar och anonyma testdata.
- Håll källfoton, filmer, mesh, modellvikter, råa Runway-beställningar och svar, leverantörslänkar, tokens, arbetskopior, byggresultat, cache och lokala IDE-inställningar på datorn. Git-reglerna finns i rotens `.gitignore`.
- Inför en push, kontrollera `git remote -v`, aktuell branch och de commits som ska överföras. Granska ändringarna med `git diff --cached --name-status` före commit. Kontrollera ett tveksamt filnamn med `git check-ignore -v -- <fil>`. En ignore-regel omfattar bara ospårade filer. En push omfattar även redan committad historik.
- GitHub synkroniserar projektfiler. Vercel-publicering, Runway-beställning och radering av lokalt källmaterial är separata handlingar.

## När en agent tar över

Vid varje handoff uppdaterar agenten först `information/HANDOFF.md` och ger samma korta lägesbild i chatten. Ange vad som faktiskt har provats, vilken anslutning det gäller (Runway API eller MCP), om en film har beställts och vilken lokal kontroll som är nästa steg. En importerad films manuellt angivna källa hör till den sparade granskningen.

**Lokal konfiguration.** Lagra servernyckeln i studiokatalogens ignorerade `.env.local`. Kontrollera anslutningen via studions statusvy. Värden och privata maskinanteckningar stannar lokalt.

**Blob.** Lagringen är lokal. Om projektet senare behöver Blob, skapa då en egen butik och en egen behörighet för Ultimate Reality.

Uppdatera [HANDOFF.md](HANDOFF.md) på samma plats. Skriv vilket mål ni arbetar mot, vad som faktiskt körts, senaste beslut, öppet fel och nästa konkreta kontroll. Använd relativa repo­sökvägar och material-ID. Om en preview eller extern beställning lever vidare, ange var den nås och vem som äger den. Skriv hemligheter i den lokala miljön och håll handoffen fri från tokens och signerade länkar.

Vid underhåll, börja med `.\lab.ps1 clean --dry-run`. Kontrollera sedan att ingångar, orderoriginal och sparade prov finns kvar. Nya materialtyper får en uttalad ägare och gallringsregel innan automatisk radering läggs till. Separat backup av bevarade media behövs om de ska tåla diskfel.
