"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Maximize, Minimize, Pause, Play } from "lucide-react";
import styles from "./deal.module.css";

const base = "/giv-plats-4/v1";
const cameras = {
  front: { name: "Front · 1,40 m", src: "front.mp4" },
  sida: { name: "Sida 70° · 1,79 m", src: "sida70.mp4" },
  bada: { name: "Båda kamerorna", src: "jamforelse.mp4" },
} as const;
type Camera = keyof typeof cameras;

const moments = [
  ["a1", "Vila"], ["ready", "Vid skon"], ["draw", "Kortdrag"], ["handoff", "Handbyte"],
  ["land", "Landning"], ["release", "Släpp"], ["rest", "Tillbaka vid skon"],
] as const;
type Moment = typeof moments[number][0];
type Timeline = { fps: number; frames: number; keyframes: Record<Moment, number> };

function validTimeline(value: Timeline | undefined): value is Timeline {
  return !!value && Number.isFinite(value.fps) && value.fps > 0 &&
    Number.isSafeInteger(value.frames) && value.frames > 0 && !!value.keyframes &&
    moments.every(([key]) => Number.isSafeInteger(value.keyframes[key]) &&
      value.keyframes[key] >= 0 && value.keyframes[key] < value.frames);
}

function updateAddress(camera: Camera, frame: number) {
  const url = new URL(window.location.href);
  url.searchParams.set("kamera", camera);
  url.searchParams.set("ruta", String(frame));
  window.history.replaceState(null, "", url);
}

export default function DealPlayer() {
  const stage = useRef<HTMLElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const nextPosition = useRef({ time: 0, play: false });
  const [camera, setCamera] = useState<Camera>("front");
  const [timeline, setTimeline] = useState<Timeline>();
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [timelineError, setTimelineError] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const response = await fetch(base + "/rendering.json", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw Error("Filmkvitto saknas");
      const { timeline: saved } = await response.json();
      if (!validTimeline(saved)) throw Error("Ogiltiga bildrutor");
      const params = new URLSearchParams(window.location.search);
      const wantedCamera = params.get("kamera");
      const wantedFrame = Number(params.get("ruta"));
      const first = Number.isSafeInteger(wantedFrame) && wantedFrame >= 0 && wantedFrame < saved.frames ? wantedFrame : 0;
      nextPosition.current = { time: first === 0 ? 0 : (first + 0.5) / saved.fps, play: false };
      setCamera(wantedCamera === "sida" || wantedCamera === "bada" ? wantedCamera : "front");
      setFrame(first);
      setTimeline(saved);
    }
    load().catch(() => { if (!controller.signal.aborted) setTimelineError(true); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const video = player.current;
    if (!timeline || !video || typeof video.requestVideoFrameCallback !== "function") return;
    const { fps, frames } = timeline;
    function displayed(_: number, metadata: VideoFrameCallbackMetadata) {
      setFrame(Math.min(frames - 1, Math.floor(metadata.mediaTime * fps + 0.00001)));
      callback = video!.requestVideoFrameCallback(displayed);
    }
    let callback = video.requestVideoFrameCallback(displayed);
    return () => video.cancelVideoFrameCallback(callback);
  }, [camera, timeline]);

  function frameAt(time: number) {
    return timeline ? Math.max(0, Math.min(timeline.frames - 1, Math.floor(time * timeline.fps + 0.00001))) : 0;
  }

  function chooseCamera(next: Camera) {
    if (next === camera || !timeline) return;
    const current = player.current;
    if (current && current.readyState >= HTMLMediaElement.HAVE_METADATA) {
      nextPosition.current = { time: current.currentTime, play: !current.paused && !current.ended };
      current.pause();
    }
    const at = frameAt(nextPosition.current.time);
    setFrame(at);
    setVideoError(false);
    setCamera(next);
    updateAddress(next, at);
  }

  function seekFrame(index: number) {
    if (!timeline) return;
    const at = Math.max(0, Math.min(timeline.frames - 1, index));
    const time = (at + 0.5) / timeline.fps;
    nextPosition.current = { time, play: false };
    if (player.current) {
      player.current.pause();
      if (player.current.readyState >= HTMLMediaElement.HAVE_METADATA) player.current.currentTime = time;
    }
    setFrame(at);
    updateAddress(camera, at);
  }

  function togglePlayback() {
    const video = player.current;
    if (!video || !timeline) return;
    if (video.paused || video.ended) {
      void video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
      updateAddress(camera, frameAt(video.currentTime));
    }
  }

  return <main ref={stage} className={styles.main}>
    <a href="/" className={styles.back}><ArrowLeft size={16} aria-hidden /> Till dealerstudion</a>
    <header className={styles.header}>
      <h1>Paulinas giv till plats 4</h1>
      <div className={styles.cameras} role="group" aria-label="Kameravy">
        {(Object.keys(cameras) as Camera[]).map(key => <button type="button" key={key}
          aria-pressed={camera === key} disabled={!timeline} onClick={() => chooseCamera(key)}>
          {cameras[key].name}
        </button>)}
      </div>
    </header>
    {timeline && <video key={camera} ref={player} className={styles.player} muted playsInline preload="auto"
      aria-label={"Giv till plats 4, " + cameras[camera].name} src={base + "/" + cameras[camera].src}
      onLoadedMetadata={e => {
        const video = e.currentTarget;
        const position = nextPosition.current;
        if (position.time) video.currentTime = position.time;
        if (position.play) void video.play().catch(() => {});
      }}
      onTimeUpdate={e => setFrame(frameAt(e.currentTarget.currentTime))}
      onSeeked={e => setFrame(frameAt(e.currentTarget.currentTime))}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)}
      onError={() => setVideoError(true)}
    />}
    {timelineError || videoError ? <p role="status">Filmen eller filmkvittot saknas på den här datorn.</p> :
      !timeline && <p role="status">Läser filmkvittot…</p>}
    {timeline && <div className={styles.review}>
      <div className={styles.scrub}>
        <button type="button" className={styles.play} onClick={togglePlayback} disabled={videoError}>
          {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
          {playing ? "Pausa" : "Spela"}
        </button>
        <label htmlFor="film-ruta">Ruta <output>{frame}</output> av {timeline.frames - 1}</label>
        <input id="film-ruta" type="range" min={0} max={timeline.frames - 1} step={1} value={frame}
          onChange={e => seekFrame(Number(e.target.value))} />
        {document.fullscreenEnabled && <button type="button" aria-label={fullscreen ? "Avsluta helskärm" : "Visa i helskärm"}
          title={fullscreen ? "Avsluta helskärm" : "Visa i helskärm"}
          onClick={() => void (fullscreen ? document.exitFullscreen() : stage.current?.requestFullscreen())?.catch(() => {})}>
          {fullscreen ? <Minimize size={16} aria-hidden /> : <Maximize size={16} aria-hidden />}
        </button>}
      </div>
      <div className={styles.moments} role="group" aria-label="Gå till ett moment i given">
        {moments.map(([key, label]) => <button key={key} type="button"
          aria-pressed={frame === timeline.keyframes[key]} onClick={() => seekFrame(timeline.keyframes[key])}>
          {label}
        </button>)}
      </div>
    </div>}
  </main>;
}
