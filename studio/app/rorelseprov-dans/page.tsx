import path from "node:path";
import { stat } from "node:fs/promises";
import { ArrowLeft } from "lucide-react";
import { danceOrderUrl, danceSeries } from "../../lib/dance-order";
import { filmOrder } from "../../lib/runway-film-revisions";
import DanceFilms from "./DanceFilms";
import common from "../giv-plats-4/deal.module.css";
import styles from "./dance.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paulinas dansprov · Dealerstudio" };
const folder = "avatars/paulina/rorelseprov-dans/v1";
const edition = "/rorelseprov-dans/v1/";

async function available(name: string) {
  const file = path.resolve(process.cwd(), "..", folder, name);
  return stat(/* turbopackIgnore: true */ file).then(details => details.isFile()).catch(() => false);
}

export default async function Page() {
  const [photo, reference, result, mesh, comparison, eyes] = await Promise.all([
    available("referenser/paulina.png"), available("visning/rorelsereferens.mp4"),
    available("runway/resultat.mp4"), available("rigg/dans-med-blink.glb"),
    available("granskning/samma-tid.jpg"), available("granskning/blinkning.jpg"),
  ]);
  let resultUrl = result ? edition + "resultat.mp4" : null;
  if (reference && !resultUrl) {
    const order = await filmOrder(1, danceSeries).catch(() => null);
    if (order?.result) resultUrl = danceOrderUrl + "?v=1&original=1";
  }
  return <main className={common.main + " " + styles.page}>
    <nav><a className={common.back} href="/giv-plats-4/v4"><ArrowLeft size={16} aria-hidden /> Till Paulinas giv</a></nav>
    <header className={common.header}><h1>Paulinas dansprov</h1></header>
    <p>Ståfotot ger Paulina hennes utseende. En fyra sekunder lång film från hennes 3D-rigg visar rörelsen.</p>
    {reference ? <DanceFilms resultUrl={resultUrl} /> : <p>Rörelsefilmen läses från labbdatorn när renderingen är klar.</p>}
    {result && comparison && <p>I ruta 64 når båda hoppen sin högsta punkt. Kling beskär hjässan och Paulinas vänstra
      hand vid hoppet. I ruta 12 sluts riggens ögon helt och i Kling-filmen syns en smal öppning mellan ögonlocken.</p>}
    <nav className={common.references + " " + styles.links} aria-label="Dansprovets material">
      {photo && <a href={edition + "paulina.png"}>Se ståfotot som skickas till Runway</a>}
      {reference && <a href={edition + "rorelsereferens.mp4"}>Öppna riggens rörelsefilm</a>}
      {mesh && <a href={edition + "dans-med-blink.glb"} download="paulina-dans-v1.glb">Hämta den animerade 3D-modellen</a>}
      {resultUrl && <a href={resultUrl}>Öppna hela Kling-filmen</a>}
      {comparison && <a href={edition + "samma-tid.jpg"}>Jämför åtta ögonblick sida vid sida</a>}
      {eyes && <a href={edition + "blinkning.jpg"}>Se blinkningen i närbild</a>}
      {reference && <a href="/rorelseprov-dans/bestallning">Öppna beställningen</a>}
    </nav>
  </main>;
}
