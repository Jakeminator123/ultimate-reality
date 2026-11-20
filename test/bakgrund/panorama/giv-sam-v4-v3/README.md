# Paulinas SAM-sittmodell v4 vid BORD-02

I **Scenmiljö → Bakgrund och ljus → Fotopanorama → Gothic Manor 02**, öppna **Paulinas giv till plats 4** för den aktuella granskade tagningen på SAM-sittmodell v4. **SAM-sittmodell v4 · givprov 3** öppnar alltid den frysta versionen med den här ögonpassningen. Både stol och bildruta följer med när du väljer tagning. [Aktuell giv](http://127.0.0.1:4317/bordsprov/panorama/gothic-manor?stol=4&vy=giv) · [Prov 3 från stol 4](http://127.0.0.1:4317/bordsprov/panorama/gothic-manor?stol=4&vy=giv&tagning=giv-sam-v4-v3) · [Prov 3 från stol 1](http://127.0.0.1:4317/bordsprov/panorama/gothic-manor?stol=1&vy=giv&tagning=giv-sam-v4-v3)

Panoramat hämtar aktuell v4-tagning från `sittmodellprov.json` via studions materialregister. Kropp och fotoyta kontrolleras mot källbilder och modellkvitton. Filmkvittot knyter ihop rörelse, MP4 och granskade rutor från stol 4 och stol 1. När ett senare prov uppfyller dessa villkor visas det först i menyn tillsammans med prov 3. En kopierad spelaradress anger tagningen som faktiskt spelas.

Från båda stolarna spelade `giv-sam-v4-v3` ruta 0–53 vid 24 bilder/s. SHA-256 på modellsvaret i vardera webbläsarvyn matchade den registrerade rörelsen. Knapparna öppnade utskjut 4, handbyte 9, vändning 16, landning 22 och blinkning 46. Byte av stol på ruta 46 behöll SAM-tagningen. Den äldre v2-tagningens sparade länk öppnade `samspel-v2-v4` på samma ruta, och val av SAM-sittmodellen öppnade SAM-tagningen igen. [Registrering med båda stolgranskningarna](../../../dealer/paulina/giv-sam-v4-v3/registrering.json)

| Händelse | Stol 4 | Stol 1 |
| --- | --- | --- |
| Handbyte, ruta 9 | Kortkanten syns mellan händerna. | Handleden skymmer greppet vid skon. |
| Landning, ruta 22 | Spader två ligger plant på plats 4. Fingrarna täcker en del av kortet. [Bild](stol-4-ruta-22.png) | Samma värdesida och placering syns snett från sidan. [Bild](stol-1-ruta-22.png) |
| Blinkning, ruta 46 | Båda ögonlocken är slutna. Ytterlocket är mörkt även i originalet. [Bild](stol-4-ruta-46.png) | Det närmaste ögats blinkning syns tydligast. [Bild](stol-1-ruta-46.png) |

Bildgranskaren kontrollerade öppna ögon i ruta 43 och 51 från båda stolarna. I slutruta 53 ligger kortet kvar och vänsterhanden är tillbaka vid skon. Originalets avslappnade slutläge med båda händerna på filten finns i ruta 38 av `pos4-v.mp4`. [Skoläge och jämförelse av slutposer](../../../artefakter/skolage-vilohand-v1/README.md)

### Slutposen i panorama och registrerad film

I ruta 53 håller Paulina vänsterhanden vid SKO-03 och höger handflata upp. Stol 4 visar båda händerna. Från stol 1 överlappar de i både panorama och film. Spader två ligger fritt på plats 4. Bakgrunden, filtens ljushet och skuggorna skiljer sig åt mellan renderingarna. [Kamerapar jämfört med avkodad MP4-ruta 53](slutpose-ruta-53-panorama-och-film.jpg) · [Panorama stol 4](stol-4-ruta-53.png) · [Panorama stol 1](stol-1-ruta-53.png)

| Ledcentrum i ruta 53 | Vänster, höjd över filtplanet | Höger, höjd över filtplanet |
| --- | ---: | ---: |
| Handled | 178,8 mm | 70,3 mm |
| Armbåge | 160,5 mm | 114,0 mm |

Mätningen läste världsmatriserna för `l_wrist`, `r_wrist`, `l_lowarm` och `r_lowarm` när panoramaspelaren gick från ruta 52 till 53. Världskoordinaterna i båda stolsvyerna stämde med filmunderlagets fyra leder inom 0,01 mm per axel. Y = 0 är filtplanet. Höjderna avser skelettledernas centrum. Jämförelsebildens nedre kameravyer är hämtade från den registrerade MP4-filens sista avkodade ruta, 53 av 0–53. [Filmunderlagets mätning](../../../dealer/paulina/giv-sam-v4-v3/matt.json)

| Underlag | SHA-256 |
| --- | --- |
| SAM-kropp v4 | `fc3b1388104fed3ee82a9ac0f548e4cf36d9a71fdb98a43c4890fb4a879ac495` |
| Fotoyta med ögonpassning | `5c30d34f2f5f4eece06af94d7477685a8608741f214e3caacd3a1757fd01296c` |
| Givens GLB | `9fe46a6d7b8fc2fff684c0a7fd032c8ae28015e8d332374b7918601faf2905e8` |
| Filmkvitto | `71d78d156fd0597d7c1818ad1d624910b3469a25c3e1fa8a41062cb6f68ca03e` |
| MP4 | `54cacc71f181979c57c932283f564e0b0861b058b26d4fabfd250b843251d132` |
| Kortbana för KORT-02 | `bd7dfe08da0bd3b4928082120a5aa52f6610b432791a20364f3d50e09590a524` |
