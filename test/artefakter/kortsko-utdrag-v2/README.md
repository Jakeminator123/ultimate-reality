# Vinklad kortsko och utdrag

[Öppna utdragsprovet med 110° vridning](http://127.0.0.1:4317/bordsprov/skoprov-v2.html). Välj **Visa utan dealer** för att granska öppningen. Välj därefter **Spela kortutdrag** eller stega ruta för ruta. **Handdetalj** behåller ögonpositionen för den valda spelarkameran och använder 12° vertikalt synfält. **Hela bordet** använder grundprovets kamera. [Föregående placering och pose](http://127.0.0.1:4317/bordsprov/skoprov-v1.html)

Skons längdaxel, frontplatta, slits och kort ligger i ett gemensamt lokalt koordinatsystem. Öppningen är vriden −110° runt bordets Y-axel från +Z. Ett 63 × 89 mm kort matas fram genom slitsen. I nio beräknade lägen följer det en bana på 77 mm. Framkanten böjs ned mot filten. När bakkanten passerat mynningen lägger sig hela kortet plant. Filt, mål, rum och kameror följer det tidigare bordsprovet. Framplattans fingerurtag och drag med två fingrar är modellerade efter ett manuellt skouttag. [Dealerutbildarens demonstration](https://www.vegas-aces.com/learn/deal-blackjack-03-handling-the-cards/)

Rörelsen är ett styrt geometriprov. Fingertopparnas avstånd till kortytan och kollisioner med skons yttre volym, kortet och skivan beräknas för varje visad ruta. Friktion, matningen av nästa kort och överlämning till andra handen återstår att prova. Referensbilder och genererade modeller ligger lokalt.

## Återskapa

Kommandona nedan körs från projektroten. De använder samma lokala modell och vilopose som `kortsko-vanster-v1`, labbets SAM-Python och studions pinnade Node.

```powershell
& ..\sam-3d-body\.venv\Scripts\python.exe -B test/artefakter/kortsko-utdrag-v2/utdrag.py
cd studio
node ../test/artefakter/kortsko-utdrag-v2/render.mjs
```
