"use client";

import { useEffect, useState } from "react";
import FilmOrderPanel from "../../FilmOrderPanel";
import { danceDraftUrl, danceOrderUrl, dancePrompt, danceSeconds, type DanceDraftState } from "../../../lib/dance-order";
import { draftSettings } from "../../../lib/model";
import { money, priceSource, quote } from "../../../lib/runway-prices";
import styles from "./order.module.css";

async function readState(response: Response): Promise<DanceDraftState> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Filmversionen kunde inte öppnas.");
  return data;
}

export default function DanceOrder() {
  const [choice, choose] = useState<number | null>(null);
  const [state, setState] = useState<DanceDraftState>();
  const [prompt, setPrompt] = useState(dancePrompt);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError("");
    const url = danceDraftUrl + (choice === null ? "" : "?v=" + choice);
    fetch(url, { cache: "no-store", signal: controller.signal }).then(readState).then((next) => {
      if (controller.signal.aborted) return;
      setState(next);
      setPrompt(next.selected?.prompt ?? dancePrompt);
    }).catch((err: Error) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [choice]);

  const version = state?.selected?.version ?? 0;
  const dirty = !version || prompt !== state?.selected?.prompt;
  const { model, rate } = draftSettings("kling_4", "1080p");
  const estimate = quote(model, rate, danceSeconds, state?.selected?.motionSeconds ?? danceSeconds);
  const assetUrl = (asset: "photo" | "motion") => danceDraftUrl + "?asset=" + asset + "&v=" + version;

  async function save() {
    if (!state || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await readState(await fetch(danceDraftUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, base: state.versions[0] ?? 0, parent: version }),
      }));
      setState(next);
      choose(next.selected!.version);
    } catch (err) { setError(err instanceof Error ? err.message : "Filmversionen kunde inte sparas."); }
    finally { setBusy(false); }
  }

  return <section className={styles.order} aria-label="Kling 4.0 · rörelsereferens">
    <div className={styles.material}>
      <figure><figcaption>Paulinas startbild</figcaption>
        <img src={assetUrl("photo")} alt="Paulina i sitt stående originalfoto" /></figure>
      <figure><figcaption>Rörelse från 3D-riggen</figcaption>
        <video src={assetUrl("motion")} controls playsInline preload="metadata" /></figure>
    </div>
    <div className={styles.settings}>
      <label>Filmversion
        <select value={version} disabled={busy} onChange={event => choose(Number(event.target.value))}>
          <option value={0}>Nytt utkast från rörelseprov v1</option>
          {state?.versions.map(id => <option value={id} key={id}>Version {id}</option>)}
        </select>
      </label>
      <p><strong>{model.name} · 1080p · {danceSeconds} s</strong><br />
        Stående format från startbilden. Fyra sekunder rörelsereferens.</p>
      <p>Beräknad kostnad är <strong>{estimate.credits} API-krediter</strong> ({money(estimate.credits)} före skatt).
        {" "}<a href={priceSource} target="_blank" rel="noreferrer">Runways prislista</a></p>
      <label>Rörelsebeskrivning
        <textarea value={prompt} maxLength={26000} rows={7} disabled={busy || !state} onChange={event => setPrompt(event.target.value)} />
      </label>
      <button type="button" disabled={busy || !state || !dirty || !prompt.trim()} onClick={save}>Spara version</button>
      {error && <p role="alert">{error}</p>}
      <FilmOrderPanel key={version} endpoint={danceOrderUrl} version={version} requestSha256={state?.selected?.requestSha256}
        dirty={dirty || busy} credits={estimate.credits} />
    </div>
  </section>;
}
