import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { buildTable, textiles } from "./test/bord/filtdjup-v1/bord.mjs";
import { applyTableMaterials } from "./material.mjs";
import { buildDrawShoe } from "./sko.mjs";
import { prepareAppearance } from "./utseende.mjs";
import { buildChips, buildGlass } from "./foremal.mjs";
import { attachPendant, enableRecording, isDim } from "./pendel.mjs";
import { addPendantLight, frameAt, loadDraw, motionFrame, pendantCandela } from "./utdrag.mjs";

const canvas = document.querySelector("#stage");
const status = document.querySelector("#status");
const select = document.querySelector("#background");
const lighting = document.querySelector("#lighting");
const query = new URLSearchParams(location.search);
const input = name => document.getElementById(name);
const url = name => new URL(name, document.baseURI).href;
async function json(name) {
  const res = await fetch(url(name));
  if (!res.ok) throw Error("Saknar " + name);
  return res.json();
}

async function start() {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new T.Scene();
  scene.background = new T.Color(0x282822);
  const camera = new T.PerspectiveCamera(48, 16 / 9, .018, 25);
  const controls = new OrbitControls(camera, canvas);
  controls.minDistance = .20;
  controls.maxDistance = 2.95;
  controls.maxPolarAngle = Math.PI * .56;
  controls.zoomSpeed = .75;

  const fill = new T.HemisphereLight(0xf4f4ed, 0xaeaa98, 1.05);
  scene.add(fill);
  const key = new T.DirectionalLight(0xffefda, 1.75);
  key.position.set(-1.3, 2.45, 1.05);
  key.castShadow = true;
  Object.assign(key.shadow.camera, { left:-2.45, right:2.45, top:2.45, bottom:-2.45, near:.1, far:9 });
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.normalBias = .001;
  key.shadow.bias = -.00012;
  key.shadow.intensity = .60;
  key.shadow.radius = 3.5;
  scene.add(key);

  const loader = new GLTFLoader();
  const [room, layout, cal, take] = await Promise.all([
    loader.loadAsync(url("rum.glb")), json("layout.json"), json("kameror.json"), json("bana.json"),
  ]);
  room.scene.traverse(obj => { if (obj.isMesh) obj.receiveShadow = true; });
  scene.add(room.scene);
  const reflections = new T.WebGLCubeRenderTarget(128, { type: T.HalfFloatType });
  const probe = new T.CubeCamera(.02, 25, reflections);
  probe.position.set(0, .10, 0);
  // The off-camera diffusion panels are visible in glass and polished metal.
  const panelGeometry = new T.PlaneGeometry(.78, 1.05);
  const panelMaterial = new T.MeshBasicMaterial({ color: new T.Color(4.0, 3.7, 3.3), side: T.DoubleSide });
  const panels = new T.Group();
  for (const position of [[-1.3, 1.65, 1.05], [1.65, 1.15, .15]]) {
    const panel = new T.Mesh(panelGeometry, panelMaterial);
    panel.position.fromArray(position);
    panel.lookAt(probe.position);
    panels.add(panel);
  }
  scene.add(panels);
  probe.update(renderer, scene);
  scene.remove(panels);
  panelGeometry.dispose();
  panelMaterial.dispose();
  const pmrem = new T.PMREMGenerator(renderer);
  const environment = pmrem.fromCubemap(reflections.texture);
  scene.environment = environment.texture;
  scene.environmentIntensity = .48;
  pmrem.dispose();
  reflections.dispose();

  const table = buildTable(layout, false, textiles(layout));
  const { shoe, draw } = buildDrawShoe(take.shoe);
  draw(take.frames[0].card_curve_zy_m);
  const chips = buildChips(), glass = buildGlass();
  glass.material.envMap = environment.texture;
  const furniture = new T.Group();
  furniture.add(table, shoe, chips, glass);
  scene.add(furniture);
  const dealer = new T.Group();
  const seatBase = new T.MeshStandardMaterial({ color: 0x50483d, metalness: .55, roughness: .34 });
  const cushion = new T.MeshStandardMaterial({ color: 0x293330, roughness: .65 });
  for (const [top, bottom, height, center, material] of [
    [.155, .17, .018, .009, seatBase], [.029, .037, .345, .1905, seatBase],
    [.165, .151, .045, .3835, cushion],
  ]) {
    const part = new T.Mesh(new T.CylinderGeometry(top, bottom, height, 48), material);
    part.position.set(layout.dealerSeat.x, cal.floorY + center, layout.dealerSeat.z);
    part.castShadow = part.receiveShadow = true;
    dealer.add(part);
  }
  scene.add(dealer);

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  const views = document.querySelectorAll("[data-camera]");
  function preset(id) {
    const seat = cal.cameras[id];
    camera.position.fromArray(seat ? seat.eye : [.98, .91, 2.16]);
    controls.target.fromArray(seat ? seat.aim : [0, .035, -.13]);
    camera.fov = seat ? seat.fovVertical : 48;
    camera.updateProjectionMatrix();
    controls.update();
    for (const b of views) b.setAttribute("aria-pressed", String(b.dataset.camera === id));
  }
  preset(query.get("stol") || "overview");
  for (const button of views) button.addEventListener("click", () => preset(button.dataset.camera));
  controls.addEventListener("start", () => {
    for (const b of views) b.setAttribute("aria-pressed", "false");
  });

  function objects() {
    furniture.visible = input("table").checked;
    dealer.visible = input("dealer").checked;
    chips.visible = input("chips").checked;
    glass.visible = input("glass").checked;
    input("glass").disabled = input("chips").disabled = !furniture.visible;
  }
  for (const box of document.querySelectorAll('input[type="checkbox"]')) box.addEventListener("change", objects);
  if (query.get("glas") === "1") input("glass").checked = true;
  objects();

  let spark, activeCloud;
  const pendant = input("pendant");
  const drawFrame = input("draw-frame"), playDraw = input("play-draw"), pendantTable = input("pendant-table");
  const lightOnTable = addPendantLight(scene);
  const drawRequested = query.get("drag") === "1";
  if (drawRequested) pendantTable.checked = true;
  let bodyParts, firstPose, appearance, drawLoading, moveHand, playing = false;
  function setPlaying(value) {
    playing = value;
    playDraw.textContent = value ? "Pausa kortdraget" : "Spela kortdraget";
    playDraw.setAttribute("aria-pressed", String(value));
  }
  async function prepareDraw() {
    if (moveHand) return true;
    if (!bodyParts) return false;
    try {
      drawLoading ??= loadDraw(loader, url, appearance, bodyParts, firstPose, take, draw);
      moveHand = await drawLoading;
      canvas.dataset.drawReady = "true";
      return true;
    } catch (error) {
      drawLoading = undefined;
      setPlaying(false);
      status.textContent = "Kortdraget kunde inte öppnas. " + error.message;
      return false;
    }
  }
  const stopRecording = enableRecording(canvas, input("record-view"), input("recorded-view"), message => {
    status.textContent = "Inspelningen kunde inte slutföras. " + message;
  });
  if (query.get("blink") === "1") pendant.value = "blink";
  let blinkStart = performance.now(), updatePendant;
  pendant.addEventListener("change", () => { blinkStart = performance.now(); });
  playDraw.addEventListener("click", async () => {
    if (playing) { setPlaying(false); return; }
    if (await prepareDraw() && select.value === "atlas-full") {
      blinkStart = performance.now();
      setPlaying(true);
    }
  });
  drawFrame.addEventListener("input", async () => {
    setPlaying(false);
    await prepareDraw();
  });
  const cloudLoads = new Map();
  const shadow = new T.Mesh(new T.PlaneGeometry(4, 4), new T.ShadowMaterial({ opacity:.28, depthWrite:false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = cal.floorY + .003;
  shadow.receiveShadow = true;
  shadow.visible = false;
  scene.add(shadow);

  let fixtures, fixtureEnvironment, glassEnvironment, modulePromise;
  const diffusers = new Map();
  room.scene.traverse(obj => {
    const mat = obj.material;
    if (mat?.name === "Warm opal glass" || mat?.name === "Cove diffuser") {
      diffusers.set(mat, mat.emissiveIntensity);
    }
  });
  if (query.get("ljus") === "armaturer") lighting.value = "lamps";
  let preferredLight = lighting.value;
  async function updateLighting() {
    lighting.disabled = select.value !== "mesh";
    lighting.value = lighting.disabled ? "studio" : preferredLight;
    if (lighting.value === "lamps" && !fixtures) {
      try {
        const { buildFixtures } = await (modulePromise ??= import("./armaturer.mjs"));
        if (!fixtures) {
          fixtures = buildFixtures();
          fixtures.visible = false;
          scene.add(fixtures);
        }
      } catch (err) {
        modulePromise = undefined;
        preferredLight = lighting.value = "studio";
        status.textContent = "Rummets ljus kunde inte läsas. Studioljuset visas.";
        console.error(err);
      }
    }
    const useFixtures = select.value === "mesh" && lighting.value === "lamps";
    key.visible = !useFixtures;
    fill.intensity = useFixtures ? .90 : 1.05;
    if (fixtures) fixtures.visible = useFixtures;
    for (const [mat, original] of diffusers) mat.emissiveIntensity = useFixtures ? original * 6 : original;
    if (useFixtures && !fixtureEnvironment) {
      const target = new T.WebGLCubeRenderTarget(256, { type: T.HalfFloatType });
      const cube = new T.CubeCamera(.02, 25, target);
      cube.position.copy(probe.position);
      furniture.visible = dealer.visible = false;
      scene.environment = null;
      const filter = new T.PMREMGenerator(renderer);
      try {
        cube.update(renderer, scene);
        fixtureEnvironment = filter.fromCubemap(target.texture);
        scene.environment = fixtureEnvironment.texture;
        // Glass also reflects the felt and hand from its own location.
        furniture.visible = dealer.visible = true;
        chips.visible = glass.visible = false;
        cube.position.copy(glass.position);
        cube.position.y += .054;
        cube.update(renderer, scene);
        glassEnvironment = filter.fromCubemap(target.texture);
      } finally {
        objects();
        filter.dispose();
        target.dispose();
      }
    }
    scene.environment = useFixtures ? fixtureEnvironment.texture : environment.texture;
    glass.material.envMap = useFixtures ? glassEnvironment.texture : environment.texture;
    canvas.dataset.lighting = useFixtures ? "lamps" : "studio";
  }
  lighting.addEventListener("change", () => {
    preferredLight = lighting.value;
    void updateLighting();
  });
  async function cloudRoom(option) {
    const sparkModule = await import("./spark.js");
    const { SparkRenderer, SplatMesh } = sparkModule;
    if (!spark) {
      spark = new SparkRenderer({ renderer });
      spark.visible = false;
      scene.add(spark);
    }
    const cloud = new SplatMesh({ url: url(option.dataset.src), raycastable: false });
    cloud.position.y = cal.floorY - Number(option.dataset.floor);
    try {
      await cloud.initialized;
      if (option.value === "atlas-full") updatePendant = attachPendant(cloud, sparkModule);
      return cloud;
    } catch (err) {
      cloud.dispose();
      throw err;
    }
  }
  async function background() {
    const option = select.selectedOptions[0];
    stopRecording?.();
    let nextCloud, errorMessage = "";
    if (option.dataset.src) {
      status.textContent = "Läser " + option.textContent + "…";
      if (!cloudLoads.has(option.value)) cloudLoads.set(option.value, cloudRoom(option));
      try {
        nextCloud = await cloudLoads.get(option.value);
      } catch {
        cloudLoads.delete(option.value);
        if (select.value !== option.value) return;
        select.value = "mesh";
        errorMessage = "Atlas-rummet kunde inte läsas. Originalrummet visas.";
      }
      if (!errorMessage && select.value !== option.value) return;
    }
    if (activeCloud) scene.remove(activeCloud);
    activeCloud = nextCloud;
    if (nextCloud) scene.add(nextCloud);
    if (spark) spark.visible = Boolean(nextCloud);
    room.scene.visible = !nextCloud;
    shadow.visible = Boolean(nextCloud);
    input("pendant-controls").hidden = select.value !== "atlas-full";
    input("draw-controls").hidden = select.value !== "atlas-full";
    lightOnTable.visible = false;
    if (select.value !== "atlas-full") {
      setPlaying(false);
      drawFrame.value = "1";
      input("frame-label").textContent = "1/33";
      moveHand?.(0);
    }
    blinkStart = performance.now();
    status.textContent = errorMessage;
    await updateLighting();
    canvas.dataset.background = select.value;
  }
  select.addEventListener("change", background);

  const viewDirection = new T.Vector3();
  let updateStudy;
  function render() {
    updateStudy?.();
    if (updatePendant && canvas.dataset.background === "atlas-full") {
      const seconds = (performance.now() - blinkStart) / 1000;
      const dimmed = pendant.value === "dim" || (pendant.value === "blink" && isDim(seconds));
      updatePendant(dimmed);
      canvas.dataset.pendant = dimmed ? "dim" : "steady";
      lightOnTable.visible = pendantTable.checked;
      lightOnTable.intensity = pendantCandela * (dimmed ? .12 : 1);
      if (moveHand) {
        const frame = playing ? frameAt(seconds) : Number(drawFrame.value) - 1;
        moveHand(frame);
        if (playing) drawFrame.value = String(frame + 1);
        const value = String(frame + 1);
        if (canvas.dataset.drawFrame !== value) {
          canvas.dataset.drawFrame = value;
          input("frame-label").textContent = value + "/33";
        }
      }
    }
    renderer.render(scene, camera);
    if (!activeCloud) return;
    const sorted = !spark.sorting && !spark.sortDirty && spark.activeSplats > 0
      && spark.sortedCenter.distanceToSquared(camera.position) < .000001
      && spark.sortedDir.dot(camera.getWorldDirection(viewDirection)) > .99999
      && spark.display.mapping.some(entry => entry.node === activeCloud);
    const ready = sorted ? canvas.dataset.background : "";
    if (canvas.dataset.sortedBackground !== ready) canvas.dataset.sortedBackground = ready;
  }
  function animate() { renderer.setAnimationLoop(document.hidden ? null : render); }
  document.addEventListener("visibilitychange", animate);
  animate();
  const messages = [];
  const results = await Promise.allSettled([
    applyTableMaterials(table, layout, document.baseURI),
    (async () => {
      if (canvas.dataset.dealerSource === "study") return;
      const [pose, avatar] = await Promise.all([loader.loadAsync(url("hand.glb")), loader.loadAsync(url("utseende.glb"))]);
      const source = pose.scene.getObjectByProperty("isMesh", true);
      appearance = prepareAppearance(avatar);
      firstPose = motionFrame(source, appearance);
      bodyParts = firstPose.map((piece, i) => {
        const body = new T.Mesh(piece.clone(), appearance.materials[i]);
        body.castShadow = body.receiveShadow = true;
        dealer.add(body);
        return body;
      });
    })(),
  ]);
  if (results[0].status === "rejected") messages.push("Grundmaterial visas för bordet.");
  if (results[1].status === "rejected") {
    input("dealer").checked = false;
    input("dealer").disabled = true;
    messages.push("Paulinas lokala pose saknas.");
  }
  const requested = query.get("rum");
  if (Array.from(select.options).some(option => option.value === requested)) select.value = requested;
  await background();
  if (drawRequested && select.value === "atlas-full" && await prepareDraw()) {
    blinkStart = performance.now();
    setPlaying(true);
  }
  if (messages.length) status.textContent += " " + messages.join(" ");
  canvas.dispatchEvent(new CustomEvent("roomready", { detail: {
    scene, renderer, camera, controls, glass, dealer, draw, take,
    setStudyFrame(callback) { updateStudy = callback; },
  } }));
  canvas.dataset.ready = "true";
}
start().catch(err => { console.error(err); status.textContent = "3D-vyn kunde inte öppnas. " + err.message; });
