# Lagring, Git och överlämningar

| Plats | Ägare och innehåll | Livslängd |
| --- | --- | --- |
| `studio/` i Git | Appens källkod, plan och generella recept. | Versionshistorik i Git. |
| `information/` i Git | Beslut, verifierade slutsatser, handoff och tidigare skriftliga projektöversikter. | En aktuell handoff. Äldre versioner finns i Git. |
| `tools/`, `tests/` i Git | Lokala modellverktyg och isolerade tester. | Versionshistorik i Git. |
| `avatars/<dealer>/` lokalt | Bildoriginal, rigg, fotoyta och tagningar. `3d/versioner/aktiv.json` väljer en sparad utgåva. `studio.json` finns kvar för den tidigare Paulina-visaren. | Bevarade avatarversioner på labbdatorn. |
| `inputs/` på labbdisken | Egna källfoton, filmer och ljud som Jakob lägger in. | Original bevaras. |
| `orders/` på labbdisken | Versionssparade lokala utkast med exakt JSON, beskurna referensbilder och filmgranskning, under `giv-plats-4`. | Sparade revisioner bevaras. Verkliga leverantörsjobb är en senare etapp. |
| `orders/bildpipeline/<revision>/` på labbdisken | Runways stillbildsserie, källkopior, låsta prompter, skickade referenser, jobb-ID och mottagna resultat. | Bevarade beställningsrevisioner. Filnamn och referensbytes omfattas av den lokala backupen. |
| `runs/` på labbdisken | Märkta tillfälliga SAM-prov med filinventering och kontrollsummor. | Avslutade prov gallras efter sju dygn vid nästa SAM-körning eller via clean. Modellregistrets källkörningar bevaras. |
| `saved/` på labbdisken | Prov som bevarats med keep. Teknisk referens och visuellt godkännande dokumenteras var för sig. | Bevaras tills ägaren uttryckligen väljer bort dem. |
| `saved/promptmallar/` på labbdisken | Jakobs egna namngivna mallar. Varje sparning skapar en separat JSON-fil med text, modell och längd. | Bevaras vid gallring och ingår i lokal backup. |

På Jakobs dator är labbdisken `D:\ultimate-reality-lab`. Kör `.\lab.ps1 list` från projektroten för att skapa och se grundstrukturen. Tömning av arbetsytan ska aldrig påverka källmaterial, beställningar eller sparade referenser. För ett låst försök, identifiera processen som använder just den filen, avsluta den när arbetet är klart och kör gallringen igen.

För Fas 1 jämför `tools/seated_photo_scale.py` de tre PNG-filerna med bildregistret och skriver `sittande-bildskala.json` i samma utgåva. `tools/mhr_seated_rig.py` skapar sittmodellen från den sparade SAM-körningen och `tools/paulina_utseende.py` lägger de granskade fotografiska källorna på riggen. [Köranvisning och material-ID](../test/dealer/paulina/fas1-sittande-v2/README.md)

## Vad ska till GitHub?

Registrerade foton, GLB-filer och filmer ligger under avatarens lokala `3d/versioner`. Källrelationer och tidigare val följer med en lokal säkerhetskopia av avatarens mapp. Projektkoden kan återskapa visningen från den kopian. [Versionshantering och köranvisning](MATERIALVERSIONER.md)

Bildserie, kropp och tagning har egna versionsnummer. Paulinas `fas-1/v1` är fortfarande den valda bildserien. Dess `bildregister.json` anger `fotounderlag-v2.json` som källa, och det underlaget länkar vidare till `fotounderlag-v1.json`. I `test/artefakter` namnges varje försök efter frågan det undersöker. `skolage-v1` mäter platsen för skon medan `skolage-vilohand-v1` jämför handen med skon i två givfilmer. Vid städning kan en förkastad arbetsfil tas bort när registren, proven och deras källhänvisningar har kontrollerats mot filens exakta version. [Paulinas lokala mappguide](../avatars/paulina/README.md)

- Versionshantera källkod, delade agentinstruktioner, tester, generella recept, beroendelåsfil, exempelfält utan hemligheter och korta textbeslut. Dela reproducerbara anvisningar och anonyma testdata.
- Håll källfoton, filmer, mesh, modellvikter, råa Runway-beställningar och svar, leverantörslänkar, tokens, arbetskopior, byggresultat, cache och lokala IDE-inställningar på datorn. Git-reglerna finns i rotens `.gitignore`.
- Inför en push, kontrollera `git remote -v`, aktuell branch och de commits som ska överföras. Granska ändringarna med `git diff --cached --name-status` före commit. Kontrollera ett tveksamt filnamn med `git check-ignore -v -- <fil>`. En ignore-regel omfattar bara ospårade filer. En push omfattar även redan committad historik.
- GitHub synkroniserar projektfiler. Vercel-publicering, Runway-beställning och radering av lokalt källmaterial är separata handlingar.

## När en agent tar över

Vid varje handoff uppdaterar agenten först `information/HANDOFF.md` och ger samma korta lägesbild i chatten. Ange vad som faktiskt har provats, vilken anslutning det gäller (Runway API eller MCP), om en film har beställts och vilken lokal kontroll som är nästa steg. En importerad films manuellt angivna källa hör till den sparade granskningen.

**Lokal konfiguration.** Lagra servernyckeln i studiokatalogens ignorerade `.env.local`. Kontrollera anslutningen via studions statusvy. Värden och privata maskinanteckningar stannar lokalt.

**Blob.** Lagringen är lokal. Om projektet senare behöver Blob, skapa då en egen butik och en egen behörighet för Ultimate Reality.

Uppdatera [HANDOFF.md](HANDOFF.md) på samma plats. Skriv vilket mål ni arbetar mot, vad som faktiskt körts, senaste beslut, öppet fel och nästa konkreta kontroll. Använd relativa repo­sökvägar och material-ID. Om en preview eller extern beställning lever vidare, ange var den nås och vem som äger den. Skriv hemligheter i den lokala miljön och håll handoffen fri från tokens och signerade länkar.

## Automatisk gallring

Vid nästa `.\lab.ps1 sam` körs samma gallring som med `.\lab.ps1 clean`. `--dry-run` till clean skriver en rad per disponibel fil. Labblåset hindrar samtidiga labbkommandon. Ett öppet filhandtag med exklusiv åtkomst knyter kontrollsumma och borttagning till samma fil på den lösta Windows-sökvägen. En låst fil bevaras.

- För SAM krävs avslutad status, minst sju dygn sedan avslut, filinventering från producenten och oförändrade bytes. En okänd fil i körningen, en saknad äldre inventering eller en modell som anger körningen som källa bevarar körningen. Kontrollera `inputs`, `orders` och `saved` med `.\lab.ps1 list`.
- En Python-cache i projektets `tools`, `tests` eller `test` gallras när färsk kompilering av motsvarande källfil ger exakt samma bytes. Okända filer i cachemappen behålls.
- För ett nytt filmprov kör producenten tagningens ordinarie registreringsrecept genom `.\lab.ps1 finish-trial <dealer> <tagning> <mellanmapp> --register <recept.py>`. Kommandot håller labblåset under registreringen och gallrar mellanexporterna när receptet är färdigt och lyckades. Låt först alla producenter som skriver i mellanmappen avsluta sina jobb. Kvitto, tagningens rot och innehållsadresserad lagring måste alla stämma för varje aktuell GLB/MP4. Mellanmappen är `utprovning` eller `filmprov-<rörelsehash>`. Bildrutor och mätkvitton har egna sökvägar.
- För en redan registrerad tagning räcker `.\lab.ps1 finish-trial <dealer> <tagning> <mellanmapp>`. Lägg till `--dry-run` för att se exakt vad som kan gallras. Ett torrprov kör aldrig registreringsreceptet. Ett avbrutet avslut kan köras igen.

### Kontroll den 20 november 2026

Första torrprovet hittade noll gamla SAM-körningar. Efter gallringen fanns alla nio sparade körningar kvar.

| Material | Borttagning |
| --- | --- |
| `test/dealer/paulina/giv-sam-v4-v5/filmprov-4ad4120c/` | `paulina-giv-sam-v4-v5.glb` och `giv-sam-v4-v5.mp4`, tillsammans 31 765 450 byte. Båda var byteidentiska med tagningens rot och registrerade original. |
| `test/dealer/paulina/giv-sam-v4-v6/utprovning/` | Producenten kasserade en tidigare utprovning. `paulina-giv-sam-v4-v6.glb` (`74015411d13c0c9516d09d182dd0dd1df60729d4919c5323146de4df54b19f0a`) och `giv-sam-v4-v6.mp4` (`a234577f2f74e4619ce36532f4ca105bfa5819eb0573e52f1d4baecf1d5f8317`) flyttades till Windows papperskorg genom ett separat hashbundet beslut. Återställningsplats och båda filernas bytes verifierades där. `ruta-53.png`, `capture.json` och mätningarna finns kvar i mellanmappen. |
| Python 3.11 | 16 reproducerade `.pyc`-filer, tillsammans 410 536 byte. I `tools` gallrades `paulina_utseende`. I Paulinas prov gallrades `fas1-sittande-v2/granska`, `giv-sam-v4-v2/bygg`, `giv-sam-v4-v4/{jamfor_vila,retur}`, `giv-sam-v4-v5/bygg_redo`, `kortdrag-v2-v1/bygg`, `samspel-v2-v4/bygg`, `tvahandsgiv-v2-v1/{bygg,fingeryta}`, `tvahandsgiv-v2-v2/lagt_byte`, `tvahandsgiv-v2-v3/{bygg_hand,handform}` och `tvahandsgiv-v2-v4/{bygg_tryck,grepp,kort}`. Varje fil låg under respektive provs `__pycache__` med ändelsen `.cpython-311.pyc`. |

Den registrerade v6-rörelsen börjar med `62ebe398` och filmen med `2b2e4dcc`. V7 anger den registrerade rörelsen som källa. Före kasseringen jämfördes de två utprovningarnas ursprung, SHA-256 och användning i källkedjorna. Nya materialtyper behöver en ägare och en gallringsregel. Bevarade media behöver separat backup för att tåla diskfel.
