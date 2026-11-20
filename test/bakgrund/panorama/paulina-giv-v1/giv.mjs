import { AnimationMixer, LoopOnce } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { applyDealerFaceLight } from "./dealer-face-light.mjs";

export async function loadDeal(scene, panel) {
  const { motion, take } = panel.dataset;
  const fps = Number(panel.dataset.fps);
  const lastFrame = Number(panel.querySelector("#giv-ruta").max);
  // The material endpoint verifies the registered GLB against its SHA-256.
  const model = await new GLTFLoader().loadAsync("/api/material?dealer=paulina&model=" + motion);
  applyDealerFaceLight(model);
  const clip = model.animations.find(animation => animation.name === take);
  if (!clip || Math.round(clip.duration * fps) !== lastFrame) throw Error("Givens animation och registrerade tidslinje stämmer inte överens.");
  model.scene.traverse(mesh => { if (mesh.isSkinnedMesh) mesh.frustumCulled = false; });
  scene.add(model.scene);
  const mixer = new AnimationMixer(model.scene);
  const action = mixer.clipAction(clip).setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  return redraw => bindPlayer(panel, frame => {
    action.paused = false;
    mixer.setTime(Math.min(frame / fps, clip.duration));
    redraw();
  }, lastFrame, fps);
}

function bindPlayer(panel, draw, lastFrame, fps) {
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
    const address = frameUrl(location.href);
    address.searchParams.set("tagning", panel.dataset.take);
    if (panel.dataset.receipt) address.searchParams.set("kvitto", panel.dataset.receipt);
    if (address.href !== location.href) history.replaceState(history.state, "", address);
  }
  function pause() {
    if (tick !== null) cancelAnimationFrame(tick);
    tick = null;
    button.textContent = frame === lastFrame ? "Spela igen" : "Spela upp";
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
