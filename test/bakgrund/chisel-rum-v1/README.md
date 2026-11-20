# Granska ett kasinorum med Marble och Chisel

[Se planritningen med de två spelarkamerorna](rumsplan.png).

[Den färdiga rumsskissen](kasinosalong-blockout.glb) använder meter, Y upp, golv vid −0,75 m och samma origo som bordets filt. Invändiga provmått är 7,10 × 7,00 m med 3,60 m takhöjd. Öppningen i bakväggen är 1,20 × 2,20 m. Det finns en pelare bakom bordets plats. Rummets mitt är tom så att studions eget bord, kortsko, kort och dealer kan placeras där.

1. Öppna Marble, välj **3D** och starta **Chisel**. Ladda upp skissen som GLB. Kontrollera en känd dimension, exempelvis dörrens bredd, innan du ändrar skalan. Väggverktyget kan också användas för att dra om väggar och dörröppningar. [Chisel basics](https://docs.worldlabs.ai/marble/create/chisel-tools/chisel-basics)
2. Placera panoramakameran i den fria spelytan nära bordets mitt med provhöjden 1,20 m över golvet. Den ger Marble ett underlag för genereringen. Spelarkamerorna återanvänds senare från studion. Lägg till rumsprompten nedan och välj **Generate** i ditt Marble-konto. [Chisel basics](https://docs.worldlabs.ai/marble/create/chisel-tools/chisel-basics)
3. Granska världen från front och sida. Följ pelarens förskjutning framför dörren. Leta efter tomrum, dubbla möbler och belysning som byter riktning mellan vyerna. Jämför samma utsnitt med [det lokala HDRI-provet](http://127.0.0.1:4317/bordsprov/ljusprov.html).
4. Gratisplanen kan prova text, en bild eller panorama. Prislistan tar upp Chisel även under Free. Hjälpsidan anger Standard för generering från en 3D-layout. Möjligheten på gratiskontot är obekräftad. Standard omfattar SPZ/PLY-splats, panorama och kollisionsmesh. Pro omfattar högkvalitativ texturerad GLB. Se [jämförelsen mellan prislistan och användarvillkoren](../kasinorum-v1/README.md#browseragentens-world-labs-uppgifter) för kommersiell användning. Studion har en Three.js-laddare för GLB. En splat kräver en kompatibel renderare, till exempel Spark. [Planvillkor](https://docs.worldlabs.ai/marble/support/account-billing) · [Export och integration](https://docs.worldlabs.ai/marble/export/gaussian-splat)

**Rumsprompt att prova**

> An intimate private casino salon with walnut wall panels, pale limestone, warm brass sconces and a matte woven floor. Preserve the room layout, doorway and foreground column. Keep the central playing area empty and level. Place lounge furniture only along the distant walls. A broad soft key comes from camera left. No people, gaming tables, cards, chips, lettering or mirrors.

## HDRI och 3D för spelarvyerna

En HDRI för det här ändamålet är ett 360-gradersfoto med ett stort ljusomfång. Fotot ger bordets material ljus och reflexer och kan även visas bakom bordet. När spelarkameran flyttas i sidled behöver närliggande möbler egen geometri för att skymma varandra med rätt djup. Använd gärna ett foto för den avlägsna miljön. [Poly Havens interiörer](https://polyhaven.com/hdris/interiors) · [Three.js om miljöer](https://threejs.org/docs/pages/Scene.html)

En Gaussian splat beskriver rummets utseende med många små färgade element placerade i 3D. Det passar när man vill kunna förflytta kameran inne i ett fotograferat eller genererat rum. En texturerad mesh har i stället ytor som går att mäta och bearbeta i ett 3D-verktyg. För Marble-provet är den viktigaste kontrollen om samma pelare täcker rätt del av dörren från båda spelarplatserna. För HDRI-provet är det om ljusets riktning och färg på relingen stämmer med rummet. [World Labs exportguide](https://docs.worldlabs.ai/marble/export/gaussian-splat)

Rum och bord kan utvecklas var för sig. Kontrollera dem tillsammans när skala, golvhöjd, kameror eller ljusriktning ändras. Prova dealer, sko och kort tillsammans vid varje ändring av öppning eller grepp. Det lokala skissutkastet går att återskapa med `blockout.py` i en Pythonmiljö med trimesh och NumPy.
