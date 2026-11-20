import { AnimationMixer, LoopOnce } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const motion = "624a4f873b884cd8956c5ca7aa3b1ddcbd8625b670ee00928fe020aca59ffa28";
const fps = 24;

export async function loadDeal(scene) {
  // The material endpoint verifies the registered GLB against its SHA-256.
  const model = await new GLTFLoader().loadAsync("/api/material?dealer=paulina&model=" + motion);
  const clip = model.animations.find(animation => animation.name === "samspel-v2-v1");
  if (!clip || Math.round(clip.duration * fps) !== 53) throw Error("Tagningen för Paulinas giv saknas.");
  model.scene.traverse(mesh => { if (mesh.isSkinnedMesh) mesh.frustumCulled = false; });
  scene.add(model.scene);
  const mixer = new AnimationMixer(model.scene);
  const action = mixer.clipAction(clip).setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  return (panel, redraw) => bindPlayer(panel, frame => {
    action.paused = false;
    mixer.setTime(Math.min(frame / fps, clip.duration));
    redraw();
  }, Math.round(clip.duration * fps));
}

function bindPlayer(panel, draw, lastFrame) {
  const button = panel.querySelector("#spela");
  const slider = panel.querySelector("#giv-ruta");
  const output = panel.querySelector("#giv-tid");
  const links = Array.from(document.querySelectorAll("nav a")).filter(link =>
    new URL(link.href).searchParams.get("vy") === "giv");
  let frame = -1;
  let tick = null;

  function frameUrl(href) {
    const url = new URL(href);
    if (frame > 0) url.searchParams.set("ruta", String(frame));
    else url.searchParams.delete("ruta");
    return url;
  }
  function show(next) {
    if (frame === next) return;
    frame = next;
    draw(frame);
    slider.value = String(frame);
    output.value = frame + " / " + lastFrame;
    for (const link of links) link.href = frameUrl(link.href).href;
  }
  function pause() {
    if (tick !== null) cancelAnimationFrame(tick);
    tick = null;
    button.textContent = frame === lastFrame ? "Spela igen" : "Spela upp";
    history.replaceState(history.state, "", frameUrl(location.href));
  }
  function seek(next) {
    show(next);
    pause();
  }
  button.addEventListener("click", () => {
    if (tick !== null) { pause(); return; }
    if (frame === lastFrame) show(0);
    const first = frame, start = performance.now();
    button.textContent = "Pausa";
    function advance(now) {
      show(Math.min(lastFrame, first + Math.floor(Math.max(0, now - start) * fps / 1000)));
      if (frame === lastFrame) pause();
      else tick = requestAnimationFrame(advance);
    }
    tick = requestAnimationFrame(advance);
  });
  slider.addEventListener("input", () => seek(Number(slider.value)));
  for (const jump of panel.querySelectorAll("[data-frame]")) {
    jump.addEventListener("click", () => seek(Number(jump.dataset.frame)));
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden && tick !== null) pause(); });
  const requested = Number(new URL(location.href).searchParams.get("ruta"));
  seek(Number.isInteger(requested) ? Math.max(0, Math.min(lastFrame, requested)) : 0);
  panel.disabled = false;
}
