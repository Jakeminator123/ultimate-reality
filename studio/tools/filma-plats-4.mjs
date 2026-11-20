import { chromium } from "playwright-core";
import sharp from "sharp";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { digest, publish, readIfPresent } from "./publicera-kamerafil.mjs";
import { sideFieldOfView } from "../app/giv-plats-4/orbit-cameras.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const version = path.join(repo, "avatars/paulina/giv-plats-4/v1");
const args = process.argv.slice(2);
const anchor = args.includes("--ankare");
const preview = anchor || args.includes("--prov");
const requestedFrames = args.filter(value => value.startsWith("--rutor="));
assert.ok(requestedFrames.length <= 1 && (!requestedFrames.length || preview), "--rutor används tillsammans med --prov eller --ankare.");
assert.ok(!requestedFrames.length || /^--rutor=\d+(,\d+)*$/.test(requestedFrames[0]), "Ange nollbaserade rutor separerade med komma.");
const extraFrames = requestedFrames.length ? [...new Set(requestedFrames[0].slice(8).split(",").map(Number))].sort((a, b) => a - b) : [];
const positional = args.filter(value => value !== "--ankare" && value !== "--prov" && !value.startsWith("--rutor="));
assert.ok(positional.length <= 2 && !positional.some(value => value.startsWith("--")),
  "Använd filma-plats-4.mjs [giv.glb] [visningsmapp] [--ankare | --prov] [--rutor=71,92].");
const rig = positional[0] ? path.resolve(positional[0]) : anchor ?
  path.join(repo, "avatars/paulina/prov-ankare/v1/rigg/ankare.glb") : path.join(version, "rigg/giv.glb");
const reportFile = path.join(path.dirname(rig), anchor ? "posematning.json" : "givmatning.json");
const reportBytes = await readFile(reportFile);
const report = JSON.parse(reportBytes);
assert.ok(extraFrames.every(n => Number.isSafeInteger(n) && n >= 0 && n < report.animationFrames), "En begärd granskningsruta ligger utanför klippet.");
const sceneSha256 = digest(await readFile(rig));
assert.equal(sceneSha256, report.sceneSha256, "Mätningen och GLB måste avse samma scen.");
const sources = ["ankarkameran.mjs", "givkameran.mjs", "filma-plats-4.mjs"];
const scripts = Object.fromEntries(await Promise.all(sources.map(async script =>
  [script, digest(await readFile(new URL(script, import.meta.url)))])));
const radiusM = 1.62;
function view(azimuthDeg, heightM, targetYM, verticalFovDeg, label) {
  const angle = azimuthDeg * Math.PI / 180;
  return {
    label, azimuthDeg, heightM, verticalFovDeg, radiusM, width: 1280, height: 720,
    positionM: [.072 + radiusM * Math.sin(angle), heightM, .233 + radiusM * Math.cos(angle)],
    lookAtM: [.072, targetYM, .233]
  };
}
const views = {
  front: view(0, 1.4, .82, 40, "Front 0° · 1,40 m"),
  sida70: view(70, 1.792, .862, sideFieldOfView(report), "Kontroll +70° · 1,792 m")
};
const recipeSha256 = digest(JSON.stringify({ scripts, views, extraFrames }));
const out = positional[1] ? path.resolve(positional[1]) : preview ?
  path.join(version, "visning/arbetsprov", (anchor ? "ankarutsnitt-" : "giv-") + sceneSha256.slice(0, 8) + "-" + recipeSha256.slice(0, 8)) :
  path.join(version, "visning");
const register = path.join(out, preview ? "kameraprov.json" : "rendering.json");
const required = ["a1", "ready", "draw", "handoff", "land", "release", "rest"];
const keyframes = anchor ? {
  a1: Math.round(report.poses.A1.time * report.fps),
  ready: Math.round(report.poses["A2.3"].time * report.fps)
} : report.keyframes;
assert.ok(keyframes && typeof keyframes === "object", "Riggens nyckelrutor saknas.");
for (const key of (anchor ? ["a1", "ready"] : required)) {
  assert.ok(Number.isInteger(keyframes[key]) && keyframes[key] >= 0 && keyframes[key] < report.animationFrames,
    "Riggen saknar giltig nollbaserad ruta för " + key);
}
const timeline = { fps: report.fps, frames: report.animationFrames, keyframes };
const phases = { a1: "Sittande", ready: "Vid skon", draw: "Utdrag", handoff: "Handbyte", land: "Landning", flat: "Kortet ligger plant", release: "Släpp", rest: "Slutläge" };
const cardNode = anchor ? "Gult skokorts synliga rygg" : report.cardNode;
const stockNode = "Nästa gula kort i skon";
const p4M = anchor ? [0, .6552, .8300] : report.p4M;
assert.ok(typeof cardNode === "string" && p4M?.length === 3);
const input = {
  scene: path.relative(repo, rig).replaceAll("\\", "/"), sceneSha256, bodySha256: report.bodySha256,
  measurements: path.relative(repo, reportFile).replaceAll("\\", "/"), measurementsSha256: digest(reportBytes),
  rendererScripts: scripts, recipeSha256
};
const present = await readIfPresent(register);
if (present) {
  const recorded = JSON.parse(present);
  assert.deepEqual(recorded.input, input, "Versionskonflikt. Välj en ny visningsmapp.");
  assert.deepEqual(recorded.timeline, timeline);
  const mediaNames = preview ? Object.keys(recorded.media) : ["front.mp4", "sida70.mp4", "jamforelse.mp4", "oversikt.jpg"];
  assert.ok(mediaNames.includes("oversikt.jpg"));
  for (const name of mediaNames) {
    assert.equal(path.basename(name), name);
    assert.equal(digest(await readFile(path.join(out, name))), recorded.media[name].sha256, name);
  }
  console.log("Verifierad utgåva " + register);
  process.exit(0);
}

function header(width, columns) {
  const body = columns.map(([x, text]) => '<text x="' + x + '" y="31">' + text + '</text>').join("");
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width +
    '" height="48"><rect width="100%" height="100%" fill="#1f2d26"/><g font-family="Segoe UI, sans-serif" font-size="19" fill="#f3f0df">' +
    body + '</g></svg>';
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const ffmpeg = args => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", ...args]);
function encodedTiming(filename) {
  const entries = "stream=width,height,nb_frames,avg_frame_rate,time_base,duration:frame=best_effort_timestamp";
  const data = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", entries, "-of", "json", filename],
    { encoding: "utf8", maxBuffer: 2_000_000 }));
  const stream = data.streams[0];
  assert.equal(stream.avg_frame_rate, report.fps + "/1");
  assert.equal(Number(stream.nb_frames), report.animationFrames);
  const [num, den] = stream.time_base.split("/").map(Number);
  const pts = data.frames.map(f => Number(f.best_effort_timestamp));
  assert.equal(pts.length, report.animationFrames);
  for (const [frame, tick] of pts.entries()) assert.equal(tick * num * report.fps, frame * den, "PTS-avvikelse i ruta " + frame);
  return { width: stream.width, height: stream.height, frames: pts.length, fps: report.fps, ptsTimeBase: stream.time_base,
    ptsFirst: pts[0], ptsLast: pts.at(-1), ptsStep: pts[1] - pts[0], durationSeconds: Number(stream.duration) };
}

function checkPairedPanel(paired, single, left) {
  const filter = "[0:v]crop=1280:720:" + left + ":48[panel];[panel][1:v]psnr=stats_file=-";
  const stats = ffmpeg(["-i", paired, "-i", single, "-filter_complex", filter, "-f", "null", "-"]).toString();
  const ratios = [...stats.matchAll(/\bpsnr_avg:(inf|[\d.]+)/g)].map(match => match[1] === "inf" ? Infinity : Number(match[1]));
  assert.equal(ratios.length, report.animationFrames, "Antalet bildpar skiljer sig vid jämförelse efter avkodning.");
  const lowest = Math.min(...ratios);
  assert.ok(lowest >= 35, "En avkodad panel avviker synligt från sin separata kamerafilm.");
  return { regionPx: [left, 48, 1280, 720], framesCompared: ratios.length, exactFrames: ratios.filter(n => n === Infinity).length,
    minimumPsnrDb: Number.isFinite(lowest) ? lowest : null };
}

sharp.concurrency(4);
await mkdir(out, { recursive: true });
const temp = await mkdtemp(path.join(os.tmpdir(), "paulina-plats4-rutor-"));
const imageFile = (tag, frame) => path.join(temp, tag + "-" + String(frame).padStart(4, "0") + ".png");
const frameIds = [...new Set([...Object.values(keyframes), ...extraFrames])].sort((a, b) => a - b);
const samples = preview ? frameIds : Array.from({ length: report.animationFrames }, (_, n) => n);
const manifest = { schema: 1, input, sceneSha256, bodySha256: report.bodySha256, timeline,
  clipPoseSeconds: report.seconds, clock: "Pose och exponering läses vid n/fps i båda kamerorna. Nollbaserade rutor.",
  cardNode, p4M, mouthM: report.mouthM, cardMaterials: [], cameras: {}, measurements: {}, measuredKeyframes: frameIds, framing: {},
  magazine: { node: stockNode, materials: [], centerM: null, maxDisplacementM: 0 },
  trajectory: { node: cardNode, maxCenterDifferenceBetweenViewsM: 0, samples: [] }, media: {} };
let browser;
try {
  browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const html = '<!doctype html><html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/bordsprov/rum3d/three.module.js","three/addons/":"/bordsprov/rum3d/addons/"}}</script><body style="margin:0"><canvas data-scene="/__giv-prov/giv.glb"></canvas><script type="module" src="/__giv-prov/givkameran.mjs"></script></body></html>';
  for (const name of ["ankarkameran.mjs", "givkameran.mjs"]) {
    await page.route("**/__giv-prov/" + name, route => route.fulfill({
      contentType: "text/javascript; charset=utf-8", path: fileURLToPath(new URL(name, import.meta.url))
    }));
  }
  await page.route("**/__giv-prov/giv.glb", route => route.fulfill({ contentType: "model/gltf-binary", path: rig }));
  await page.route("**/__giv-prov/", route => route.fulfill({ contentType: "text/html; charset=utf-8", body: html }));
  const browserErrors = [];
  page.on("pageerror", e => browserErrors.push(e.message));
  await page.goto("http://127.0.0.1:4317/__giv-prov/");
  await page.waitForFunction(() => window.captureDeal || window.problem, null, { timeout: 60_000 })
    .catch(e => { throw Error(browserErrors.join("\n") || e.message); });
  const problem = await page.evaluate(() => window.problem);
  if (problem) throw Error(problem);
  const materials = await page.evaluate(([name, stock]) => window.selectDealCard(name, stock), [cardNode, stockNode]);
  manifest.cardMaterials = materials.dealt;
  manifest.magazine.materials = materials.nextStock;
  for (const tag of Object.keys(views)) {
    const margins = { measuredFrames: samples.length, minHairTopPx: Infinity, minCardBottomPx: Infinity, minCardSidePx: Infinity, minProjectedP4BottomPx: Infinity,
      leastVisibleLeftHandPixels: Infinity, leastVisibleRightHandPixels: Infinity, leastVisibleCardPixels: Infinity,
      framesWithoutVisibleCard: [], measuredCardPixels: 0, yellowCardPixels: 0, measuredCardBoundaryPixels: 0, yellowCardBoundaryPixels: 0, whiteCardBoundaryPixels: 0 };
    for (const [index, n] of samples.entries()) {
      const shot = await page.evaluate(([t, camera, target]) => window.captureDeal(t, camera, target, true), [n / report.fps, views[tag], p4M]);
      const png = Buffer.from(shot.png, "base64");
      await writeFile(imageFile(tag, n), png);
      const card = shot.card.boundsPx, hair = shot.measured.boundsPx.crown;
      assert.ok(hair, "Hjässan saknas i " + tag + " ruta " + n);
      if (shot.nextStock) {
        const { magazine } = manifest;
        magazine.centerM ??= shot.nextStock.centerM;
        const driftM = Math.hypot(...shot.nextStock.centerM.map((v, axis) => v - magazine.centerM[axis]));
        magazine.maxDisplacementM = Math.max(magazine.maxDisplacementM, driftM);
      }
      margins.minHairTopPx = Math.min(margins.minHairTopPx, hair[1]);
      margins.minCardBottomPx = Math.min(margins.minCardBottomPx, 720 - card[3]);
      margins.minCardSidePx = Math.min(margins.minCardSidePx, card[0], 1280 - card[2]);
      margins.minProjectedP4BottomPx = Math.min(margins.minProjectedP4BottomPx, 720 - Math.max(...shot.p4CardCornersPx.map(p => p[1])));
      margins.leastVisibleLeftHandPixels = Math.min(margins.leastVisibleLeftHandPixels, shot.measured.counts.leftHand);
      margins.leastVisibleRightHandPixels = Math.min(margins.leastVisibleRightHandPixels, shot.measured.counts.rightHand);
      const { color, counts } = shot.measured;
      margins.leastVisibleCardPixels = Math.min(margins.leastVisibleCardPixels, counts.card);
      if (counts.card === 0) margins.framesWithoutVisibleCard.push(n);
      margins.measuredCardPixels += counts.card;
      margins.yellowCardPixels += color.yellow;
      margins.measuredCardBoundaryPixels += color.boundarySamples;
      margins.yellowCardBoundaryPixels += color.yellowBoundary;
      margins.whiteCardBoundaryPixels += color.whiteBoundary;
      const positions = manifest.trajectory.samples;
      positions[index] ??= { frame: n, seconds: n / report.fps, centerM: shot.card.centerM, screenPx: {} };
      positions[index].screenPx[tag] = shot.card.centerPx;
      const disagreementM = Math.hypot(...shot.card.centerM.map((v, axis) => v - positions[index].centerM[axis]));
      manifest.trajectory.maxCenterDifferenceBetweenViewsM = Math.max(manifest.trajectory.maxCenterDifferenceBetweenViewsM, disagreementM);
      if (!manifest.cameras[tag]) manifest.cameras[tag] = { ...views[tag], ...shot.matrices, p4CenterPx: shot.p4CenterPx, p4CardCornersPx: shot.p4CardCornersPx };
      if (frameIds.includes(n)) {
        manifest.measurements[n] ??= {};
        manifest.measurements[n][tag] = { time: n / report.fps, card: shot.card, nextStock: shot.nextStock, ...shot.measured, sourcePngSha256: digest(png) };
      }
      manifest.animationDurationSeconds = shot.animationDurationSeconds;
    }
    manifest.framing[tag] = margins;
    console.log(tag, JSON.stringify(margins));
  }
  await browser.close();
  browser = null;

  const posterKeys = anchor ? ["a1", "ready"] : ["draw", "handoff", "release", "rest"];
  manifest.posterFrames = posterKeys.map(phase => ({ phase, frame: keyframes[phase], timeSeconds: keyframes[phase] / timeline.fps }));
  const w = 640, h = 360, row = 48 + h;
  const tiles = [];
  for (const [i, { phase, frame }] of manifest.posterFrames.entries()) {
    const names = Object.values(views).map(({ label }, j) =>
      [j * w + 15, label + "  /  " + phases[phase] + " · ruta " + frame]);
    tiles.push({ input: await header(w * 2, names), left: 0, top: i * row });
    for (const [col, tag] of Object.keys(views).entries()) {
      tiles.push({ input: await sharp(imageFile(tag, frame)).resize(w, h).png().toBuffer(), left: col * w, top: i * row + 48 });
    }
  }
  const posterName = "oversikt.jpg";
  const posterBytes = await sharp({ create: { width: w * 2, height: row * posterKeys.length, channels: 3, background: "#1f2d26" } })
    .composite(tiles).jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toBuffer();
  const posterSize = await sharp(posterBytes).metadata();
  manifest.media[posterName] = { sha256: digest(posterBytes), width: posterSize.width, height: posterSize.height };
  const results = new Map([[posterName, posterBytes]]);
  if (preview && !anchor) {
    for (const n of samples) {
      for (const tag of Object.keys(views)) {
        const file = imageFile(tag, n), name = path.basename(file), bytes = await readFile(file);
        manifest.measurements[n][tag].image = name;
        manifest.media[name] = { sha256: digest(bytes), width: 1280, height: 720 };
        results.set(name, bytes);
      }
    }
  }
  if (!preview) {
    assert.ok(manifest.trajectory.maxCenterDifferenceBetweenViewsM < 1e-6, "Kortcentret avviker mellan kamerorna.");
    assert.ok(manifest.magazine.centerM && manifest.magazine.maxDisplacementM < 1e-6, "Nästa gula magasinskort ska vara kvar i kortskon.");
    for (const [tag, margins] of Object.entries(manifest.framing)) {
      assert.ok(margins.minHairTopPx >= 20 && margins.minCardBottomPx >= 20 && margins.minCardSidePx >= 20,
        tag + " ger för litet utrymme kring hjässa eller kort: " + JSON.stringify(margins));
      const rested = manifest.measurements[keyframes.rest][tag];
      const distanceM = Math.hypot(...rested.card.centerM.map((v, i) => v - p4M[i]));
      assert.ok(distanceM < .005, tag + ": kortets mitt avviker " + (distanceM * 1000).toFixed(1) + " mm från P4.");
      assert.ok(rested.counts.card >= 100, tag + ": kortet är skymt i slutläget.");
      assert.ok(rested.color.yellow >= .95 * rested.counts.card && rested.color.whiteBoundary === 0,
        tag + ": kontrollera kortets färg och kontur i slutläget.");
      assert.ok(rested.counts.nextStock > 0 && rested.yellowStockPixels > .95 * rested.counts.nextStock,
        tag + ": nästa gula kort syns inte tydligt i kortskons mynning i slutläget.");
    }
    const encoder = ["-c:v", "libx264", "-threads", "4", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
    const sequence = tag => ["-framerate", String(report.fps), "-i", path.join(temp, tag + "-%04d.png")];
    for (const tag of Object.keys(views)) ffmpeg([...sequence(tag), ...encoder, path.join(temp, tag + ".mp4")]);
    const banner = path.join(temp, "kamerarubrik.png");
    await writeFile(banner, await header(2560, Object.values(views).map(({ label }, i) => [1280 * i + 20, label])));
    ffmpeg([...sequence("front"), ...sequence("sida70"), "-loop", "1", "-framerate", String(report.fps), "-i", banner,
      "-filter_complex_threads", "4", "-filter_complex", "[0:v][1:v]hstack=inputs=2[panels];[2:v][panels]vstack=inputs=2:shortest=1",
      "-frames:v", String(timeline.frames), ...encoder, path.join(temp, "jamforelse.mp4")]);
    for (const name of ["front.mp4", "sida70.mp4", "jamforelse.mp4"]) {
      const filename = path.join(temp, name), bytes = await readFile(filename);
      manifest.media[name] = { ...encodedTiming(filename), sha256: digest(bytes) };
      results.set(name, bytes);
    }
    const paired = path.join(temp, "jamforelse.mp4");
    manifest.pairPanels = Object.fromEntries(Object.keys(views).map((tag, i) =>
      [tag, checkPairedPanel(paired, path.join(temp, tag + ".mp4"), i * 1280)]));
  }
  for (const [name, bytes] of results) {
    const existing = await readIfPresent(path.join(out, name));
    if (existing) assert.equal(digest(existing), digest(bytes), "Versionskonflikt i " + name);
  }
  for (const [name, bytes] of results) await publish(path.join(out, name), bytes);
  await publish(register, Buffer.from(JSON.stringify(manifest, null, 2) + "\n"));
  console.log(register);
} finally {
  if (browser) await browser.close();
  assert.equal(path.dirname(temp), path.resolve(os.tmpdir()));
  assert.ok(path.basename(temp).startsWith("paulina-plats4-rutor-"));
  await rm(temp, { recursive: true, force: true });
}
