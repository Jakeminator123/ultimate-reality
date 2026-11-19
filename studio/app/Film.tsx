"use client";
import { useEffect, useRef, useState } from "react";
import {
  Film as FilmIcon,
  Upload,
  SkipBack,
  SkipForward,
  Scissors,
  Flag,
  Trash2,
  Play,
  Repeat2,
} from "lucide-react";
import { displayName, mediaUrl, Review } from "../lib/model";
import type { FilmFormat } from "../lib/model";
import { filmSources, type FilmSource } from "../lib/model";

export default function Film({
  review,
  update,
  choose,
}: {
  review: Review;
  update: (r: Review) => void;
  choose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [format, setFormat] = useState<FilmFormat | null>(null);
  const [pts, setPts] = useState<number[]>([]),
    [frame, setFrame] = useState(0),
    [note, setNote] = useState("");
  const [issue, setIssue] = useState(""),
    [cut, setCut] = useState(false);
  const last = pts.length - 1,
    end = review.end ?? last;
  useEffect(() => {
    const abort = new AbortController();
    setPts([]);
    setFormat(null);
    setFrame(0);
    setIssue("");
    setNote("");
    setCut(false);
    if (review.film)
      fetch("/api/timeline?details=1&name=" + encodeURIComponent(review.film), {
        signal: abort.signal,
      })
        .then(async (res) => {
          if (!res.ok)
            throw Error(
              "Bildtider kunde inte läsas. Filmspelaren kan fortfarande användas.",
            );
          return res.json();
        })
        .then((data: { times: number[]; format: FilmFormat }) => {
          if (!abort.signal.aborted) {
            setPts(data.times);
            setFormat(data.format);
          }
        })
        .catch((e) => {
          if (!abort.signal.aborted) setIssue(e.message);
        });
    return () => abort.abort();
  }, [review.film]);
  function indexAt(t: number) {
    let a = 0,
      b = pts.length - 1;
    while (a < b) {
      const m = Math.ceil((a + b) / 2);
      if (pts[m] <= t + 0.00005) a = m;
      else b = m - 1;
    }
    return a;
  }
  function seek(to: number, pause = true) {
    const el = video.current;
    if (!el || !pts.length) return;
    if (pause) {
      el.pause();
      setCut(false);
    }
    const n = Math.max(0, Math.min(last, to));
    const stop =
      pts[n + 1] ??
      (Number.isFinite(el.duration) ? el.duration : pts[n] + 0.02);
    el.currentTime = (pts[n] + Math.max(pts[n], stop)) / 2;
    setFrame(n);
  }
  useEffect(() => {
    const el = video.current;
    if (!el || !pts.length) return;
    let handle = 0;
    const tick = (_: number, info: VideoFrameCallbackMetadata) => {
      const n = indexAt(info.mediaTime);
      setFrame(n);
      if (cut && n >= end) {
        el.pause();
        setCut(false);
      }
      handle = el.requestVideoFrameCallback(tick);
    };
    if (typeof el.requestVideoFrameCallback === "function")
      handle = el.requestVideoFrameCallback(tick);
    return () => {
      if (handle) el.cancelVideoFrameCallback(handle);
    };
  }, [pts, cut, end]);
  if (!review.film)
    return (
      <div className="film-empty">
        <div className="film-glyph">
          <FilmIcon size={38} />
        </div>
        <h3>Granska en egen film</h3>
        <p>
          Välj en tagning för att spela upp, markera bildrutor och jämföra ett
          utsnitt.
        </p>
        <button className="gold" onClick={choose}>
          <Upload size={16} /> Välj film
        </button>
      </div>
    );
  return (
    <div className="film-work">
      <video
        key={review.film}
        ref={video}
        src={mediaUrl(review.film)}
        controls
        preload="auto"
        playsInline
        onError={() =>
          setIssue(
            "Webbläsaren kan inte spela denna videokodning. Prova MP4 med H.264.",
          )
        }
        onTimeUpdate={() => {
          if (video.current && pts.length && video.current.paused)
            setFrame(indexAt(video.current.currentTime));
        }}
      />
      <div className="film-toolbar">
        <span>
          <FilmIcon size={16} /> {displayName(review.film)}
        </span>
        <button onClick={choose}>Byt film</button>
      </div>
      <label className="film-source">Filmens källa (anges manuellt)
        <select aria-label="Filmens källa" value={review.source ?? "unknown"}
          onChange={(e) => update({ ...review, source: e.target.value as FilmSource })}>
          {Object.entries(filmSources).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {format && <dl className="file-format" aria-label="Uppmätt filmformat">
        <div><dt>Upplösning</dt><dd>{format.width && format.height ? format.width + " × " + format.height : "Okänd"}</dd></div>
        <div><dt>Bildfrekvens i snitt</dt><dd>{format.fps ? format.fps.toLocaleString("sv-SE", { maximumFractionDigits: 3 }) + " fps" : "Okänd"}</dd></div>
        <div><dt>Format och kodek</dt><dd>{format.container} · {format.codec.toUpperCase()}</dd></div>
        <div><dt>Pixelformat</dt><dd>{format.pixelFormat}</dd></div>
        <div><dt>Videobitrate</dt><dd>{format.bitrate ? (format.bitrate / 1e6).toLocaleString("sv-SE", { maximumFractionDigits: 2 }) + " Mbit/s" : "Ej angiven"}</dd></div>
      </dl>}
      {!!issue && (
        <p className="inline-error" role="alert">
          {issue}
        </p>
      )}
      {!!pts.length && (
        <div className="film-controls">
          <div className="between">
            <b>
              Bildruta {frame + 1} / {pts.length}
            </b>
            <small>{pts[frame]?.toFixed(3)} s</small>
          </div>
          <input
            aria-label="Bildruta"
            type="range"
            min={0}
            max={last}
            value={frame}
            onChange={(e) => seek(Number(e.target.value))}
          />
          <div className="actions">
            <button onClick={() => seek(frame - 1)} disabled={frame === 0}>
              <SkipBack size={14} /> Föregående
            </button>
            <button onClick={() => seek(frame + 1)} disabled={frame === last}>
              Nästa <SkipForward size={14} />
            </button>
          </div>
          <div className="between film-section">
            <strong>
              <Scissors size={15} /> Granskningsutsnitt
            </strong>
            <small>
              Ruta {review.start + 1}–{end + 1}
            </small>
          </div>
          <div className="actions">
            <button
              onClick={() =>
                update({ ...review, start: frame, end: Math.max(frame, end) })
              }
            >
              Sätt inpunkt
            </button>
            <button
              onClick={() =>
                update({
                  ...review,
                  start: Math.min(frame, review.start),
                  end: frame,
                })
              }
            >
              Sätt utpunkt
            </button>
            <button
              onClick={() => {
                seek(review.start, false);
                setCut(true);
                video.current?.play().catch(() => setCut(false));
              }}
            >
              <Play size={13} /> Utsnitt
            </button>
            <button
              aria-label="Återställ utsnitt"
              onClick={() => update({ ...review, start: 0, end: null })}
            >
              <Repeat2 size={15} />
            </button>
          </div>
          <div className="note">
            <input
              aria-label="Kommentar på bildrutan"
              placeholder="Kommentar på bildrutan…"
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              disabled={!note.trim()}
              onClick={() => {
                update({
                  ...review,
                  notes: [...review.notes, { frame, text: note.trim() }],
                });
                setNote("");
              }}
            >
              <Flag size={14} /> Markera
            </button>
          </div>
          {review.notes.map((n, i) => (
            <div className="annotation" key={i}>
              <button onClick={() => seek(n.frame)}>Ruta {n.frame + 1}</button>
              <span>{n.text}</span>
              <button
                aria-label="Ta bort markering"
                onClick={() =>
                  update({
                    ...review,
                    notes: review.notes.filter((_, j) => i !== j),
                  })
                }
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      {!pts.length && !issue && (
        <p className="tiny">Läser filmens bildtider…</p>
      )}
    </div>
  );
}
