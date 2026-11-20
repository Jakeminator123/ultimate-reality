import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rmdir, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { digest, publish } from "./publicera-kamerafil.mjs";

const app = new URL("../app/giv-plats-4/", import.meta.url);
const folder = fileURLToPath(new URL("../../avatars/paulina/giv-plats-4/v3/granskning/minspel/", import.meta.url));
const host = "http://127.0.0.1:4317";
const scene = "/giv-plats-4/v3/minspel.glb";
const glb = await readFile(path.join(folder, "minspel.glb"));
const model = JSON.parse(glb.toString("utf8", 20, 20 + glb.readUInt32LE(12)));
assert.equal(model.animations.length, 1);
assert.ok(model.animations[0].channels.some(channel => channel.target.path === "weights"));
const response = await fetch(host + scene);
assert.ok(response.ok);
assert.equal(digest(Buffer.from(await response.arrayBuffer())), digest(glb));

const fps = 24, last = 60;
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"] });
const frames = [];
const route = "/__minspelsfilm/";
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  for (const module of ["orbit-runtime.mjs", "orbit-cameras.mjs"]) {
    await page.route("**" + route + module, r => r.fulfill({ contentType: "text/javascript", path: fileURLToPath(new URL(module, app)) }));
  }
  const html = '<!doctype html><script type="importmap">{"imports":{"three":"/bordsprov/rum3d/three.module.js","three/addons/":"/bordsprov/rum3d/addons/"}}</script><body style="margin:0"><canvas style="display:block;width:1280px;height:720px"></canvas>';
  await page.route("**" + route, r => r.fulfill({ contentType: "text/html", body: html }));
  await page.goto(host + route);
  await page.evaluate(async ([base, src]) => {
    const { createOrbitScene } = await import(base + "orbit-runtime.mjs");
    window.demo = await createOrbitScene(document.querySelector("canvas"), src, new AbortController().signal);
  }, [route, scene]);
  for (let frame = 0; frame <= last; frame++) {
    const encoded = await page.evaluate(([at, rate]) => {
      window.demo.draw(at, rate, 0, "ansikte");
      return document.querySelector("canvas").toDataURL("image/png").split(",")[1];
    }, [frame, fps]);
    frames.push(Buffer.from(encoded, "base64"));
  }
  await page.evaluate(() => window.demo.dispose());
} finally {
  await browser.close();
}

assert.ok(frames[0].equals(frames[last]), "Minspelsfilmen måste återvända till exakt vila.");
assert.ok(frames[24].equals(frames[36]), "Det starkaste uttrycket ska hållas en halv sekund.");
const [rest, peak] = await Promise.all([0, 24].map(i => sharp(frames[i]).removeAlpha().raw().toBuffer()));
let changed = 0;
for (let i = 0; i < rest.length; i += 3) {
  if (rest[i] !== peak[i] || rest[i + 1] !== peak[i + 1] || rest[i + 2] !== peak[i + 2]) changed++;
}
assert.ok(changed > 0, "Ingen ändring syns i filmen.");

const temp = await mkdtemp(path.join(os.tmpdir(), "paulina-minspel-"));
const file = path.join(temp, "framifran.mp4");
try {
  execFileSync("ffmpeg", ["-v", "error", "-nostdin", "-f", "image2pipe", "-framerate", String(fps),
    "-vcodec", "png", "-i", "pipe:0", "-c:v", "libx264", "-threads", "4", "-crf", "17",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", file], { input: Buffer.concat(frames), windowsHide: true });
  const timing = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=time_base,nb_frames:frame=best_effort_timestamp", "-of", "json", file], { encoding: "utf8", windowsHide: true }));
  const [n, d] = timing.streams[0].time_base.split("/").map(Number);
  assert.equal(Number(timing.streams[0].nb_frames), last + 1);
  assert.deepEqual(timing.frames.map(f => f.best_effort_timestamp * n * fps / d), frames.map((_, i) => i));
  const video = await readFile(file);
  const record = { sceneSha256: digest(glb), clip: model.animations[0].name, fps, frames: frames.length,
    camera: "Ansikte 0°", changedPixelsAtPeak: changed, identicalNeutralFrames: [0, last], mp4Sha256: digest(video) };
  await publish(path.join(folder, "minspel.mp4"), video);
  await publish(path.join(folder, "film.json"), Buffer.from(JSON.stringify(record, null, 2) + "\n"));
  console.log(JSON.stringify(record));
} finally {
  await unlink(file).catch(err => { if (err.code !== "ENOENT") throw err; });
  await rmdir(temp);
}
