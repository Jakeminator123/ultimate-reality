"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { defaultBlocking } from "../lib/blocking";
import {
  BookOpen,
  FolderOpen,
  Layers3,
  ImageIcon,
  Film as FilmIcon,
  Save,
  Plus,
  Scan,
  SlidersHorizontal,
  Code2,
  Upload,
  Download,
  Copy,
  X,
  ChevronDown,
  Monitor,
  RotateCcw,
  ArrowUpRight,
} from "lucide-react";
import {
  API_VERSION,
  Asset,
  displayName,
  Draft,
  emptyReview,
  ENDPOINT,
  EXAMPLE,
  Frame,
  initialDraft,
  draftModels,
  draftSettings,
  isDraftModel,
  MODEL,
  makePayload,
  mediaUrl,
  newFrame,
  Payload,
} from "../lib/model";
import { renderFrame } from "../lib/picture";
import Film from "./Film";
import ModelGuide from "./ModelGuide";
import PromptLibrary from "./PromptLibrary";
import RunwayConnection from "./RunwayConnection";
import FilmOrderPanel from "./FilmOrderPanel";
import ModelingStudio from "./ModelingStudio";
import DealerOverview from "./DealerOverview";
import { StudioSidebar, gripWorkspace, secondaryWorkspaces, type Workspace } from "./StudioSidebar";
import { money, quote } from "../lib/runway-prices";
const SceneStudio = dynamic(() => import("./SceneStudio"), {
  ssr: false,
  loading: () => <p>Laddar 3D-scenen…</p>,
});

type Slot = "first" | "last";
type RecordData = { draft: Draft; request: { body: Payload }; requestSha256: string };
async function readJson(res: Response) {
  const data = await res.json();
  if (!res.ok) throw Error(data.error || "Det lokala anropet misslyckades.");
  return data;
}
function usePicture(
  frame: Frame | null,
  stored?: { frame: Frame; uri: string },
) {
  const key = JSON.stringify(frame);
  const [result, set] = useState({ key: "", uri: "", error: "" });
  useEffect(() => {
    let cancelled = false;
    if (!frame) return;
    if (stored && JSON.stringify(stored.frame) === key) {
      set({ key, uri: stored.uri, error: "" });
      return;
    }
    renderFrame(frame)
      .then((uri) => {
        if (!cancelled) set({ key, uri, error: "" });
      })
      .catch(() => {
        if (!cancelled)
          set({
            key,
            uri: "",
            error: "Bilden gick inte att läsa. Välj en annan referensbild.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [key, stored?.uri]);
  return result.key === key ? result : { key, uri: "", error: "" };
}
export default function Editor() {
  const [mode, setMode] = useState<Workspace>("oversikt");
  const usesDraft = mode !== "oversikt" && mode !== "modellering";
  useEffect(() => {
    const select = () => {
      const hash = window.location.hash.slice(1);
      const next = secondaryWorkspaces.find(entry => entry.id === hash)?.id;
      setMode(next ?? (hash === "modellering" || (!hash && new URLSearchParams(window.location.search).has("pose")) ? "modellering" : "oversikt"));
    };
    select();
    window.addEventListener("hashchange", select);
    return () => window.removeEventListener("hashchange", select);
  }, []);
  const [draft, setDraft] = useState<Draft>(initialDraft),
    [saved, setSaved] = useState<RecordData | null>(null);
  const [versions, setVersions] = useState<number[]>([]),
    [base, setBase] = useState(0);
  const [assets, setAssets] = useState<Asset[]>([]),
    [tab, setTab] = useState<"reference" | "film">("reference");
  const [slot, setSlot] = useState<Slot>("first"),
    [picker, setPicker] = useState<Slot | "film" | null>(null);
  const [cropping, setCropping] = useState(false),
    [full, setFull] = useState(false);
  const [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  const upload = useRef<HTMLInputElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const a = usePicture(
    draft.first,
    saved
      ? { frame: saved.draft.first, uri: saved.request.body.promptImage[0].uri }
      : undefined,
  );
  const settings = draftSettings(draft.model);
  const b = usePicture(
    settings.last ? draft.last : null,
    saved?.draft.last && saved.request.body.promptImage[1]
      ? { frame: saved.draft.last, uri: saved.request.body.promptImage[1].uri }
      : undefined,
  );
  const active = slot === "last" && draft.last ? draft.last : draft.first;
  const draftModel = settings.model;
  const draftCredits = quote(draftModel, settings.rate, draft.duration).credits;
  const uri = slot === "last" && draft.last ? b.uri : a.uri;
  const payload =
    a.uri && (!settings.last || !draft.last || b.uri) && draft.prompt.trim()
      ? makePayload(draft.prompt, draft.duration, a.uri, b.uri || undefined, draft.model)
      : null;
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(saved?.draft || initialDraft);
  async function load(v?: number) {
    const { record, versions: ids } = await readJson(
      await fetch("/api/draft" + (v ? "?v=" + v : ""), { cache: "no-store" }),
    );
    setSaved(record);
    setDraft(record?.draft || initialDraft);
    setVersions(ids);
    setBase(ids[0] || 0);
    setSlot("first");
    setStatus("");
    setError("");
  }
  const draftRequested = useRef(false);
  useEffect(() => {
    if (!usesDraft || draftRequested.current) return;
    draftRequested.current = true;
    Promise.all([load(), fetch("/api/assets").then(readJson).then(setAssets)])
      .then(() => setReady(true))
      .catch((e) => { draftRequested.current = false; setError(e.message); });
  }, [mode, usesDraft]);
  useEffect(() => {
    if (picker) dialog.current?.showModal();
    else dialog.current?.close();
  }, [picker]);
  function edit(p: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...p }));
    setStatus("");
  }
  function changeFrame(frame: Frame) {
    edit({ [slot]: frame });
  }
  function pick(name: string) {
    if (picker === "film") {
      if (name !== draft.review.film) edit({ review: emptyReview(name) });
      setTab("film");
    } else if (picker) {
      edit({ [picker]: newFrame(name) });
      setSlot(picker);
      setTab("reference");
    }
    setPicker(null);
    setError("");
  }
  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const asset: Asset = await readJson(
        await fetch("/api/assets?name=" + encodeURIComponent(file.name), {
          method: "POST",
          body: file,
        }),
      );
      if (asset.kind !== (picker === "film" ? "video" : "image"))
        throw Error("Fel typ av fil för detta fält.");
      setAssets((current) => [
        ...current.filter((a) => a.name !== asset.name),
        asset,
      ]);
      pick(asset.name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (upload.current) upload.current.value = "";
    }
  }
  async function save() {
    if (!payload) return;
    setBusy(true);
    setError("");
    try {
      const { version, requestSha256 } = await readJson(
        await fetch("/api/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft, base, payload }),
        }),
      );
      const next = { ...draft, version };
      setSaved({ draft: next, request: { body: payload }, requestSha256 });
      setDraft((current) => ({ ...current, version }));
      setBase(version);
      setVersions((v) => [version, ...v]);
      setStatus("Sparad som version " + version);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setStatus("Exakt JSON kopierad");
    } catch {
      setError("Urklipp är spärrat i den här webbläsaren. Använd Hämta JSON.");
    }
  }
  function download() {
    if (!payload) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const el = document.createElement("a");
    el.href = url;
    const clip = draft.clipName?.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    el.download = (clip || "giv-plats-4") + "-runway.json";
    el.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const shortBody = payload
    ? {
        ...payload,
        promptImage: payload.promptImage.map((f) => ({
          ...f,
          uri:
            f.uri.slice(0, 23) +
            "… [" +
            Math.round((f.uri.length * 0.75) / 1024) +
            " kB JPEG]",
        })),
      }
    : null;
  return (
    <>
      <div className="studio-shell">
      <StudioSidebar area={mode} editor dirty={dirty}/>
      <main>
        <section className="hero">
          <div>
            {mode === "modellering" && <p className="phase-caption">Fas 2 · Paulina</p>}
            {mode === "scen" && <p className="phase-caption"><a href="/ovrigt">Övrigt</a> · Schematiskt prov</p>}
            <h1>{mode === "oversikt" ? "Välj din dealer" : mode === "modellering" ? "3D-modellering" :
              mode === "film" ? draft.clipName || "Giv till plats 4" : secondaryWorkspaces.find(entry => entry.id === mode)?.name}</h1>
            {mode === "scen" && <p>{gripWorkspace.description}</p>}
          </div>
          {(mode === "film" || mode === "scen") && <div className="save-group">
            {!!versions.length && (
              <select
                aria-label="Öppna sparad version"
                value={draft.version}
                disabled={busy}
                onChange={(e) => {
                  if (
                    !dirty ||
                    confirm("Öppna versionen och lämna osparade ändringar?")
                  )
                    load(Number(e.target.value)).catch((err) =>
                      setError(err.message),
                    );
                }}
              >
                {versions.map((v) => (
                  <option value={v} key={v}>
                    Version {v}
                  </option>
                ))}
              </select>
            )}
            <button
              className="primary"
              disabled={!ready || busy || !payload}
              onClick={save}
            >
              <Save size={16} />
              {busy ? "Arbetar…" : "Spara version"}
            </button>
          </div>}
        </section>
        {usesDraft && (error || a.error || b.error) && (
          <div className="alert" role="alert">
            {error || a.error || b.error}
          </div>
        )}
        {mode === "oversikt" ? <DealerOverview dirty={dirty}/> : mode === "modellering" ? <ModelingStudio/> : mode === "promptmallar" ? <PromptLibrary draft={draft} ready={ready} apply={(p) => {
          edit({ prompt: p.prompt, model: p.model, duration: p.duration,
            clipName: p.id === "@draft" ? draft.clipName : p.name });
          setSlot("first");
          setTab("reference");
          window.location.hash = "film";
        }} /> : mode === "modeller" ? <ModelGuide draftDuration={draft.duration} draftModel={draft.model ?? MODEL} /> : mode === "scen" ? (
          <SceneStudio
            value={draft.scene ?? defaultBlocking}
            onChange={(scene) => edit({ scene })}
            onImages={(files) =>
              setAssets((previous) => [
                ...previous.filter(
                  (a) => !files.some((f) => f.name === a.name),
                ),
                ...files,
              ])
            }
          />
        ) : (
          <>
            <div className="workspace">
              <section className="viewer panel">
                <div className="viewer-tabs">
                  <button
                    className={tab === "reference" ? "active" : ""}
                    onClick={() => setTab("reference")}
                  >
                    <ImageIcon size={17} /> Bildmonitor
                  </button>
                  <button
                    className={tab === "film" ? "active" : ""}
                    onClick={() => setTab("film")}
                  >
                    <FilmIcon size={17} /> Filmgranskning
                  </button>
                </div>
                {tab === "reference" ? (
                  <>
                    <div className="monitor">
                      <div className="monitor-top">
                        <span>
                          <i />
                          {slot === "first" ? "STARTBILD" : "SLUTBILD"}
                        </span>
                        <span>16∶9</span>
                      </div>
                      <div className="screen">
                        {uri && (
                          <img
                            alt={
                              "Beskuren " +
                              (slot === "first" ? "startbild" : "slutbild")
                            }
                            src={uri}
                          />
                        )}
                      </div>
                      <div className="monitor-bottom">
                        <span>
                          <Scan size={13} /> 1280 × 720
                        </span>
                        <span>JPEG</span>
                      </div>
                    </div>
                    <div className="viewer-foot">
                      <div>
                        <div className="overline">AKTIV REFERENS</div>
                        <strong>{displayName(active.name)}</strong>
                      </div>
                      <button
                        className="outline"
                        onClick={() => setCropping((v) => !v)}
                        aria-expanded={cropping}
                      >
                        <SlidersHorizontal size={15} /> Beskär
                      </button>
                    </div>
                    {cropping && (
                      <div className="crop">
                        {(["zoom", "x", "y"] as const).map((key, i) => (
                          <label key={key}>
                            {["Zoom", "Vågrätt", "Lodrätt"][i]}
                            <input
                              type="range"
                              aria-label={["Zoom", "Vågrätt", "Lodrätt"][i]}
                              min={key === "zoom" ? 1 : 0}
                              max={key === "zoom" ? 3 : 1}
                              step=".01"
                              value={active[key]}
                              onChange={(e) =>
                                changeFrame({
                                  ...active,
                                  [key]: +e.target.value,
                                })
                              }
                            />
                          </label>
                        ))}
                        <button
                          onClick={() => changeFrame(newFrame(active.name))}
                        >
                          <RotateCcw size={14} /> Återställ
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <Film
                    review={draft.review}
                    update={(review) => edit({ review })}
                    choose={() => setPicker("film")}
                  />
                )}
              </section>
              <section className="settings panel">
                <div className="settings-title">
                  <span className="icon-box">
                    <SlidersHorizontal size={18} />
                  </span>
                  <h2>Beställningsutkast</h2>
                </div>
                <div className="field-heading">
                  <strong>Referensbilder</strong>
                  <small>{settings.last ? "Start och slut" : "En startbild"}</small>
                </div>
                <div className="frames">
                  {((settings.last ? ["first", "last"] : ["first"]) as Slot[]).map((s) => {
                    const f = draft[s],
                      img = s === "first" ? a.uri : b.uri;
                    return (
                      <div
                        className={
                          "frame " + (s === slot && f ? "selected" : "")
                        }
                        key={s}
                      >
                        <button
                          aria-label={
                            f
                              ? "Visa " +
                                (s === "first" ? "startbild" : "slutbild")
                              : "Lägg till slutbild"
                          }
                          className="thumb"
                          onClick={() => {
                            if (f) {
                              setSlot(s);
                              setTab("reference");
                            } else setPicker(s);
                          }}
                        >
                          {img ? <img src={img} alt="" /> : <Plus size={22} />}
                        </button>
                        <div className="thumb-label">
                          <span>
                            {s === "first" ? "Startbild" : "Slutbild"}
                          </span>
                          {f ? (
                            <button
                              aria-label={
                                "Byt " +
                                (s === "first" ? "startbild" : "slutbild")
                              }
                              onClick={() => setPicker(s)}
                            >
                              Byt
                            </button>
                          ) : (
                            <small>Valfri</small>
                          )}
                        </div>
                        {s === "last" && f && (
                          <button
                            className="remove"
                            aria-label="Ta bort slutbild"
                            onClick={() => {
                              edit({ last: null });
                              setSlot("first");
                            }}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!settings.last && draft.last && <p className="price-note">Din slutbild finns kvar i utkastet. Den används när du väljer en modell med slutbild.</p>}
                <a className="preset-link" href="#promptmallar"><BookOpen size={14} /> Välj startprompt</a>
                <label className="field-heading" htmlFor="prompt">
                  <strong>Prompt</strong>
                  <small>{draft.prompt.length} / 1000</small>
                </label>
                <textarea
                  id="prompt"
                  aria-label="Prompt"
                  maxLength={1000}
                  value={draft.prompt}
                  onChange={(e) => edit({ prompt: e.target.value })}
                />
                <div className="model-row">
                  <label>
                    <small>Modell via Runway API</small>
                    <select aria-label="Utkastets modell" value={draft.model ?? MODEL} onChange={(e) => {
                      const model = e.target.value;
                      if (!isDraftModel(model)) return;
                      const durations = draftSettings(model).model.durations;
                      edit({ model, duration: durations.includes(draft.duration) ? draft.duration : durations[0] });
                      setSlot("first");
                    }}>{draftModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                    <small>{settings.quality}</small>
                  </label>
                  <label>
                    <small>Längd</small>
                    <select
                      aria-label="Filmlängd"
                      value={draft.duration}
                      onChange={(e) =>
                        edit({ duration: Number(e.target.value) })
                      }
                    >
                      {draftModel.durations.map((n) => <option key={n} value={n}>{n} s</option>)}
                    </select>
                  </label>
                </div>
                <div className="draft-estimate">
                  <div><small>Utkastets API-pris före skatt</small><strong>{draftCredits} krediter · {money(draftCredits)}</strong></div>
                  <a href="#modeller">Jämför modeller <ArrowUpRight size={14} /></a>
                </div>
              </section>
            </div>
            <section className="request panel">
              <div className="request-head">
                <div>
                  <div className="overline">
                    <Code2 size={14} /> API-FÖRHANDSVISNING
                  </div>
                  <h2>Runway-anrop</h2>
                </div>
                <div className="actions">
                  <button disabled={!payload} onClick={copy}>
                    <Copy size={14} /> Kopiera JSON
                  </button>
                  <button disabled={!payload} onClick={download}>
                    <Download size={14} /> Hämta JSON
                  </button>
                </div>
              </div>
              <div className="endpoint">
                <b>POST</b>
                <code>{ENDPOINT}</code>
                <span>Bild till video</span>
              </div>
              <RunwayConnection />
              <FilmOrderPanel key={draft.version} version={draft.version}
                requestSha256={saved?.requestSha256} dirty={dirty} credits={draftCredits}/>
              <details>
                <summary>
                  Headers och JSON-kropp <ChevronDown size={15} />
                </summary>
                <p className="tiny mono">
                  Content-Type: application/json
                  <br />
                  X-Runway-Version: {API_VERSION}
                  <br />
                  Authorization: Bearer &lt;servernyckel vid en riktig
                  beställning&gt;
                </p>
                <label className="payload-switch">
                  <input
                    type="checkbox"
                    checked={full}
                    onChange={(e) => setFull(e.target.checked)}
                  />{" "}
                  Visa fullständiga bilddata
                </label>
                <pre>
                  {payload
                    ? JSON.stringify(full ? payload : shortBody, null, 2)
                    : "Välj en startbild och skriv en prompt."}
                </pre>
                <small>
                  Export och kopiering innehåller de exakta JPEG-bytes som
                  bildmonitorn visar. Granskningsfilmen ingår enbart i det
                  lokala utkastet.
                </small>
              </details>
            </section>
          </>
        )}
        <footer>
          <span>
            <Monitor size={14} /> Ultimate Reality · Dealerstudio
          </span>
          {usesDraft && <span role="status">
            {status ||
              (dirty
                ? "Osparade ändringar"
                : draft.version
                  ? "Sparad version " + draft.version
                  : "Lokalt utkast")}
          </span>}
        </footer>
      </main>
      </div>
      <dialog
        ref={dialog}
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setPicker(null);
        }}
        onClose={() => setPicker(null)}
      >
        <div className="dialog-head">
          <div>
            <div className="overline">
              <FolderOpen size={14} /> LABBETS INKORG
            </div>
            <h2>
              {picker === "film"
                ? "Välj granskningsfilm"
                : picker === "last"
                  ? "Välj slutbild"
                  : "Välj startbild"}
            </h2>
          </div>
          <button
            aria-label="Stäng"
            disabled={busy}
            onClick={() => setPicker(null)}
          >
            <X size={18} />
          </button>
        </div>
        <button
          className="import"
          disabled={busy}
          onClick={() => upload.current?.click()}
        >
          <Upload size={19} />
          {busy ? "Importerar…" : "Importera från datorn"}
          <ArrowUpRight size={16} />
        </button>
        <input
          hidden
          ref={upload}
          type="file"
          accept={
            picker === "film" ? ".mp4,.mov,.webm,.m4v" : ".jpg,.jpeg,.png,.webp"
          }
          onChange={(e) => importFile(e.target.files?.[0])}
        />
        {error && <p className="alert">{error}</p>}
        <div className="library">
          {picker !== "film" && (
            <button onClick={() => pick(EXAMPLE)}>
              <Layers3 size={22} />
              <span>
                Bordstudie<small>Lokal testbild</small>
              </span>
            </button>
          )}
          {assets
            .filter((a) => a.kind === (picker === "film" ? "video" : "image"))
            .map((a) => (
              <button disabled={busy} key={a.name} onClick={() => pick(a.name)}>
                {a.kind === "image" ? (
                  <img src={mediaUrl(a.name)} alt="" />
                ) : (
                  <FilmIcon size={22} />
                )}
                <span>{displayName(a.name)}</span>
              </button>
            ))}
        </div>
        <button
          className="refresh"
          disabled={busy}
          onClick={() =>
            fetch("/api/assets")
              .then(readJson)
              .then(setAssets)
              .catch((e) => setError(e.message))
          }
        >
          <RotateCcw size={13} /> Uppdatera inkorgen
        </button>
      </dialog>
    </>
  );
}
