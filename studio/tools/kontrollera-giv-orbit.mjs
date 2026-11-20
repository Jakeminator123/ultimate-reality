import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { digest, publish } from "./publicera-kamerafil.mjs";
import { sideFieldOfView } from "../app/giv-plats-4/orbit-cameras.mjs";

const edition = process.argv[2] ?? "v2";
assert.ok(["v1", "v2", "v3"].includes(edition), "Ange v1, v2 eller v3.");
const repo = fileURLToPath(new URL("../../", import.meta.url));
const trial = path.join(repo, "avatars/paulina/giv-plats-4");
const folder = path.join(trial, edition, "rigg"), rig = path.join(folder, "giv.glb");
const report = JSON.parse(await readFile(path.join(folder, "givmatning.json")));
const sceneSha256 = digest(await readFile(rig));
assert.equal(report.sceneSha256, sceneSha256);
const anchor = JSON.parse(await readFile(path.join(repo, "avatars/paulina/prov-ankare/v1/kameror/kameror.json")));
const code = fileURLToPath(new URL("../app/giv-plats-4/", import.meta.url));
const scripts = {};
for (const name of ["orbit-runtime.mjs", "orbit-cameras.mjs", "OrbitViewer.tsx"]) scripts[name] = digest(await readFile(path.join(code, name)));
const out = path.resolve(process.argv[3] ?? path.join(trial, edition === "v1" ? "v2" : edition, "granskning/120-vinklar",
  edition + "-" + sceneSha256.slice(0, 8) + "-" + digest(JSON.stringify(scripts)).slice(0, 8)));
const origin = "http://127.0.0.1:4317";
const sceneUrl = edition === "v1" ? "/__giv-orbit/scen.glb" : "/giv-plats-4/" + edition + "/giv.glb";
if (edition !== "v1") {
  const response = await fetch(origin + sceneUrl);
  assert.ok(response.ok, "Scenen kunde inte hämtas lokalt.");
  assert.equal(digest(Buffer.from(await response.arrayBuffer())), sceneSha256);
}
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  for (const name of ["orbit-runtime.mjs", "orbit-cameras.mjs"]) {
    await page.route("**/__giv-orbit/" + name, route => route.fulfill({
      path: path.join(code, name), contentType: "text/javascript; charset=utf-8"
    }));
  }
  if (edition === "v1") await page.route("**/__giv-orbit/scen.glb", route => route.fulfill({ path: rig, contentType: "model/gltf-binary" }));
  const inline = '<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/bordsprov/rum3d/three.module.js","three/addons/":"/bordsprov/rum3d/addons/"}}</script><body style="margin:0"><canvas style="display:block;width:1280px;height:720px"></canvas>';
  await page.route("**/__giv-orbit/", route => route.fulfill({ contentType: "text/html; charset=utf-8", body: inline }));
  await page.goto(origin + "/__giv-orbit/");
  await page.evaluate(async src => {
    const { createOrbitScene } = await import("/__giv-orbit/orbit-runtime.mjs");
    window.orbit = await createOrbitScene(document.querySelector("canvas"), src, new AbortController().signal);
  }, sceneUrl);
  async function shot(frame, index, hands, imageName) {
    const data = await page.evaluate(([f, fps, i, close, save]) => {
      window.orbit.draw(f, fps, i, close);
      const m = window.orbit.inspect();
      const image = save ? document.querySelector("canvas").toDataURL().split(",")[1] : null;
      const landmarks = Object.values(m.handLandmarksPx);
      return { seconds: m.seconds, eyeM: m.eyeM, lookAtM: m.lookAtM, verticalFovDeg: m.verticalFovDeg, cardCenterM: m.cardCenterM,
        cardCenterPx: m.cardPx.slice(0, 2), visibleCardPixels: close === "ansikte" ? null : window.orbit.measureCardVisibility(),
        minEyeMarginPx: Math.min(...m.eyeLandmarksPx.flatMap(([x, y]) => [x, y, m.width - x, m.height - y])),
        minHandMarginPx: Math.min(...landmarks.flatMap(([x, y]) => [x, y, m.width - x, m.height - y])), image };
    }, [frame, report.fps, index, hands, Boolean(imageName)]);
    if (data.image) {
      const bytes = Buffer.from(data.image, "base64");
      await publish(path.join(out, imageName), bytes);
      data.imageSha256 = digest(bytes);
    }
    delete data.image;
    return data;
  }
  const savedAngles = new Map([[0, "front"], [23, "sida69"], [60, "bakifran"]]);
  const orbit = [];
  for (let index = 0; index < 120; index++) {
    const name = savedAngles.get(index);
    const table = await shot(92, index, false, name && "r92-" + name + ".png");
    const hands = await shot(92, index, true, name && "r92-hander-" + name + ".png");
    const face = await shot(92, index, "ansikte", name && "r92-ansikte-" + name + ".png");
    assert.equal(anchor.orbit[index].number, index);
    assert.equal(anchor.orbit[index].azimuth, index * 3);
    const original = anchor.orbit[index].a23.cameraWorld;
    assert.ok(Math.abs(table.eyeM[0] - original[12]) < 1e-11 && Math.abs(table.eyeM[2] - original[14]) < 1e-11);
    assert.deepEqual(table.cardCenterM, hands.cardCenterM);
    assert.deepEqual(table.cardCenterM, face.cardCenterM);
    assert.ok(face.minEyeMarginPx > 60 && Math.abs(face.seconds - 92 / report.fps) < 1e-6);
    assert.ok(Math.abs(table.seconds - 92 / report.fps) < 1e-6);
    assert.ok(hands.minHandMarginPx > 20, "Ett finger beskärs i handläge index " + index);
    orbit.push({ index, azimuthDeg: index * 3, table, hands, face });
  }
  assert.equal(new Set(orbit.map(v => JSON.stringify(v.table.eyeM))).size, 120);
  assert.equal(new Set(orbit.map(v => JSON.stringify(v.hands.eyeM))).size, 120);
  assert.equal(new Set(orbit.map(v => JSON.stringify(v.face.eyeM))).size, 120);
  assert.equal(orbit[60].table.verticalFovDeg, sideFieldOfView(report));
  const selectedFrames = [...new Set([...Object.values(report.keyframes), 71, 92, 125])].sort((a, b) => a - b);
  const selections = {};
  const saved = edition === "v1" ? JSON.parse(await readFile(path.join(trial, "v1/visning/rendering.json"))) : null;
  let referenceFrontMatches = 0;
  for (const frame of selectedFrames) {
    selections[frame] = {};
    for (const index of [0, 23, 60, 90]) {
      const name = saved?.measurements[frame] && index === 0 ? "referens-front-" + frame + ".png" : null;
      const table = await shot(frame, index, false, name), hands = await shot(frame, index, true);
      assert.ok(hands.minHandMarginPx > 20);
      if (name && table.imageSha256 === saved.measurements[frame].front.sourcePngSha256) referenceFrontMatches++;
      selections[frame][index] = { table, hands };
    }
  }
  const allTimes = await page.evaluate(([total, fps]) => {
    const result = [];
    for (let i = 0; i < total; i++) {
      window.orbit.draw(i, fps, 0, false);
      result.push(window.orbit.inspect().seconds);
    }
    return result;
  }, [report.animationFrames, report.fps]);
  assert.ok(allTimes.every((s, i) => Math.abs(s - i / report.fps) < 1e-6));
  const summary = { sceneSha256, scripts, sceneUrl, edition, width: 1280, height: 720, fps: report.fps, frames: allTimes.length,
    profile: { angles: 120, stepDeg: 3, radiusM: 1.62, centerXZ: [.072, .233], front: { heightM: 1.4, targetYM: .82, verticalFovDeg: 40 },
      high: { startAtFromFrontDeg: 70, heightM: 1.792, targetYM: .862, verticalFovDeg: sideFieldOfView(report) },
      heightCurve: "smoothstep(t) = t²(3−2t), t = min(avståndet i grader till fronten / 70, 1). Samma kurva för blickhöjd och vertikalt synfält.",
      hands: { verticalFovDeg: 30, elevationDeg: 55, minDistanceM: .37, focus: "Båda handlederna och de tio fingertopparna. Kortets åtta hörn ingår inom 18 cm från en led. Kamerans avstånd anpassas efter den aktuella vinkelns projektion." } },
    faceCloseUp: { radiusM: .96, cameraAboveTargetM: .10, targetBelowEyesM: .022, verticalFovDeg: 22, views: orbit.length },
    allFrameTimesVerified: true, testedFrame: 92, testedViews: orbit.length,
    r92: Object.fromEntries(["table", "hands"].map(mode => [mode, {
      withVisibleCard: orbit.filter(v => v[mode].visibleCardPixels > 0).length,
      hiddenAtDeg: orbit.filter(v => v[mode].visibleCardPixels === 0).map(v => v.azimuthDeg),
      minHandMarginPx: Math.min(...orbit.map(v => v[mode].minHandMarginPx))
    }])),
    referenceFront: saved ? { exactSourcePngMatches: referenceFrontMatches, expected: Object.keys(saved.measurements).length } : null,
    orbit, selectedFrames: selections };
  await publish(path.join(out, "kamera-kvitto.json"), Buffer.from(JSON.stringify(summary, null, 2) + "\n"));
  console.log(out, JSON.stringify({ r92: summary.r92, referenceFront: summary.referenceFront, frames: allTimes.length }));
  await page.evaluate(() => window.orbit.dispose());
} finally {
  await browser.close();
}
