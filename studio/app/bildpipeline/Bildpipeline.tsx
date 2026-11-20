"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Asset } from "../../lib/model";
import {
  bildpipelinePlan, MAX_ORIGINAL, PIPELINE_MODEL, type PipelineJob, type PipelineRevision,
  type PipelineStep,
} from "../../lib/bildpipeline";
import { referenskort } from "../../fotomall/kortstandard";
import s from "./bildpipeline.module.css";

const api = "/api/bildpipeline";
const statuses: Record<PipelineJob["status"], string> = {
  waiting: "Väntar", submitting: "Skickas", queued: "I kö", running: "Pågår",
  succeeded: "Klar", failed: "Misslyckades", unknown: "Okänd status",
};
type RevisionEntry = Pick<PipelineRevision, "id" | "created" | "files">;

function originalName(name: string) {
  return name.replace(/--[a-f\d]{16}(?=\.[^.]+$)/i, "");
}

function revisionLabel(entry: RevisionEntry) {
  const date = new Date(entry.created).toLocaleString("sv-SE");
  return date + " · " + originalName(entry.files[0]) + " · " + entry.id.slice(0, 8);
}

function originalUrl(name: string, index: number, revision: PipelineRevision | null) {
  return revision
    ? api + "?" + new URLSearchParams({ id: revision.id, original: String(index) })
    : "/api/assets?" + new URLSearchParams({ name });
}

function setRevisionUrl(id?: string) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("revision", id);
  else url.searchParams.delete("revision");
  window.history.replaceState(window.history.state, "", url);
}

function shouldSync(revision: PipelineRevision | null) {
  if (!revision || revision.mode === "draft") return false;
  const jobs = Object.values(revision.jobs);
  if (jobs.some((job) => ["submitting", "queued", "running"].includes(job.status))) return true;
  if (jobs.some((job) => job.status === "unknown")) return false;
  const selected = revision.mode === "series" ? revision.steps : revision.steps.slice(0, 1);
  return selected.some((step) => revision.jobs[step.id].status === "waiting" &&
    step.dependsOn.every((id) => revision.jobs[id].status === "succeeded"));
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Servern svarade med HTTP " + response.status + ".");
  }
  return response.json();
}

function command(body: Record<string, unknown>) {
  return request<PipelineRevision>(api, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

function StepView({ step, first, revision, files, steps, busy, reconcile }: {
  step: PipelineStep; first: boolean; revision: PipelineRevision | null;
  files: string[]; steps: PipelineStep[]; busy: boolean;
  reconcile: (stepId: string, taskId: string) => void;
}) {
  const [task, setTask] = useState("");
  const job = revision?.jobs[step.id];
  const title = (id: string) => steps.find((item) => item.id === id)?.namn || id;
  const picture = api + "?" + new URLSearchParams({ id: revision?.id ?? "", image: step.id });
  return (
    <article className={s.step}>
      <details open={first}>
        <summary>
          <span className={s.stepName}>{step.namn}</span>
          <span className={s.stepPrice}>{step.credits} krediter</span>
          <span className={job?.status === "succeeded" ? s.success : s.state}>
            {job ? statuses[job.status] : "Utkast"}
          </span>
        </summary>
        <div className={s.stepBody}>
          <p><strong>Utdata</strong> · {step.ratio.replace(":", " × ")} px · PNG</p>
          <p><strong>Föregående resultat</strong> · {step.dependsOn.length ? step.dependsOn.map(title).join(", ") : "Inga. Skapas direkt från originalen."}</p>
          <h4>Referenser i sändningsordning</h4>
          <ol className={s.refs}>
            {step.refs.map((ref) => {
              let name: string = referenskort.id;
              if (ref.source === "step") name = title(ref.step ?? "");
              if (ref.source === "original") name = files[ref.index ?? 0] ?? "Ditt identitetsfoto";
              return <li key={ref.tag}><code>{ref.tag}</code> · {originalName(name)} · {ref.roll}</li>;
            })}
          </ol>
          <h4>Prompt till Runway</h4>
          <pre className={s.prompt}>{step.prompt}</pre>
          {job?.taskId && <p className={s.id}>Runway-jobb · {job.taskId}</p>}
        </div>
      </details>
      {job?.error && <p className={s.jobError} role="status">{job.error}</p>}
      {job?.status === "unknown" && (
        <form className={s.reconcile} onSubmit={(event) => {
          event.preventDefault();
          if (task.trim()) reconcile(step.id, task.trim());
        }}>
          <label>Jobb-ID för samma bild hos Runway
            <input value={task} onChange={(event) => setTask(event.target.value)} disabled={busy} required />
          </label>
          <button disabled={busy || !task.trim()}>Koppla befintligt jobb</button>
        </form>
      )}
      {job?.status === "succeeded" && (
        <a className={s.result} href={picture} target="_blank" rel="noreferrer">
          <img src={picture} loading="lazy" alt={step.namn} />
          Öppna {step.namn.toLocaleLowerCase("sv")} i full storlek ↗
        </a>
      )}
    </article>
  );
}

export default function Bildpipeline() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [entries, setEntries] = useState<RevisionEntry[]>([]);
  const [revision, setRevision] = useState<PipelineRevision | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const lock = useRef(false);
  const upload = useRef<HTMLInputElement>(null);
  const alert = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error) alert.current?.focus(); }, [error]);

  const perform = useCallback(async (label: string, action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Begäran till studion misslyckades.");
    } finally {
      lock.current = false;
      setBusy("");
    }
  }, []);

  const readVersion = useCallback(async (id: string) => {
    const saved = await request<PipelineRevision>(api + "?" + new URLSearchParams({ id }));
    setRevision(saved);
    setFiles(saved.files);
    setRevisionUrl(saved.id);
  }, []);

  const load = useCallback(() => perform("Hämtar inkorg och versioner…", async () => {
    const [all, list] = await Promise.all([
      request<Asset[]>("/api/assets"), request<{ revisions: RevisionEntry[] }>(api),
    ]);
    setAssets(all.filter((asset) => asset.kind === "image"));
    setEntries(list.revisions);
    setReady(true);
    const id = new URL(window.location.href).searchParams.get("revision");
    if (id) await readVersion(id);
  }), [perform, readVersion]);
  useEffect(() => { void load(); }, [load]);

  const selected = revision?.files ?? files;
  const steps = useMemo(() => revision?.steps ?? bildpipelinePlan(
    files.length ? files : ["Ditt identitetsfoto"],
  ), [files, revision]);
  const front = steps[0];
  const total = steps.reduce((sum, step) => sum + step.credits, 0);
  const remaining = steps.reduce((sum, step) =>
    sum + (revision?.jobs[step.id]?.status === "waiting" ? step.credits : 0), 0);
  const jobs = revision ? Object.values(revision.jobs) : [];
  const interrupted = jobs.some((job) => job.status === "unknown" || job.status === "failed");
  const finished = jobs.filter((job) => job.status === "succeeded").length;
  const active = shouldSync(revision);
  const sync = useCallback((id: string) => perform("Hämtar jobbstatus…", async () => {
    setRevision(await command({ action: "sync", id }));
  }), [perform]);

  useEffect(() => {
    if (!revision || !active || busy || error) return;
    const timer = window.setTimeout(() => void sync(revision.id), 6500);
    return () => window.clearTimeout(timer);
  }, [revision, active, busy, error, sync]);

  function newDraft() {
    setFiles([...selected]);
    setRevision(null);
    setError("");
    setRevisionUrl();
  }

  function openVersion(id: string) {
    if (!id) { newDraft(); return; }
    void perform("Öppnar version…", () => readVersion(id));
  }

  function toggle(name: string) {
    if (busy || revision) return;
    setError("");
    setFiles((previous) => previous.includes(name)
      ? previous.filter((file) => file !== name)
      : previous.length < MAX_ORIGINAL ? [...previous, name] : previous);
  }

  function importFiles(incoming: File[]) {
    if (!incoming.length || revision) return;
    void perform("Importerar original…", async () => {
      if (files.length + incoming.length > MAX_ORIGINAL)
        throw new Error("Välj högst 14 original sammanlagt. Ta bort ett urval eller importera färre foton.");
      for (const file of incoming) {
        if (!/\.(jpe?g|png|webp)$/i.test(file.name)) throw new Error("Välj JPG, PNG eller WebP.");
        const asset = await request<Asset>("/api/assets?" + new URLSearchParams({ name: file.name }), {
          method: "POST", body: file,
        });
        setAssets((prev) => prev.some((item) => item.name === asset.name) ? prev : [...prev, asset]);
        setFiles((prev) => prev.includes(asset.name) ? prev : [...prev, asset.name]);
      }
    });
  }

  function save() {
    void perform("Sparar utkast…", async () => {
      const saved = await command({ action: "draft", files });
      setRevision(saved);
      setRevisionUrl(saved.id);
      setEntries((prev) => [saved, ...prev.filter((entry) => entry.id !== saved.id)]);
    });
  }

  function start(mode: "front" | "series") {
    if (!revision) return;
    void perform("Skickar vald version till Runway…", async () => {
      setRevision(await command({ action: "start", id: revision.id, mode }));
    });
  }

  function reconcile(step: string, taskId: string) {
    if (!revision) return;
    void perform("Kontrollerar Runway-jobbet…", async () => {
      setRevision(await command({ action: "reconcile", id: revision.id, step, taskId }));
    });
  }

  const locked = !!busy || !ready;
  const continuing = revision?.mode === "front" && revision.jobs[front.id]?.status === "succeeded";
  return (
    <main className={s.page}>
      <nav className={s.nav} aria-label="Studio"><a href="/">← Dealerstudio</a><a href="/bildstandard">Bildstandard ↗</a></nav>
      <header className={s.heading}>
        <p className="phase-caption">Fas 1 · Bildpipeline</p>
        <h1>Beställ en bildserie</h1>
        <p>Välj original av samma person. En ny stående helfigur framifrån skapas först, oavsett vilka vinklar du lägger in. Granska ståfronten separat eller beställ alla tolv bilder direkt.</p>
      </header>
      <div className={s.version}>
        <label htmlFor="pipeline-version">Version</label>
        <select id="pipeline-version" value={revision?.id ?? ""} disabled={locked}
          onChange={(event) => openVersion(event.target.value)}>
          <option value="">Nytt utkast</option>
          {entries.map((entry) => <option value={entry.id} key={entry.id}>{revisionLabel(entry)}</option>)}
        </select>
        {revision && <button onClick={newDraft} disabled={locked}>Nytt utkast med samma original</button>}
      </div>
      {error && <div className={s.error} role="alert" ref={alert} tabIndex={-1}>{error}{" "}
        {!revision && <button onClick={load} disabled={!!busy}>Hämta igen</button>}
        {revision && <button onClick={() => openVersion(revision.id)} disabled={!!busy}>Läs sparad jobbstatus igen</button>}
      </div>}
      <div className={s.layout}>
        <section className={s.panel} aria-labelledby="originals-title">
          <div className={s.sectionTop}><h2 id="originals-title">Original</h2><span>{selected.length} / {MAX_ORIGINAL}</span></div>
          <p className={s.hint}>Välj till exempel fyra blandade foton i valfri ordning. Modellen använder de tydligaste synliga dragen i hela urvalet.</p>
          {!revision && <>
            <input className={s.hidden} ref={upload} type="file" multiple accept=".jpg,.jpeg,.png,.webp"
              onChange={(event) => {
                const incoming = Array.from(event.target.files ?? []);
                event.target.value = "";
                importFiles(incoming);
              }} />
            <button onClick={() => upload.current?.click()} disabled={locked || selected.length >= MAX_ORIGINAL}>Importera foton från datorn</button>
            <fieldset className={s.inbox} disabled={locked}>
              <legend>Bildinkorg</legend>
              {!assets.length && <p>{ready ? "Inkorgen är tom." : "Läser inkorgen…"}</p>}
              {assets.map((asset) => <label key={asset.name} title={asset.name}>
                <input type="checkbox" checked={files.includes(asset.name)}
                  disabled={!files.includes(asset.name) && files.length >= MAX_ORIGINAL} onChange={() => toggle(asset.name)} />
                {originalName(asset.name)}
              </label>)}
            </fieldset>
          </>}
          {selected.length > 0 && <>
            <h3>Valda original i ordning</h3>
            <ol className={s.selection}>
              {selected.map((name, index) => <li key={name}>
                <a href={originalUrl(name, index, revision)} target="_blank" rel="noreferrer" aria-label={"Visa " + originalName(name)}>
                  <img src={originalUrl(name, index, revision)} alt="" loading="lazy" />
                </a>
                <div><strong title={name}>{index + 1}. {originalName(name)}</strong>
                  {index === 0 && <small>Första bildreferens</small>}
                  {!revision && <div className={s.inline}>
                    {index > 0 && <button disabled={locked} onClick={() => setFiles([name, ...files.filter((file) => file !== name)])}>Lägg först</button>}
                    <button disabled={locked} onClick={() => toggle(name)}>Ta bort</button>
                  </div>}
                </div>
              </li>)}
            </ol>
          </>}
          {!revision && <button disabled={locked || !files.length} onClick={save}>Spara lokalt utkast</button>}
        </section>
        <div className={s.work}>
          <section className={s.panel} aria-labelledby="order-title">
            <h2 id="order-title">Beställningsunderlag</h2>
            <dl className={s.specs}>
              <div><dt>Runway-modell</dt><dd><code>{PIPELINE_MODEL}</code></dd></div>
              <div><dt>Bildkvalitet / resonemangsnivå</dt><dd>High / High</dd></div>
              <div><dt>Leverans</dt><dd>4K PNG · 11 grundbilder + 1 kortvändning</dd></div>
              <div><dt>Ståfront / hela serien</dt><dd>{front.credits} / {total} API-krediter</dd></div>
            </dl>
            <a href="#skicka">Till beställningen ↓</a>
          </section>
          <section className={s.steps} aria-labelledby="series-title">
            <div className={s.sectionTop}><h2 id="series-title">Bildordning och prompter</h2>
              {revision && <span>{finished} / {steps.length} klara</span>}
            </div>
            {!selected.length && <p className={s.hint}>Förhandsvisningen utgår från ett identitetsfoto. Välj original för att se ditt underlag.</p>}
            {steps.map((step, index) => <StepView key={(revision?.id ?? "draft") + step.id}
              step={step} first={!index} revision={revision} files={selected}
              steps={steps} busy={locked} reconcile={reconcile} />)}
          </section>
          <section id="skicka" className={s.dispatch}>
            <h2>Skicka till Runway</h2>
            {revision ? <p>Vald version · {revisionLabel(revision)}</p> : <p>Spara utkastet för att beställa de valda bilderna.</p>}
            {continuing && <p>{remaining} API-krediter för återstående bilder.</p>}
            <div className={s.actions}>
              <button disabled={locked || !revision || revision.mode !== "draft"} onClick={() => start("front")}>Skicka ståfront</button>
              <button disabled={locked || !revision || interrupted || !(revision.mode === "draft" || continuing)}
                onClick={() => start("series")}>{continuing ? "Fortsätt serien" : "Skicka hela serien"}</button>
              {revision && revision.mode !== "draft" && active &&
                <button disabled={locked} onClick={() => sync(revision.id)}>Uppdatera jobbstatus</button>}
            </div>
            {active && <p>Jobbstatus uppdateras när den här versionen är öppen.</p>}
          </section>
        </div>
      </div>
      <div className={s.busy} role="status">{busy}</div>
    </main>
  );
}
