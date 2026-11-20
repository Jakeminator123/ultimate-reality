import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rmdir, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { digest, publish } from "./publicera-kamerafil.mjs";

const base = fileURLToPath(new URL("../../avatars/paulina/rorelseprov-dans/v1/", import.meta.url));
const { values } = parseArgs({ options: {
  source: { type: "string", default: path.join(base, "rigg/dans-med-blink.glb") },
  "out-dir": { type: "string", default: path.join(base, "visning") },
  "proof-only": { type: "boolean" },
} });
const source = path.resolve(values.source);
const output = path.resolve(values["out-dir"]);
const model = await readFile(source);
const record = JSON.parse(await readFile(path.join(path.dirname(source), "blinkmatning.json"), "utf8"));
assert.equal(digest(model), record.sceneSha256);
assert.equal(record.fps, 24);
assert.equal(record.frames, 96);
const host = "http://127.0.0.1:4317";
const privateRoute = "/__dansprov/";
const frames = [];
const stills = new Map();
let measures;
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
  const html = '<!doctype html><script type="importmap">{"imports":{"three":"/bordsprov/rum3d/three.module.js","three/addons/":"/bordsprov/rum3d/addons/"}}</script><body style="margin:0"><canvas></canvas>';
  await page.route("**" + privateRoute, route => route.fulfill({ contentType: "text/html", body: html }));
  await page.route("**" + privateRoute + "modell.glb", route => route.fulfill({ contentType: "model/gltf-binary", body: model }));
  await page.goto(host + privateRoute);
  measures = await page.evaluate(async ([url, fps, count, landmarks]) => {
    const T = await import("three");
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const asset = await new GLTFLoader().loadAsync(url);
    const world = new T.Scene();
    world.background = new T.Color(0xf1f0ed);
    world.add(asset.scene);
    const canvas = document.querySelector("canvas");
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    world.add(new T.HemisphereLight(0xfffbf7, 0xd7d2ca, 1.55));
    const key = new T.DirectionalLight(0xfff3e5, 1.8);
    key.position.set(-1.9, 3.6, 3.1);
    const overhead = new T.DirectionalLight(0xfffcf8, .19);
    overhead.position.set(-.4, 5.5, 1.1);
    overhead.castShadow = true;
    overhead.shadow.mapSize.set(1024, 1024);
    Object.assign(overhead.shadow.camera, { left: -1.55, right: 1.55, top: 1.6, bottom: -1.6, near: .1, far: 9 });
    overhead.shadow.bias = -.0001;
    overhead.shadow.normalBias = .0005;
    const fill = new T.DirectionalLight(0xf3f5ff, .66);
    fill.position.set(1.7, 1.9, 2.8);
    const rim = new T.DirectionalLight(0xfffaf6, .48);
    rim.position.set(1.4, 2.8, -1.9);
    const floor = new T.Mesh(new T.PlaneGeometry(18, 18), new T.ShadowMaterial({ opacity: .085 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    world.add(key, fill, rim, overhead, floor);
    const meshes = [];
    const boots = new Set();
    const lids = [];
    asset.scene.traverse(obj => {
      if (!obj.isMesh) return;
      if (!obj.isSkinnedMesh) { obj.visible = false; return; }
      obj.frustumCulled = false;
      obj.castShadow = obj.receiveShadow = true;
      meshes.push(obj);
      if (/stövl|gummisula/i.test(obj.material.name)) boots.add(obj);
      if (obj.morphTargetDictionary?.["Blinka med båda ögonlocken"] !== undefined) lids.push(obj);
    });
    if (!meshes.length || !boots.size || !lids.length) throw Error("Kropp, stövlar eller blinkkanal saknas.");
    const left = asset.scene.getObjectByName("l_eye"), right = asset.scene.getObjectByName("r_eye");
    const mixer = new T.AnimationMixer(asset.scene);
    const action = mixer.clipAction(asset.animations[0]);
    action.setLoop(T.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    const sample = (frame, forcedBlink) => {
      action.paused = false;
      mixer.setTime(frame / fps);
      if (forcedBlink !== undefined) {
        for (const mesh of lids) mesh.morphTargetInfluences[mesh.morphTargetDictionary["Blinka med båda ögonlocken"]] = forcedBlink;
      }
      world.updateMatrixWorld(true);
    };
    const point = new T.Vector3(), overall = new T.Box3();
    const boxes = [];
    for (let frame = 0; frame < count; frame++) {
      sample(frame);
      const box = new T.Box3();
      let soles = Infinity;
      for (const mesh of meshes) {
        const shoe = boots.has(mesh);
        for (let v = 0; v < mesh.geometry.getAttribute("position").count; v++) {
          mesh.getVertexPosition(v, point).applyMatrix4(mesh.matrixWorld);
          box.expandByPoint(point);
          if (shoe) soles = Math.min(soles, point.y);
        }
      }
      overall.union(box);
      boxes.push({ min: box.min.toArray(), max: box.max.toArray(), lowestSoleM: soles });
    }
    const middle = overall.getCenter(new T.Vector3()), size = overall.getSize(new T.Vector3());
    const width = 720, height = 1280, aspect = width / height, fov = 30;
    const slope = Math.tan(T.MathUtils.degToRad(fov / 2));
    const distance = Math.max(size.x / aspect, size.y) / (2 * slope * .91);
    const camera = new T.PerspectiveCamera(fov, aspect, .025, 25);
    camera.position.set(middle.x, middle.y, overall.max.z + distance);
    camera.lookAt(middle);
    camera.updateMatrixWorld(true);
    const margin = [width, height, width, height];
    for (const b of boxes) {
      for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) {
        point.set(x, y, b.max[2]).project(camera);
        const px = (point.x + 1) * width / 2, py = (1 - point.y) * height / 2;
        margin[0] = Math.min(margin[0], px);
        margin[1] = Math.min(margin[1], py);
        margin[2] = Math.min(margin[2], width - px);
        margin[3] = Math.min(margin[3], height - py);
      }
    }
    const faceCamera = new T.PerspectiveCamera(10, 512 / 256, .025, 25);
    const eyeTarget = new T.Vector3();
    function placeFaceCamera() {
      left.getWorldPosition(eyeTarget).lerp(right.getWorldPosition(point), .5);
      faceCamera.position.set(eyeTarget.x, eyeTarget.y + .035, eyeTarget.z + .68);
      faceCamera.lookAt(eyeTarget);
      faceCamera.updateMatrixWorld(true);
    }
    window.captureDance = (frame, mode = "person", forcedBlink) => {
      sample(frame, forcedBlink);
      let cameraToUse = camera;
      if (mode === "eyes") {
        placeFaceCamera();
        renderer.setSize(512, 256, false);
        cameraToUse = faceCamera;
      } else {
        renderer.setSize(width, height, false);
      }
      renderer.render(world, cameraToUse);
      return canvas.toDataURL("image/png").split(",")[1];
    };
    const registeredFace = lids.find(obj => obj.geometry.getAttribute("_sam_index"));
    if (!registeredFace) throw Error("Den exporterade kroppen saknar SAM:s hörnregister.");
    const ids = registeredFace.geometry.getAttribute("_sam_index").array;
    const liveGaps = {};
    for (const [eye, marks] of Object.entries(landmarks)) {
      const readMidpoint = indices => {
        const mean = new T.Vector3();
        for (const id of indices) {
          const idx = ids.indexOf(id);
          if (idx < 0) throw Error("Ögonlockets SAM-punkt " + id + " saknas.");
          mean.add(registeredFace.getVertexPosition(idx, point).applyMatrix4(registeredFace.matrixWorld));
        }
        return mean.divideScalar(indices.length);
      };
      const gap = weight => {
        sample(12, weight);
        placeFaceCamera();
        const upper = readMidpoint(marks.pairedSAMUpper), lower = readMidpoint(marks.pairedSAMLower);
        const verticalMm = (upper.y - lower.y) * 1000;
        const pixels = (upper.project(faceCamera).y - lower.project(faceCamera).y) * 128;
        return { verticalMm, closeCameraPixels: pixels };
      };
      liveGaps[eye] = { open: gap(0), closed: gap(1) };
    }
    window.closeDance = () => { renderer.dispose(); renderer.forceContextLoss(); };
    return {
      width, height, verticalFovDeg: fov, positionM: camera.position.toArray(), targetM: middle.toArray(),
      minimumScreenMarginsPx: { left: margin[0], top: margin[1], right: margin[2], bottom: margin[3] },
      allSkinnedPoseBounds: boxes,
      measuredLidsOnExportedSkinnedSurfaceFrame12: liveGaps,
      apexFrame: boxes.reduce((best, b, i) => b.lowestSoleM > boxes[best].lowestSoleM ? i : best, 0),
    };
  }, [privateRoute + "modell.glb", record.fps, record.frames, record.eyes]);
  assert.ok(Object.values(measures.minimumScreenMarginsPx).every(value => value > 25));
  for (const values of Object.values(measures.measuredLidsOnExportedSkinnedSurfaceFrame12)) {
    assert.ok(values.open.closeCameraPixels > 6);
    assert.ok(Math.abs(values.closed.closeCameraPixels) < .25 * values.open.closeCameraPixels);
  }
  const keyframes = [...new Set([0, 12, measures.apexFrame, record.frames - 1])];
  for (const i of values["proof-only"] ? keyframes : Array.from({ length: record.frames }, (_, f) => f)) {
    const png = Buffer.from(await page.evaluate(f => window.captureDance(f), i), "base64");
    if (!values["proof-only"]) frames.push(png);
    if (keyframes.includes(i)) stills.set("ruta-" + String(i).padStart(3, "0") + ".png", png);
  }
  const samples = [[10, undefined], [12, undefined], [16, undefined]];
  const eyeFrames = [];
  for (const [frame, forced] of samples) {
    eyeFrames.push(Buffer.from(await page.evaluate(([f, w]) => window.captureDance(f, "eyes", w), [frame, forced]), "base64"));
  }
  const openAtClosedPose = Buffer.from(await page.evaluate(() => window.captureDance(12, "eyes", 0)), "base64");
  async function eyeDifference(a, b) {
    const first = await sharp(a).removeAlpha().raw().toBuffer();
    const second = await sharp(b).removeAlpha().raw().toBuffer();
    let changedPixels = 0;
    for (let offset = 0; offset < first.length; offset += 3) {
      if (Math.max(...[0, 1, 2].map(k => Math.abs(first[offset + k] - second[offset + k]))) > 12) changedPixels++;
    }
    return changedPixels;
  }
  measures.visibleEyelidChangeAtIdenticalFrame12Pixels = await eyeDifference(openAtClosedPose, eyeFrames[1]);
  assert.ok(measures.visibleEyelidChangeAtIdenticalFrame12Pixels > 300, "Blinkmålet måste synas i närbilden.");
  const openPortrait = Buffer.from(await page.evaluate(() => window.captureDance(12, "person", 0)), "base64");
  measures.visibleEyelidChangeFullPortraitPixels = await eyeDifference(openPortrait, stills.get("ruta-012.png"));
  assert.ok(measures.visibleEyelidChangeFullPortraitPixels > 25, "Blinkningen måste också synas i helfiguren.");
  const labels = ["Ruta 10 · öppna", "Ruta 12 · slutna", "Ruta 16 · öppna igen"];
  const layer = Buffer.from('<svg width="1536" height="42" xmlns="http://www.w3.org/2000/svg"><rect width="1536" height="42" fill="#ecece9"/>' +
    labels.map((s, i) => '<text x="' + (i * 512 + 16) + '" y="27" font-family="Arial, sans-serif" font-size="18" fill="#282b29">' + s + '</text>').join("") + "</svg>");
  const eyes = await sharp({ create: { width: 1536, height: 298, channels: 3, background: "#ecece9" } }).composite([
    { input: layer, left: 0, top: 0 }, ...eyeFrames.map((input, i) => ({ input, left: i * 512, top: 42 })),
  ]).png().toBuffer();
  stills.set("ogonlock.png", eyes);
  await page.evaluate(() => window.closeDance());
} finally {
  await browser.close();
}
await mkdir(output, { recursive: true });
for (const [name, bytes] of stills) await publish(path.join(output, name), bytes);
const summary = { sceneSha256: record.sceneSha256, fps: record.fps, frames: record.frames, ...measures };
if (!values["proof-only"]) {
  const temp = await mkdtemp(path.join(os.tmpdir(), "paulina-dansfilm-"));
  const videoFile = path.join(temp, "rorelsereferens.mp4");
  try {
    execFileSync("ffmpeg", ["-v", "error", "-f", "image2pipe", "-framerate", String(record.fps), "-i", "pipe:0",
      "-map", "0:v:0", "-an", "-c:v", "libx264", "-threads", "4", "-crf", "17",
      "-vf", "scale=out_color_matrix=bt709:out_range=tv", "-color_primaries", "bt709", "-color_trc", "bt709",
      "-colorspace", "bt709", "-pix_fmt", "yuv420p", "-movflags", "+faststart", videoFile],
    { input: Buffer.concat(frames), windowsHide: true });
    const result = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries",
      "stream=time_base,duration,avg_frame_rate,nb_frames,width,height:frame=best_effort_timestamp", "-of", "json", videoFile],
    { encoding: "utf8", windowsHide: true }));
    const stream = result.streams[0];
    const [numerator, denominator] = stream.time_base.split("/").map(Number);
    assert.equal(stream.width, measures.width);
    assert.equal(stream.height, measures.height);
    assert.equal(Number(stream.nb_frames), record.frames);
    assert.equal(Number(stream.duration), 4);
    assert.equal(stream.avg_frame_rate, "24/1");
    assert.deepEqual(result.frames.map(f => f.best_effort_timestamp * numerator * record.fps / denominator), frames.map((_, i) => i));
    const video = await readFile(videoFile);
    summary.mp4Sha256 = digest(video);
    summary.durationSeconds = Number(stream.duration);
    summary.sourceTimesSeconds = result.frames.map(f => f.best_effort_timestamp * numerator / denominator);
    const checkFrames = [...new Set([0, 12, measures.apexFrame, record.frames - 1])].sort((a, b) => a - b);
    const selection = checkFrames.map(i => "eq(n," + i + ")").join("+");
    const bytesPerFrame = measures.width * measures.height * 3;
    const decoded = execFileSync("ffmpeg", ["-v", "error", "-threads", "4", "-i", videoFile, "-vf", "select='" + selection + "'",
      "-fps_mode", "vfr", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"],
    { windowsHide: true, maxBuffer: bytesPerFrame * (checkFrames.length + 1) });
    assert.equal(decoded.length, checkFrames.length * bytesPerFrame);
    summary.decodedCheckFrames = [];
    for (const [order, frame] of checkFrames.entries()) {
      const original = await sharp(frames[frame]).removeAlpha().raw().toBuffer();
      let absoluteError = 0;
      for (let i = 0; i < bytesPerFrame; i++) absoluteError += Math.abs(original[i] - decoded[order * bytesPerFrame + i]);
      const meanRgbDifference = absoluteError / bytesPerFrame;
      assert.ok(meanRgbDifference < 4, "MP4-bildens färger avviker från den renderade referensen.");
      summary.decodedCheckFrames.push({ frame, seconds: frame / record.fps, meanRgbDifference });
    }
    await publish(path.join(output, "rorelsereferens.mp4"), video);
  } finally {
    await unlink(videoFile).catch(error => { if (error.code !== "ENOENT") throw error; });
    await rmdir(temp);
  }
}
await publish(path.join(output, values["proof-only"] ? "kameraprov.json" : "film.json"), Buffer.from(JSON.stringify(summary, null, 2) + "\n"));
console.log(JSON.stringify({ scene: summary.sceneSha256, video: summary.mp4Sha256, apex: measures.apexFrame,
  margins: measures.minimumScreenMarginsPx, blinkPixels: measures.visibleEyelidChangeAtIdenticalFrame12Pixels }));
