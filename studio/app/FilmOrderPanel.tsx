"use client";

import { useEffect, useState } from "react";
import type { FilmOrder } from "../lib/film-order";

const statusText = {
  waiting: "Redo att skickas",
  submitting: "Beställningen skickas",
  queued: "Runway har tagit emot beställningen",
  running: "Runway skapar filmen",
  succeeded: "Originalfilen är sparad",
  failed: "Beställningen avslutades",
  unknown: "Beställningssvaret är osäkert",
};

async function responseState(response: Response): Promise<FilmOrder> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Filmversionens jobbstatus kunde inte läsas.");
  return data;
}

export default function FilmOrderPanel({ version, requestSha256, dirty, credits, endpoint = "/api/runway/film" }: {
  version: number; requestSha256?: string; dirty: boolean; credits: number; endpoint?: string;
}) {
  const [order, setOrder] = useState<FilmOrder>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [taskId, setTaskId] = useState("");
  useEffect(() => {
    if (!version) return;
    const controller = new AbortController();
    fetch(endpoint + "?v=" + version, { cache: "no-store", signal: controller.signal })
      .then(responseState).then((state) => { if (!controller.signal.aborted) setOrder(state); })
      .catch((err: Error) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [version, endpoint]);

  async function act(action: "start" | "sync" | "reconcile") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, action, requestSha256, taskId: taskId.trim() }) });
      setOrder(await responseState(response));
    } catch (err) { setError(err instanceof Error ? err.message : "Runways jobbstatus kunde inte läsas."); }
    finally { setBusy(false); }
  }

  const job = order?.job;
  const result = order?.result;
  return <section className="runway-connection" aria-label="Skicka sparad filmversion">
    <div><strong>Runway · filmorder{version > 0 ? " v" + version : ""}</strong>
      {(!version || (dirty && job?.status === "waiting")) && <p>Spara ändringarna som en version för att beställa filmen.</p>}
      {job && <p role="status">{statusText[job.status]}{job.taskId && <> · Jobb-ID <code>{job.taskId}</code></>}</p>}
      {job?.error && <p>{job.error}</p>}
      {result && <p>{result.format.width} × {result.format.height} px · {result.frames} bildrutor · {result.format.codec}
        <br/><a href={endpoint + "?v=" + version + "&original=1"} target="_blank" rel="noreferrer">Öppna sparad originalfilm</a>
        <br/><small>SHA-256 <code>{result.sha256}</code></small></p>}
      {error && <p role="alert">{error}</p>}
    </div>
    {job?.status === "waiting" && <button type="button" disabled={busy || dirty || !requestSha256}
      onClick={() => act("start")}>Skicka version {version} till Runway · {credits} krediter</button>}
    {job?.status === "unknown" && <label>Jobb-ID från Runway
      <input value={taskId} onChange={(e) => setTaskId(e.target.value)} />
      <button type="button" disabled={busy || !taskId.trim()} onClick={() => act("reconcile")}>Koppla befintligt jobb</button>
    </label>}
    {version > 0 && (!job || ["submitting", "queued", "running"].includes(job.status) || error) &&
      <button type="button" disabled={busy} onClick={() => act("sync")}>{busy ? "Hämtar…" : "Hämta jobbstatus"}</button>}
  </section>;
}
