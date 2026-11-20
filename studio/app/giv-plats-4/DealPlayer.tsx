"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Maximize, Minimize, Pause, Play } from "lucide-react";
import OrbitViewer, { type OrbitCut } from "./OrbitViewer";
import type { DealVersion } from "./media";
import styles from "./deal.module.css";

const root = "/giv-plats-4/";
const related: Record<DealVersion, [DealVersion, string][]> = {
  v1: [["v2", "Se de uppdaterade händerna och rörelsen"], ["v3", "Öppna giv V3"]],
  v2: [["v1", "Jämför med den första given"], ["v3", "Öppna giv V3"]],
  v3: [["v2", "Jämför samma ruta i V2"], ["v4", "Se samma ruta med rättade tummar"]],
  v4: [["v3", "Jämför samma ruta i V3"]],
};
const handFrame = 92;
const cameras = {
  front: { name: "Front · 1,40 m", src: "front.mp4" },
  sida: { name: "Sida 70° · 1,79 m", src: "sida70.mp4" },
  bada: { name: "Båda kamerorna", src: "jamforelse.mp4" },
  "120": { name: "120 kameravinklar", src: "" },
} as const;
type Camera = keyof typeof cameras;
const cameraOrder: Camera[] = ["front", "sida", "bada", "120"];
const moments = [
  ["a1", "Vila"], ["ready", "Vid skon"], ["draw", "Kortdrag"], ["handoff", "Handbyte"],
  ["land", "Landning"], ["release", "Släpp"], ["rest", "Tillbaka vid skon"],
] as const;
type Timeline = { fps: number; frames: number; keyframes: Record<typeof moments[number][0] | "flat" | "present", number> };
const slidingMoments = [
  ["a1", "Vila"], ["ready", "Vid skon"], ["draw", "Kortdrag"], ["present", "Vänstern för fram kortet"],
  ["flat", "På filten"], ["handoff", "Högerhanden styr"], ["release", "Släpp"],
  ["land", "Framme på plats 4"], ["rest", "Tillbaka vid skon"],
] as const;

function validTimeline(value: Timeline | undefined, version: DealVersion): value is Timeline {
  return !!value && Number.isFinite(value.fps) && value.fps > 0 &&
    Number.isSafeInteger(value.frames) && value.frames > 0 && !!value.keyframes &&
    (version === "v1" ? moments : slidingMoments).every(([key]) => Number.isSafeInteger(value.keyframes[key]) &&
      value.keyframes[key] >= 0 && value.keyframes[key] < value.frames);
}

function selection(camera: Camera, frame: number, angle: number, cut: OrbitCut) {
  const params = new URLSearchParams({ kamera: camera, ruta: String(frame) });
  if (camera === "120") {
    params.set("vinkel", String(angle * 3));
    if (cut !== "helbild") params.set("utsnitt", cut);
  }
  return "?" + params;
}

function updateAddress(camera: Camera, frame: number, angle: number, cut: OrbitCut) {
  window.history.replaceState(null, "", window.location.pathname + selection(camera, frame, angle, cut));
}

export default function DealPlayer({ version }: { version: DealVersion }) {
  const base = root + version;
  const stage = useRef<HTMLElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const clockFrame = useRef(0);
  const nextPosition = useRef({ time: 0, play: false });
  const defaultCamera = version === "v1" ? "front" : "120";
  const [camera, setCamera] = useState<Camera>(defaultCamera);
  const [angle, setAngle] = useState(0);
  const [cut, setCut] = useState<OrbitCut>("helbild");
  const [otherVersions, setOtherVersions] = useState<[DealVersion, string][]>([]);
  const [timeline, setTimeline] = useState<Timeline>();
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [timelineError, setTimelineError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const orderedMoments = timeline ? [...(version === "v1" ? moments : slidingMoments)].sort(
    ([a], [b]) => timeline.keyframes[a] - timeline.keyframes[b]
  ) : [];

  function showFrame(at: number) {
    clockFrame.current = at;
    setFrame(at);
  }

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
      if (!validTimeline(saved, version)) throw Error("Ogiltiga bildrutor");
      const params = new URLSearchParams(window.location.search);
      const wanted = params.get("kamera");
      const wantedFrame = Number(params.get("ruta"));
      const first = Number.isSafeInteger(wantedFrame) && wantedFrame >= 0 && wantedFrame < saved.frames ? wantedFrame : 0;
      const degrees = Number(params.get("vinkel"));
      nextPosition.current = { time: first === 0 ? 0 : (first + 0.5) / saved.fps, play: false };
      setCamera(wanted && Object.hasOwn(cameras, wanted) ? wanted as Camera : defaultCamera);
      setAngle(Number.isFinite(degrees) ? ((Math.round(degrees / 3) % 120) + 120) % 120 : 0);
      const initialCut = params.get("utsnitt");
      setCut(initialCut === "hander" || initialCut === "ansikte" ? initialCut : "helbild");
      showFrame(first);
      setTimeline(saved);
    }
    load().catch(() => { if (!controller.signal.aborted) setTimelineError(true); });
    Promise.all(related[version].map(async entry => {
      try {
        const res = await fetch(root + entry[0] + "/rendering.json", { method: "HEAD", signal: controller.signal });
        return res.ok ? entry : null;
      } catch { return null; }
    })).then(entries => { if (!controller.signal.aborted) setOtherVersions(entries.filter(entry => entry !== null)); });
    return () => controller.abort();
  }, [base, defaultCamera, version]);

  useEffect(() => {
    const video = player.current;
    if (!timeline || !video || typeof video.requestVideoFrameCallback !== "function") return;
    const { fps, frames } = timeline;
    function displayed(_: number, metadata: VideoFrameCallbackMetadata) {
      if (player.current !== video) return;
      showFrame(Math.min(frames - 1, Math.floor(metadata.mediaTime * fps + 0.00001)));
      callback = video!.requestVideoFrameCallback(displayed);
    }
    let callback = video.requestVideoFrameCallback(displayed);
    return () => video.cancelVideoFrameCallback(callback);
  }, [camera, timeline]);

  useEffect(() => {
    if (camera !== "120" || !playing || !timeline) return;
    const start = performance.now(), first = clockFrame.current;
    const { fps, frames } = timeline;
    let callback: number;
    function step(now: number) {
      const at = Math.min(frames - 1, first + Math.floor((now - start) * fps / 1000));
      showFrame(at);
      if (at < frames - 1) callback = requestAnimationFrame(step);
      else setPlaying(false);
    }
    callback = requestAnimationFrame(step);
    return () => cancelAnimationFrame(callback);
  }, [camera, playing, timeline]);

  function frameAt(time: number) {
    return timeline ? Math.max(0, Math.min(timeline.frames - 1, Math.floor(time * timeline.fps + 0.00001))) : 0;
  }

  function chooseCamera(next: Camera) {
    if (next === camera || !timeline) return;
    const video = player.current;
    if (camera === "120") {
      nextPosition.current = { time: (clockFrame.current + .5) / timeline.fps, play: playing };
    } else if (video && video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      nextPosition.current = { time: video.currentTime, play: !video.paused && !video.ended };
      video.pause();
    }
    const at = frameAt(nextPosition.current.time);
    showFrame(at);
    setPlaying(nextPosition.current.play);
    setVideoError(false);
    setCamera(next);
    updateAddress(next, at, angle, cut);
  }

  function seekFrame(index: number) {
    if (!timeline) return;
    const at = Math.max(0, Math.min(timeline.frames - 1, index));
    const time = (at + 0.5) / timeline.fps;
    nextPosition.current = { time, play: false };
    const video = player.current;
    video?.pause();
    if (video && video.readyState >= HTMLMediaElement.HAVE_METADATA) video.currentTime = time;
    setPlaying(false);
    showFrame(at);
    updateAddress(camera, at, angle, cut);
  }

  function inspectHands() {
    if (!timeline) return;
    player.current?.pause();
    setPlaying(false);
    nextPosition.current = { time: (handFrame + .5) / timeline.fps, play: false };
    showFrame(handFrame);
    setCamera("120");
    setAngle(0);
    setCut("hander");
    setVideoError(false);
    updateAddress("120", handFrame, 0, "hander");
  }

  function togglePlayback() {
    if (!timeline) return;
    if (camera === "120") {
      if (!playing && clockFrame.current === timeline.frames - 1) showFrame(0);
      if (playing) updateAddress(camera, clockFrame.current, angle, cut);
      setPlaying(!playing);
      return;
    }
    const video = player.current;
    if (!video) return;
    if (video.paused || video.ended) void video.play().catch(() => setPlaying(false));
    else {
      video.pause();
      updateAddress(camera, frameAt(video.currentTime), angle, cut);
    }
  }

  return <main ref={stage} className={styles.main}>
    <nav className={styles.navigation} aria-label="Dealerversion">
      <a href="/" className={styles.back}><ArrowLeft size={16} aria-hidden /> Till dealerstudion</a>
      {(version === "v3" || version === "v4") && <a className={styles.back} href={root + "minspel"}>Prova Paulinas minspel</a>}
      {version === "v4" && <a className={styles.back} href={root + "filmrorelse?ruta=0"}>Prova rörelse från film</a>}
      {otherVersions.map(([id, label]) => <a key={id} className={styles.back}
        href={root + id + selection(camera, frame, angle, cut)}>{label}</a>)}
    </nav>
    <header className={styles.header}>
      <h1>Paulinas giv till plats 4 · {version.toUpperCase()}</h1>
      <div className={styles.cameras} role="group" aria-label="Kameravy">
        {cameraOrder.map(key => <button type="button" key={key}
          aria-pressed={camera === key} disabled={!timeline} onClick={() => chooseCamera(key)}>
          {cameras[key].name}
        </button>)}
      </div>
    </header>
    {timeline && camera === "120" && <OrbitViewer sceneUrl={base + "/giv.glb"} frame={frame} fps={timeline.fps}
      initialAngle={angle} cut={cut}
      onAngleChange={index => { setAngle(index); updateAddress("120", clockFrame.current, index, cut); }}
      onCutChange={value => { setCut(value); updateAddress("120", clockFrame.current, angle, value); }}
    />}
    {timeline && camera !== "120" && <video key={camera} ref={player} className={styles.player} muted playsInline preload="auto"
      aria-label={"Giv till plats 4, " + cameras[camera].name} src={base + "/" + cameras[camera].src}
      onLoadedMetadata={e => {
        const position = nextPosition.current;
        if (position.time) e.currentTarget.currentTime = position.time;
        if (position.play) void e.currentTarget.play().catch(() => setPlaying(false));
      }}
      onTimeUpdate={e => { if (player.current === e.currentTarget) showFrame(frameAt(e.currentTarget.currentTime)); }}
      onSeeked={e => { if (player.current === e.currentTarget) showFrame(frameAt(e.currentTarget.currentTime)); }}
      onPlay={() => setPlaying(true)}
      onPause={e => { if (player.current === e.currentTarget) setPlaying(false); }}
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
        {orderedMoments.map(([key, label]) => <button key={key} type="button"
          aria-pressed={frame === timeline.keyframes[key]} onClick={() => seekFrame(timeline.keyframes[key])}>
          {(version === "v3" || version === "v4") && key === "present" ? "Högerhanden tar emot" : label}
        </button>)}
        <button type="button" onClick={inspectHands}>Granska händerna i ruta 92</button>
      </div>
      {(version === "v2" || version === "v3") && <nav className={styles.references} aria-label="Fotografiska jämförelser">
        <a href={base + "/tre-poser.jpg"}>{version === "v3" ? "Jämför högerhandens rörelse" : "Jämför de tre rörelseposerna"}</a>
        {version === "v2" && <a href={base + "/hander-ruta-92.jpg"}>Jämför handen med fotot</a>}
        <a href={base + "/ansikte-original.jpg"}>Jämför ansiktet med original 03</a>
        {version === "v3" && <a href={base + "/blickprov.jpg"}>Se vad som rör sig när Paulina byter blick</a>}
      </nav>}
      {version === "v4" && <nav className={styles.references} aria-label="Tummar och material">
        <a href={base + "/tummar.jpg"}>Jämför tummarna med originalfotot och V3</a>
        <a href={base + "?kamera=120&ruta=73&vinkel=0&utsnitt=hander"}>Vänster tumme vid kortdraget</a>
        <a href={base + "?kamera=120&ruta=92&vinkel=0&utsnitt=hander"}>Höger tumme när kortet skjuts fram</a>
        <a href={base + "/giv.glb"} download="paulina-giv-v4.glb">Hämta den animerade modellen</a>
      </nav>}
    </div>}
  </main>;
}
