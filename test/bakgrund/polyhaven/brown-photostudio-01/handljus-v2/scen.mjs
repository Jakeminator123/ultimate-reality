import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadBrownEnvironment } from "/bordsprov/brown-studio/miljokarta.mjs";
import { drawCardAt } from "/bordsprov/rum3d/utdrag.mjs";

const frames = 33, fps = 24;
const query = new URLSearchParams(location.search);
const canvas = document.querySelector("#stage");
const status = document.querySelector("#status");
const header = document.querySelector("header");
const resource = name => new URL(name, import.meta.url).href;
canvas.dataset.dealerSource = "study";
document.title = "Paulina v2 · mjukt handljus";
header.querySelector("h1").textContent = "Paulina v2 · kortet ur skon";
for (const [id, selection] of [["background", "mesh"], ["lighting", "studio"]]) {
  const select = document.getElementById(id);
  select.replaceChildren(select.querySelector(`option[value="${selection}"]`));
  select.closest("label").hidden = true;
}
document.querySelector("#glass").checked = true;
document.querySelector(".toolbar fieldset").hidden = true;
document.querySelector('[data-camera="overview"]').hidden = true;

const bar = document.createElement("fieldset");
bar.setAttribute("aria-label", "Handljus och kortdrag");
bar.style.marginTop = ".7rem";
bar.innerHTML = `<label><input type="checkbox" id="soft-fill" checked>Mjukt ljus på vänsterhanden</label>
  <button type="button" id="play-hand" aria-pressed="false">Spela kortdraget</button>
  <label>Ruta <input id="hand-frame" style="width:10rem" type="range" min="1" max="33" value="1"><output id="hand-label">1/33</output></label>`;
bar.disabled = true;
document.querySelector(".toolbar").after(bar);
const note = document.querySelector("body > p");
note.replaceChildren("Miljöljus från Brown Photostudio 01 på 50 %. ");
for (const [file, label] of [["kortdrag-v2.mp4", "Film från båda stolarna"], ["grepp.jpg", "Tre närbilder per stol"], ["jamforelse.jpg", "Med och utan handljus"]]) {
  const link = document.createElement("a");
  link.href = resource(file);
  link.textContent = label;
  if (note.querySelector("a")) note.append(" · ");
  note.append(link);
}

canvas.addEventListener("roomready", async ({ detail: { renderer, scene, glass, dealer, take, draw, setStudyFrame } }) => {
  const slider = bar.querySelector("#hand-frame"), label = bar.querySelector("#hand-label");
  const play = bar.querySelector("#play-hand"), toggle = bar.querySelector("#soft-fill");
  const seat = query.get("stol") === "1" ? "1" : "4";
  document.querySelector('[data-camera="' + seat + '"]').click();
  status.textContent = "Läser Brown Photostudio och Paulinas kortdrag…";
  try {
    const [map, model] = await Promise.all([
      loadBrownEnvironment(renderer),
      new GLTFLoader().loadAsync(resource("pose.glb")),
    ]);
    const clip = model.animations[0];
    if (!clip || Math.abs(clip.duration - (frames - 1) / fps) > .002 ||
        !model.scene.getObjectByProperty("isSkinnedMesh", true)) {
      throw Error("Den exporterade v2-riggen behöver sitt 33-rutors kortdrag.");
    }
    scene.environment = map.texture;
    scene.environmentIntensity *= .5;
    glass.material.envMap = map.texture;
    glass.material.envMapIntensity *= .5;
    model.scene.traverse(mesh => {
      if (mesh.isMesh) {
        mesh.castShadow = mesh.receiveShadow = true;
        if (mesh.isSkinnedMesh) mesh.frustumCulled = false;
      }
    });
    dealer.add(model.scene);
    const mixer = new T.AnimationMixer(model.scene);
    const action = mixer.clipAction(clip).setLoop(T.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    action.paused = true;

    // Four emitting samples approximate a diffused tabletop source with feathered
    // shutters. Across the opening they cast overlapping contact shadows.
    const fill = new T.Group();
    const focus = new T.Object3D();
    focus.position.set(.35, .073, -.285);
    fill.add(focus);
    for (const dx of [-.032, .032]) {
      for (const dy of [-.019, .019]) {
        const bulb = new T.SpotLight(0xfffaf4, .018, 1.2, T.MathUtils.degToRad(32), .72, 2);
        bulb.position.set(.29 + dx, .13 + dy, -.08);
        bulb.target = focus;
        bulb.castShadow = true;
        bulb.shadow.mapSize.set(384, 384);
        bulb.shadow.camera.near = .025;
        bulb.shadow.normalBias = .0006;
        bulb.shadow.bias = -.00012;
        fill.add(bulb);
      }
    }
    scene.add(fill);
    toggle.checked = query.get("ljus") !== "utan";
    function setFill() {
      fill.visible = toggle.checked;
      canvas.dataset.fill = fill.visible ? "mjukt" : "utan";
    }
    toggle.addEventListener("change", setFill);
    setFill();

    let frame = 0, playing = false, started = 0;
    function showFrame(next) {
      if (frame === next) return;
      frame = next;
      action.time = (frame - 1) / fps;
      mixer.update(0);
      drawCardAt(frame - 1, take, draw);
      slider.value = String(frame);
      label.textContent = frame + "/" + frames;
      canvas.dataset.pose = String(frame);
    }
    function setPlaying(value) {
      playing = value;
      play.textContent = playing ? "Pausa kortdraget" : "Spela kortdraget";
      play.setAttribute("aria-pressed", String(playing));
    }
    play.addEventListener("click", () => {
      if (frame === frames) showFrame(1);
      started = performance.now() - (frame - 1) * 1000 / fps;
      setPlaying(!playing);
    });
    slider.addEventListener("input", () => {
      setPlaying(false);
      showFrame(Number(slider.value));
    });
    const requestedFrame = Number(query.get("ruta"));
    showFrame(Number.isInteger(requestedFrame) && requestedFrame >= 1 && requestedFrame <= frames ? requestedFrame : 1);
    setStudyFrame(() => {
      if (!playing) return;
      const next = Math.min(frames, 1 + Math.floor((performance.now() - started) * fps / 1000));
      showFrame(next);
      if (next === frames) setPlaying(false);
    });
    canvas.dispatchEvent(new CustomEvent("handready", { detail: { fill, scene, glass, renderer } }));
    canvas.dataset.handReady = "true";
    bar.disabled = false;
    status.textContent = "";
  } catch (error) {
    canvas.dataset.handReady = "error";
    status.textContent = "Handljusprovet kunde inte öppnas. " + error.message;
    console.error(error);
  }
}, { once: true });

await import("/bordsprov/rum3d/scen.mjs");
