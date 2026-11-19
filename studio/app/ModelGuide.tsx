"use client";
import { useState } from "react";
import { Calculator, ExternalLink } from "lucide-react";
import { deliverySource, formatSource, money, priceSource, quote, seconds, videoModels } from "../lib/runway-prices";
import type { VideoModel } from "../lib/runway-prices";

const measurements = [
  ["Paow · Kling 4", "Mottagen P4", "1764 × 1172", "24", "6,63", "#00E52C"],
  ["Paow · Kling 4", "Efterarbete P4", "1764 × 1174", "24", "8,47", "#00EC29"],
  ["Paow · WAN 3", "Mottagen ingång", "1764 × 1174", "30", "19,19", "#04E528"],
  ["Paulina · Kling 4", "Stol 7, giv till 4", "1920 × 1080", "24", "7,56", "#01B02F"],
  ["Astrid · Stortest", "Porträttlager", "1080 × 1920", "24", "5,62", "#22C644"],
];

function ModelEstimate({ model, draftDuration }: { model: VideoModel; draftDuration: number }) {
  const [chosenDuration, setDuration] = useState<number | null>(null);
  const duration = chosenDuration ?? draftDuration;
  const [rate, setRate] = useState(model.rates.find((r) => r.quality === "720p") ?? model.rates[0]);
  const [format, setFormat] = useState("MP4");
  const [reference, setReference] = useState(0);
  const [images, setImages] = useState(model.imageLimit ? 1 : 0);
  const estimate = quote(model, rate, duration, reference, images, format);
  const isSourceLength = model.id === "aleph2" || model.id === "act_two";
  return (
    <section className="panel estimate" aria-labelledby="estimate-title">
      <div className="estimate-heading">
        <span className="eyebrow-icon"><Calculator size={19} /></span>
        <div><h2 id="estimate-title">{model.name}</h2><span className="mono model-id">{model.id}</span></div>
      </div>
      <div className="model-facts">
        <div><h3>Referensmaterial</h3><p>{model.inputs}</p></div>
        <div><h3>Bildformat</h3><p>{model.geometry}</p></div>
        <div><h3>Kvalitet för dealerfilm</h3><p>{model.evidence}</p></div>
      </div>
      <div className="estimate-controls">
        <label>{isSourceLength ? "Källfilmens längd" : "Längd på resultatet"}
          <select aria-label={isSourceLength ? "Källfilmens längd" : "Längd på resultatet"} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {model.durations.map((n) => <option key={n} value={n}>{n} s</option>)}
          </select>
        </label>
        <label>Upplösning
          <select aria-label="Upplösning" value={rate.quality} onChange={(e) => setRate(model.rates.find((r) => r.quality === e.target.value)!)}>
            {model.rates.map((r) => <option key={r.quality}>{r.quality}</option>)}
          </select>
        </label>
        <label>Leveransformat
          <select aria-label="Leveransformat" value={format} onChange={(e) => setFormat(e.target.value)}>
            {(model.formats ?? ["MP4"]).map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        {model.referenceRange && <label>Referensfilm totalt
          <select aria-label="Referensfilm totalt" value={reference} onChange={(e) => setReference(Number(e.target.value))}>
            <option value={0}>Ingen film</option>
            {seconds(...model.referenceRange).map((n) => <option key={n} value={n}>{n} s</option>)}
          </select>
        </label>}
        {model.imageLimit && <label>Referensbilder
          <select aria-label="Referensbilder" value={images} onChange={(e) => setImages(Number(e.target.value))}>
            {seconds(0, model.imageLimit).map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>}
      </div>
      <div className="estimate-total" aria-live="polite">
        <div><small>Uppskattat API-pris per tagning</small><strong>{estimate.credits} krediter</strong></div>
        <b>{money(estimate.credits)}</b>
        <p>{estimate.calculation}</p>
      </div>
      <p className="price-note">1 API-kredit = 0,01 USD före skatt. Prislista kontrollerad 19 november 2026. Runway-appens krediter har separat prissättning.</p>
      <div className="price-sources">
        {[[priceSource, "API-priser"], [formatSource, "Modellkrav"], [deliverySource, "Leveransformat"]].map(([url, label]) =>
          <a key={url} href={url} target="_blank" rel="noreferrer">{label} <ExternalLink size={12} /></a>)}
      </div>
    </section>
  );
}

export default function ModelGuide({ draftDuration, draftModel }: { draftDuration: number; draftModel: string }) {
  const [selectedId, setSelectedId] = useState(draftModel);
  const [secondsFilter, setSecondsFilter] = useState<number | null>(null);
  const duration = secondsFilter ?? draftDuration;
  const available = videoModels.filter((m) => m.durations.includes(duration));
  const model = available.find((m) => m.id === selectedId) ?? available[0];
  return (
    <div className="model-guide">
      <div className="estimate-grid">
        <section className="model-picker panel" aria-label="Välj jämförelsemodell">
          <h2>Jämför modeller</h2>
          <label className="compare-duration">Jämför klipplängd
            <select aria-label="Jämför klipplängd" value={duration} onChange={(e) => setSecondsFilter(Number(e.target.value))}>
              {seconds(1, 30).map((n) => <option key={n} value={n}>{n} s</option>)}
            </select>
          </label>
          <p className="picker-note">Visar {available.length} modeller för {duration} s. Grundpris i billigaste MP4-läget.</p>
          <select className="compact-picker" aria-label="Jämförelsemodell" value={model.id}
            onChange={(e) => setSelectedId(e.target.value)}>
            {available.map((item) => <option key={item.id} value={item.id}>{item.name} · {quote(item, item.rates[0], duration).credits} krediter</option>)}
          </select>
          {available.map((item) => <button type="button" key={item.id} aria-pressed={model === item}
            onClick={() => setSelectedId(item.id)}><strong>{item.name}</strong><span>{item.use}</span>
            <small>{quote(item, item.rates[0], duration).credits} krediter · {item.rates[0].quality}</small></button>)}
        </section>
        <ModelEstimate key={model.id + "-" + duration} model={model} draftDuration={duration} />
      </div>
      <section className="panel measured" aria-labelledby="measured-title">
        <h2 id="measured-title">Uppmätt i tidigare filmer</h2>
        <p>Alla fem är H.264 i MP4 med 4:2:0-färg. Stickprovet visar bakgrundens medianfärg i två övre sidofält mitt i tagningen.</p>
        <div className="measurement-scroll" tabIndex={0} role="region" aria-label="Tabell med uppmätta filmformat">
          <table><thead><tr>{["Dealer och modell", "Filmsteg", "Upplösning", "fps", "Mbit/s", "Grön bakgrund"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{measurements.map(([name, stage, size, fps, bitrate, green]) => <tr key={stage}>
            <th scope="row">{name}</th><td>{stage}</td><td>{size}</td><td>{fps}</td><td>{bitrate}</td>
            <td><span className="color-chip" style={{ backgroundColor: green }} /> <code>{green}</code></td>
          </tr>)}</tbody></table>
        </div>
        <p>Ställ in friläggningen per tagning. Granska kortkant och fingrar i full storlek mot både ljus och mörk bakgrund.</p>
      </section>
    </div>
  );
}
