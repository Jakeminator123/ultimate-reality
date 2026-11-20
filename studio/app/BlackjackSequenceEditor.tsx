"use client";
import { useEffect, useState } from "react";
import type { BlackjackAction, BlackjackSequence, SequenceSummary } from "../lib/blackjack-sequence";
import { bodyLabel, chooseDealVersions, dealLabel, poseNames, versionRule } from "../lib/deal-versions";
import type { DealerMaterial } from "../lib/material-types";
import styles from "./modeling.module.css";

type Catalog = { actions: BlackjackAction[]; sequences: SequenceSummary[] };
type Saved = { id: string; sequence: BlackjackSequence };
type DraftStep = { action: BlackjackAction; face?: string };
const modelKey = (item: Pick<BlackjackAction, "geometry" | "appearance">) => item.geometry + "/" + (item.appearance ?? "");

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Sekvensen kunde inte läsas eller sparas.");
  return data;
}

export default function BlackjackSequenceEditor({ project }: { project: DealerMaterial }) {
  const url = "/api/blackjack-sequence?" + new URLSearchParams({ dealer: project.dealer });
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [model, setModel] = useState("");
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [face, setFace] = useState("");
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [savedId, setSavedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setCatalog(null);
    setError("");
    requestJson<Catalog>(url, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setCatalog(data); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [open, url, project.stamp]);

  const actions = catalog?.actions ?? [];
  const models = new Map(actions.map(action => [modelKey(action), action]));
  const preferred = actions.find(action => action.filmUrl === project.seatedTrial?.film?.url);
  const first = preferred ?? actions.find(action => action.geometry === project.geometry?.sha256 && action.appearance === (project.appearance?.sha256 ?? null)) ?? actions[0];
  const selectedModel = steps[0] ? modelKey(steps[0].action) : models.has(model) ? model : first ? modelKey(first) : "";
  const { current } = chooseDealVersions(actions.filter(action => modelKey(action) === selectedModel), preferred?.receipt);
  const last = steps.at(-1)?.action;
  const allowed = current.filter(action => !last || action.startPose === last.endPose);
  const next = allowed.find(action => action.receipt === selected) ?? allowed[0];
  const summaries = catalog?.sequences ?? [];
  const idToOpen = summaries.some(row => row.id === savedId) ? savedId : summaries[0]?.id;

  function bodyName(action: Pick<BlackjackAction, "geometry">) {
    const body = project.seatedTrial?.id === action.geometry ? project.seatedTrial.name :
      project.geometry?.sha256 === action.geometry ? project.activeModel?.name : undefined;
    return body ? bodyLabel(body) : "Sparad kroppsmodell";
  }
  function modelName(action: Pick<BlackjackAction, "geometry" | "appearance">) {
    const surfaces = [...models.values()].filter(item => item.geometry === action.geometry && item.appearance);
    const detail = action.appearance && surfaces.length > 1 ? " (" + action.appearance.slice(0, 8) + ")" : "";
    return bodyName(action) + " · " + (action.appearance ? "fotoyta" + detail : "neutral yta");
  }

  function addStep() {
    if (!next) return;
    if (face.trim() && !/^(?:[2-9]|10|[AJQK])[SHDC]$/.test(face.trim().toUpperCase())) {
      setError("Ange kortets valör och färg, exempelvis AS eller 10D."); return;
    }
    setError("");
    setSteps(previous => [...previous, { action: next, ...(face.trim() && { face: face.trim().toUpperCase() }) }]);
    setFace("");
    setSelected("");
  }

  async function saveOrOpen(id?: string) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = id ? await requestJson<Saved>(url + "&id=" + encodeURIComponent(id)) :
        await requestJson<Saved>(url, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), steps: steps.map(({ action, face }) => ({ receipt: action.receipt, ...(face && { face }) })) }) });
      setSaved(result); setSavedId(result.id);
      setCatalog(previous => previous && { ...previous, sequences: [
        { id: result.id, name: result.sequence.name, stepCount: result.sequence.steps.length, endPose: result.sequence.endPose },
        ...previous.sequences.filter(item => item.id !== result.id),
      ] });
      setSteps([]); setName(""); setFace(""); setSelected("");
    } catch (e) { setError(e instanceof Error ? e.message : "Sekvensen kunde inte öppnas."); }
    finally { setBusy(false); }
  }

  return <details className={styles.sequenceEditor} id="givsekvens" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Givsekvenser</summary>
    {open && <>
      {!catalog && !error && <p role="status">Läser granskade givningar och sparade sekvenser…</p>}
      {catalog && <fieldset disabled={busy}>
        <legend>{saved ? "Sparad sekvens · " + saved.sequence.name : "Skapa en givsekvens"}</legend>
        {saved ? <>
          <p>{modelName(saved.sequence)} · {saved.sequence.steps.length} givningar</p>
          <ol>{saved.sequence.steps.map(step => <li key={step.cardInstance}>
            Kort {step.cardInstance}{step.face && " · " + step.face} · plats {step.targetSeat} · {poseNames[step.startPose]} → {poseNames[step.endPose]}
            {" · "}<a href={step.filmUrl}>{dealLabel(bodyName(step), step.take)}</a>
          </li>)}</ol>
          <div className={styles.sequenceControls}>
            <a href={"/modellering/sekvens?" + new URLSearchParams({ dealer: project.dealer, id: saved.id })}>Spela den sparade sekvensen i 3D</a>
            <button type="button" onClick={() => { setSaved(null); setError(""); }}>Ny sekvens</button>
          </div>
        </> : actions.length > 0 ? <>
          {models.size > 1 ? <label>Kropp och fotoyta <select value={selectedModel} disabled={steps.length > 0}
            onChange={e => { setModel(e.target.value); setSelected(""); }}>
            {[...models].map(([key, action]) => <option key={key} value={key}>{modelName(action)}</option>)}</select></label>
            : first && <p>{modelName(first)}</p>}
          <p>{versionRule} Sparade steg behåller sina filmkvitton.</p>
          {steps.length > 0 && <ol>{steps.map(({ action, face }, index) => <li key={index}>
            Kort {index + 1}{face && " · " + face} · plats {action.targetSeat} · {poseNames[action.startPose]} → {poseNames[action.endPose]}
            {" · "}{dealLabel(bodyName(action), action.take)}</li>)}</ol>}
          {next ? <div className={styles.sequenceControls}>
            <label>Giv och slutpose <select value={next.receipt} onChange={e => setSelected(e.target.value)}>
              {allowed.map(action => <option key={action.receipt} value={action.receipt}>
                {dealLabel(bodyName(action), action.take, action.endPose)} · plats {action.targetSeat} från {poseNames[action.startPose]}
              </option>)}</select></label>
            <label>Kortkod (valfri) <input value={face} placeholder="t.ex. AS" maxLength={3}
              onChange={e => setFace(e.target.value.toUpperCase())}/></label>
            <button type="button" onClick={addStep}>Lägg till giv</button>
          </div> : last && <p>Ingen granskad giv börjar i {poseNames[last.endPose]} för den här kroppen och fotoytan.</p>}
          {steps.length > 0 && <div className={styles.sequenceControls}>
            <button type="button" onClick={() => { setSteps(previous => previous.slice(0, -1)); setError(""); }}>Ta bort sista given</button>
            <label>Sekvensnamn <input value={name} onChange={e => setName(e.target.value)}/></label>
            <button type="button" disabled={!name.trim()} onClick={() => void saveOrOpen()}>Spara sekvens</button>
          </div>}
        </> : <p>Inga granskade givningar med registrerade poser finns för den här dealern.</p>}
        {summaries.length > 0 && <div className={styles.sequenceControls}>
          <label>Sparade sekvenser <select value={idToOpen ?? ""} onChange={e => setSavedId(e.target.value)}>
            {summaries.map(row => <option key={row.id} value={row.id}>{row.name} · {row.stepCount} givningar · {row.id.slice(0, 8)}</option>)}
          </select></label>
          <button type="button" disabled={!idToOpen || steps.length > 0} onClick={() => void saveOrOpen(idToOpen)}>Öppna sparad sekvens</button>
        </div>}
      </fieldset>}
      {error && <p role="alert">{error}</p>}
    </>}
  </details>;
}
