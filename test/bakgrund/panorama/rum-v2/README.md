# Fem miljöer i fotopanoramaspåret

Fotopanorama är det första officiella bakgrundsspåret under Scenmiljö. Samma rumsregister fyller studions rumssida och visaren. Förhandsbilderna är 960 × 540 px och tagna i respektive rum utan bord. [Rumsregister](../../../../studio/lib/panorama-rooms.ts) · [Rumssida](http://127.0.0.1:4317/scenmiljo/bakgrund/fotopanorama)

| Miljö | Startvy | Prova med bordet |
| --- | --- | --- |
| [Brown Photostudio 01](https://polyhaven.com/a/brown_photostudio_01) | [Soffa och fönster](fotostudio.jpg) | [Stol 4](http://127.0.0.1:4317/bordsprov/panorama/fotostudio?stol=4&vy=paulina) |
| [Studio Kontrast 04](https://polyhaven.com/a/studio_kontrast_04) | [Vit studiovägg med softbox till höger](kontraststudio.jpg) | [Stol 4](http://127.0.0.1:4317/bordsprov/panorama/kontraststudio?stol=4&vy=paulina) |
| [Gothic Manor 02](https://polyhaven.com/a/gothic_manor_02) | [Herrgårdens två torn, mur och torra gräs](gothic-manor.jpg) | [Stol 4](http://127.0.0.1:4317/bordsprov/panorama/gothic-manor?stol=4&vy=paulina) |
| [Abandoned Factory Canteen 02](https://polyhaven.com/a/abandoned_factory_canteen_02) | [Öppen fabriksmatsal med breda fönster och frilagt innertak](fabriksmatsal.jpg) | [Stol 4](http://127.0.0.1:4317/bordsprov/panorama/fabriksmatsal?stol=4&vy=paulina) |
| [Lythwood Lounge](https://polyhaven.com/a/lythwood_lounge) | [Soffor och eldstad](lounge.jpg) | [Stol 4](http://127.0.0.1:4317/bordsprov/panorama/lounge?stol=4&vy=paulina) |

Varje HDR-fil omfattar 4096 × 2048 px. De tre tillagda vyerna använder nedanstående Poly Haven-original i `test/bakgrund/polyhaven/`. Kontraststudion återanvänder labbets verifierade original. [Källor för de två tidigare miljöerna](../README.md#de-ursprungliga-två-miljöerna) · [Poly Havens CC0-licens](https://polyhaven.com/license)

| Original | Byte | SHA-256 |
| --- | ---: | --- |
| [studio_kontrast_04_4k.hdr](https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/studio_kontrast_04_4k.hdr) | 24 116 215 | `d21c1aa8efa72d97f77dc77213e3b7f0fa8f3f295ad6fbfff35e2adc63b69bb7` |
| [gothic_manor_02_4k.hdr](https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/gothic_manor_02_4k.hdr) | 25 639 283 | `f38d5a2ad8477555262422e1a732a58838092a56c34f86a87e0ffa48aa297eb6` |
| [abandoned_factory_canteen_02_4k.hdr](https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/abandoned_factory_canteen_02_4k.hdr) | 25 764 581 | `cea55a00d336f2cc1fb02134f127b1fc63d399e58246f50c1756c2cd7d4f4ddb` |

För att återskapa rumssidans förhandsbilder, starta studion på port 4317 och kör `node ../test/bakgrund/panorama/rum-v2/forhandsvisningar.mjs` från `studio/` med dess Volta-version. Bilderna och HDR-originalen lagras lokalt.
