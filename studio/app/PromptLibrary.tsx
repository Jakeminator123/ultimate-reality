"use client";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Save } from "lucide-react";
import { draftSettings, MODEL, type Draft } from "../lib/model";
import { builtInPrompts, type PromptPreset } from "../lib/prompt-presets";

export default function PromptLibrary({ draft, apply, ready }: {
  draft: Draft; apply: (preset: PromptPreset) => void; ready: boolean;
}) {
  const [personal, setPersonal] = useState<PromptPreset[]>([]);
  const [id, setId] = useState(builtInPrompts[0].id);
  const [edited, setEdited] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const current: PromptPreset = { id: "@draft", name: "Aktuellt filmutkast", prompt: draft.prompt,
    model: draft.model ?? MODEL, duration: draft.duration, instruction: "Spara en namngiven kopia av texten och inställningarna i filmutkastet." };
  const all = [current, ...builtInPrompts, ...personal];
  const selected = all.find((p) => p.id === id) ?? current;
  const prompt = edited ?? selected.prompt;
  const settings = draftSettings(selected.model);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/prompts", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw Error("Dina sparade mallar kunde inte läsas.");
        const result: PromptPreset[] = await response.json();
        if (!controller.signal.aborted) setPersonal((previous) => [
          ...result, ...previous.filter((p) => !result.some((entry) => entry.id === p.id)),
        ]);
      })
      .catch((err) => { if (!controller.signal.aborted) setMessage(err.message); });
    return () => controller.abort();
  }, []);

  function choose(next: string) {
    setId(next); setEdited(null); setName(""); setMessage("");
  }
  async function save() {
    setBusy(true);
    try {
      const response = await fetch("/api/prompts", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), prompt, model: selected.model, duration: selected.duration }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Mallen kunde inte sparas.");
      setPersonal((items) => [...items, result]);
      choose(result.id);
      setMessage("Sparad på labbdisken som " + result.name + ".");
    } catch (err) { setMessage((err as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="panel prompt-library" aria-labelledby="library-title">
    <div className="settings-title"><span className="icon-box"><BookOpen size={19} /></span><h2 id="library-title">Startprompter</h2></div>
    <label htmlFor="preset-select">Klipp eller egen mall</label>
    <select id="preset-select" disabled={busy} value={id} onChange={(e) => choose(e.target.value)}>
      <option value={current.id}>{current.name}</option>
      <optgroup label="Labbets startprompter">{builtInPrompts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
      {personal.length > 0 && <optgroup label="Mina sparade mallar">{personal.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
    </select>
    <p className="preset-meta">{settings.model.name} · {selected.duration} s · {settings.quality}</p>
    <p>{selected.instruction}</p>
    <label htmlFor="preset-text">Startprompt</label>
    <textarea id="preset-text" maxLength={1000} value={prompt} disabled={busy} onChange={(e) => setEdited(e.target.value)} />
    <button className="primary" disabled={!ready || busy || !prompt.trim()} onClick={() => apply({ ...selected, prompt })}>Använd i filmutkast <ArrowRight size={16} /></button>
    <div className="preset-save">
      <label htmlFor="preset-name">Namn på egen mall</label>
      <input id="preset-name" type="text" value={name} disabled={busy} maxLength={80} placeholder="Till exempel Min retur till skon" onChange={(e) => setName(e.target.value)} />
      <button disabled={!ready || busy || !name.trim() || !prompt.trim()} onClick={save}><Save size={15} /> Spara egen mall</button>
    </div>
    {message && <p role="status">{message}</p>}
    <p className="price-note">”Använd i filmutkast” hämtar text, modell och längd. Referensbilder väljs i filmutkastet. För startbilder beskriver Runway rörelsen, dess ordning och kameran. Vid videoreferenser anger du också vilken rörelse de ska styra.</p>
    <div className="price-sources"><a href="https://help.runwayml.com/hc/en-us/articles/48324313115155-Image-to-Video-Prompting-Guide" target="_blank" rel="noreferrer">Runways promptguide</a><a href="https://runway.com/resources/seedance-2-5-prompt-guide" target="_blank" rel="noreferrer">Seedance-guiden</a></div>
  </section>;
}
