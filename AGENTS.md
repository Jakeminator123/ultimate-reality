# Arbete i Ultimate Reality

Läs [README](README.md), [studioplanen](studio/PLAN.md) och [aktuell överlämning](information/HANDOFF.md). De tre filerna räcker för att fortsätta arbetet i Codex, Cursor, Claude Code och andra verktyg.

- Börja sökningar med Git-spårade källfiler eller vanlig `rg`. Läs privata labbresultat, arkiv, låsfiler, genererade visare och binärmedia när uppgiften pekar ut ett konkret underlag. Kontrollera miljönycklars närvaro via serverns status. Lägg aldrig deras värden eller kompletta miljöfiler i agentkontexten.

- Arbeta från denna projektrot. Hitta återanvändbara grundbilder i `avatars/<namn>/`. Börja nya försök med dem, material som Jakob tillför labbets `inputs`, material som skapas här eller en identifierad version i `saved`. Hämta aldrig försöksmaterial ur arkiv, andra dealerrepon eller gamla körningar på datorn. Rapporterna i `information/other-projects` är historik.
- Behåll originalet. Ge den redigerade filen egen version och ange källversion. Registrera exakt kamera, kort, tagning och bildruta när du drar en slutsats om grepp eller placering.
- En Runway-beställning ska gå genom studions synliga beställningsvy. Utkast, import och granskning har inga externa sidoeffekter. Ett verkligt anrop använder den revision användaren har valt att skicka. Vid osäkert svar, kontrollera det befintliga jobbet innan ett nytt skapas.
- Läs [modell- och promptguiden](information/RUNWAY_DEALER.md) för arbete med dealerfilm. Slå själv upp modellens aktuella referensfält och pris i Runway Dev vid modellval eller ändrade utkast. Använd `runway-dev-models` när den är tillgänglig. Guiden länkar till de publika agentdokumenten. Välj referenser för det synliga felet och skilj dokumenterade modellegenskaper från provade resultat i labbet.
- Läs [underhåll och Git](information/UNDERHALL.md) innan lagringsändringar, städning eller publicering. Uppdatera handoffen när någon annan ska ta över. Skriv första återstående handling, kontrollresultat och exakt material-ID.
- Kontrollera Git-status före redigering. Bevara andra agenters ändringar. Kör relevanta tester från den här roten. När Node-projektet införs, läs dess engines och versionspinne och kontrollera vald process.version. Avsluta verifieringsprocesser som du själv startat och identifierat.

Claude Code kan importera samma regler via rotens `CLAUDE.md`. Cursor läser `AGENTS.md` i projektroten. [Claude Code](https://code.claude.com/docs/en/memory) · [Cursor](https://cursor.com/docs/rules)
