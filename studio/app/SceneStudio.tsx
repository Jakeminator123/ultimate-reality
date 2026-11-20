"use client";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Crosshair,
  Focus,
  Hand,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Images,
} from "lucide-react";
import {
  Blocking,
  CONTACT,
  defaultBlocking,
  FPS,
  GRASP,
  LAST_FRAME,
  limits,
  phase,
  RELEASE,
} from "../lib/blocking";
import { buildDealerScene, Seat, seats } from "../lib/dealer-scene";
import type { Asset } from "../lib/model";

type Props = {
  value: Blocking;
  onChange: (s: Blocking) => void;
  onImages: (assets: Asset[]) => void;
};
export default function SceneStudio({ value, onChange, onImages }: Props) {
  const front = useRef<HTMLDivElement>(null),
    side = useRef<HTMLDivElement>(null);
  const rig = useRef<ReturnType<typeof buildDealerScene> | null>(null);
  const [detail, setDetail] = useState(false),
    [placing, setPlacing] = useState(false),
    [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const current = useRef({ value, onChange });
  current.current = { value, onChange };
  useEffect(() => {
    try {
      rig.current = buildDealerScene({ 4: front.current!, 1: side.current! });
    } catch (e) {
      setError("Scenen kunde inte öppnas: " + (e as Error).message);
    }
    return () => {
      rig.current?.dispose();
      rig.current = null;
    };
  }, []);
  useEffect(() => {
    rig.current?.draw(value, detail);
  }, [value, detail]);
  useEffect(() => {
    if (!playing) return;
    let loop = 0;
    const start = performance.now(),
      first = current.current.value.frame;
    function tick(now: number) {
      const frame = Math.min(
        LAST_FRAME,
        first + Math.floor(((now - start) * FPS) / 1000),
      );
      if (frame !== current.current.value.frame)
        current.current.onChange({ ...current.current.value, frame });
      if (frame < LAST_FRAME) loop = requestAnimationFrame(tick);
      else setPlaying(false);
    }
    loop = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(loop);
  }, [playing]);
  function change(p: Partial<Blocking>) {
    setPlaying(false);
    setNotice("");
    onChange({ ...value, ...p });
  }
  function aim(e: React.PointerEvent<HTMLDivElement>, seat: Seat) {
    if (!placing) return;
    if (e.type === "pointerdown")
      e.currentTarget.setPointerCapture(e.pointerId);
    else if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const r = e.currentTarget.getBoundingClientRect();
    const p = rig.current?.tablePoint(
      seat,
      (2 * (e.clientX - r.left)) / r.width - 1,
      1 - (2 * (e.clientY - r.top)) / r.height,
    );
    if (p) change(p);
  }
  async function savePair() {
    if (!rig.current) return;
    setPlaying(false);
    setSaving(true);
    setError("");
    try {
      // Freeze both pixels before the first upload, even if the timeline is playing.
      rig.current.draw(value, detail);
      const images = await Promise.all(
        seats.map((seat) => rig.current!.image(seat)),
      );
      const files = await Promise.all(
        images.map(async (image, i) => {
          const name = `giv-stol-${seats[i]}-ruta-${value.frame + 1}-${detail ? "hand" : "bord"}.png`;
          const blob = await (await fetch(image)).blob();
          const response = await fetch(
            "/api/assets?name=" + encodeURIComponent(name),
            { method: "POST", body: blob },
          );
          const result = await response.json();
          if (!response.ok)
            throw Error(result.error || "Bildparet kunde inte sparas.");
          return result as Asset;
        }),
      );
      onImages(files);
      setNotice(
        "Bildparet från ruta " + (value.frame + 1) + " finns i labbets inkorg.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function slider(
    field: Exclude<keyof Blocking, "frame">,
    title: string,
    unit: string,
  ) {
    return (
      <label className="pose-slider">
        <span>
          {title}
          <span className="pose-value">
            {value[field]} {unit}
          </span>
        </span>
        <input
          aria-label={title}
          type="range"
          min={limits[field][0]}
          max={limits[field][1]}
          value={value[field]}
          onChange={(e) => change({ [field]: Number(e.target.value) })}
        />
      </label>
    );
  }
  return (
    <section className="blocking">
      <section className="current-scene" aria-label="Aktuellt kasinorum">
        <a href="/bordsprov/rum3d?rum=mesh&stol=4&glas=1" aria-label="Öppna det vridbara kasinorummet från Stol 4">
          <img src="/bordsprov/rum3d/arbetsrum.jpg" alt="Det redigerbara kasinorummet med Paulina vid blackjackbordet" onError={e => { e.currentTarget.hidden = true; }}/>
        </a>
        <div><h2>Kasinorummet</h2>
          <p>RUM-03 med bordet på 192 × 129,6 cm och 70/30-skon. Kortutdraget använder Paulinas 08-rigg. Stol 4 och Stol 1 visar samma tagning.</p>
          <a href="/bordsprov/rum3d?rum=mesh&stol=4&glas=1">Vrid scenen från Stol 4 ↗</a>
          <a href="/bordsprov/paulina-utdrag.html?riktning=70-30">Visa 08-riggens kortutdrag ↗</a>
        </div>
      </section>
      <div className="pose-heading">
        <div>
          <h2>Grepp och landning</h2>
        </div>
        <div className="actions">
          <button aria-pressed={detail} onClick={() => setDetail((v) => !v)}>
            <Focus size={15} />
            {detail ? "Visa hela bordet" : "Handdetalj"}
          </button>
          <button
            disabled={saving || (!!error && !rig.current)}
            onClick={savePair}
          >
            <Images size={15} />
            {saving ? "Sparar…" : "Spara bildpar"}
          </button>
        </div>
      </div>
      <div className="cameras">
        {seats.map((seat) => (
          <figure className="camera-panel" key={seat}>
            <figcaption>
              <span>
                <Camera size={15} /> Stol {seat}
              </span>
              <small>
                {detail ? "HANDDETALJ" : "BORDSVY"} · RUTA {value.frame + 1}
              </small>
            </figcaption>
            <div
              role="img"
              aria-label={"3D-vy från stol " + seat}
              className={"camera-image" + (placing ? " placing" : "")}
              data-seat={seat}
              ref={seat === 4 ? front : side}
              onPointerDown={(e) => aim(e, seat)}
              onPointerMove={(e) => aim(e, seat)}
            />
          </figure>
        ))}
      </div>
      <div className="pose-time panel">
        <div className="between">
          <strong>{phase(value.frame)}</strong>
          <small>
            Ruta {value.frame + 1} / {LAST_FRAME + 1} · {FPS} bilder/s
          </small>
        </div>
        <input
          aria-label="Gemensam bildruta"
          type="range"
          min={0}
          max={LAST_FRAME}
          value={value.frame}
          onChange={(e) => change({ frame: Number(e.target.value) })}
        />
        <div className="between">
          <div className="actions">
            <button
              aria-label="Föregående scenruta"
              disabled={!value.frame}
              onClick={() => change({ frame: value.frame - 1 })}
            >
              <SkipBack size={14} />
            </button>
            <button
              onClick={() => {
                if (!playing && value.frame === LAST_FRAME)
                  onChange({ ...value, frame: 0 });
                setPlaying(!playing);
              }}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}{" "}
              {playing ? "Pausa" : "Spela givning"}
            </button>
            <button
              aria-label="Nästa scenruta"
              disabled={value.frame === LAST_FRAME}
              onClick={() => change({ frame: value.frame + 1 })}
            >
              <SkipForward size={14} />
            </button>
          </div>
          <div className="actions">
            {(
              [
                [0, "Redo"],
                [GRASP, "Grepp"],
                [CONTACT, "Kontakt"],
                [RELEASE, "Släpp"],
                [LAST_FRAME, "Slut"],
              ] as const
            ).map(([f, label]) => (
              <button
                key={f}
                aria-pressed={value.frame === f}
                onClick={() => change({ frame: f })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="pose-panels">
        <section className="panel pose-settings">
          <h3>
            <Hand size={18} /> Högerhandens grepp
          </h3>
          <p className="tip-key">
            <i /> Tumme <i /> Pekfinger
          </p>
          {slider("edgeMm", "Läge längs kortkanten", "mm")}
          {slider("gapMm", "Extra fingerglapp", "mm")}
          {slider("tiltDeg", "Kortets lutning i greppet", "°")}
        </section>
        <section className="panel pose-settings">
          <h3>
            <Crosshair size={18} /> Kortets landningspunkt
          </h3>
          <p className="tiny">
            Måttet utgår från bordets mitt. Positivt djup går mot stol 4.
          </p>
          {slider("landingXcm", "Sidled", "cm")}
          {slider("landingZcm", "Djup", "cm")}
          <div className="actions">
            <button aria-pressed={placing} onClick={() => setPlacing(!placing)}>
              <Crosshair size={14} />
              {placing ? "Avsluta placering" : "Placera direkt i bild"}
            </button>
            <button
              onClick={() =>
                change({
                  landingXcm: defaultBlocking.landingXcm,
                  landingZcm: defaultBlocking.landingZcm,
                })
              }
            >
              Centrera mål
            </button>
          </div>
        </section>
      </div>
      {notice && (
        <p className="scene-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
