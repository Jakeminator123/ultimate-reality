import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rmdir, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { digest, publish } from "./publicera-kamerafil.mjs";

const base = fileURLToPath(new URL("../../avatars/paulina/giv-plats-4/dashboardklipp/v1/", import.meta.url));
const code = new URL("../app/giv-plats-4/", import.meta.url);
const sceneUrl = "/giv-plats-4/dashboardklipp/v1/filmrorelse.glb";
const host = "http://127.0.0.1:4317";
const output = path.resolve(process.argv[2] ?? path.join(base, "visning"));
const measurement = JSON.parse(await readFile(path.join(base, "rigg/rorelsematning.json"), "utf8"));
const response = await fetch(host + sceneUrl);
assert.ok(response.ok, "Den registrerade GLB:n måste vara tillgänglig i labbstudion.");
assert.equal(digest(Buffer.from(await response.arrayBuffer())), measurement.sceneSha256);
const { frames, fps } = measurement;
const width = 1280, height = 720;
assert.equal(frames, measurement.sourceTimesSeconds.length);
assert.ok(measurement.sourceTimesSeconds.every((time, i) => Math.abs(time - i / fps) < 1e-6));
const images = [];
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const route = "/__dashboardfilm/";
  for (const name of ["orbit-runtime.mjs", "orbit-cameras.mjs"]) {
    await page.route("**" + route + name, r => r.fulfill({ path: fileURLToPath(new URL(name, code)), contentType: "text/javascript" }));
  }
  const html = '<!doctype html><script type="importmap">{"imports":{"three":"/bordsprov/rum3d/three.module.js","three/addons/":"/bordsprov/rum3d/addons/"}}</script><body style="margin:0"><canvas style="display:block;width:100vw;height:100vh"></canvas>';
  await page.route("**" + route, r => r.fulfill({ contentType: "text/html", body: html }));
  await page.goto(host + route);
  await page.evaluate(async url => {
    const { createOrbitScene } = await import("/__dashboardfilm/orbit-runtime.mjs");
    window.rigg = await createOrbitScene(document.querySelector("canvas"), url, new AbortController().signal);
  }, sceneUrl);
  for (let frame = 0; frame < frames; frame++) {
    const image = await page.evaluate(([number, rate]) => {
      window.rigg.draw(number, rate, 0, "helbild");
      return document.querySelector("canvas").toDataURL("image/png").split(",")[1];
    }, [frame, fps]);
    images.push(Buffer.from(image, "base64"));
  }
  await page.evaluate(() => window.rigg.dispose());
} finally {
  await browser.close();
}
assert.ok(!images[0].equals(images.at(-1)), "Den animerade kroppen ska byta pose.");
const temp = await mkdtemp(path.join(os.tmpdir(), "paulina-dashboardfilm-"));
const file = path.join(temp, "v4-front.mp4");
try {
  execFileSync("ffmpeg", ["-v", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "pipe:0",
    "-c:v", "libx264", "-threads", "4", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", file],
    { input: Buffer.concat(images), windowsHide: true });
  const video = await readFile(file);
  const info = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries",
    "stream=time_base,nb_frames,width,height:frame=best_effort_timestamp", "-of", "json", file], { encoding: "utf8", windowsHide: true }));
  const stream = info.streams[0];
  const [numerator, denominator] = stream.time_base.split("/").map(Number);
  assert.equal(Number(stream.nb_frames), frames);
  assert.equal(stream.width, width);
  assert.equal(stream.height, height);
  assert.deepEqual(info.frames.map(f => f.best_effort_timestamp * numerator * fps / denominator), images.map((_, i) => i));
  await mkdir(output, { recursive: true });
  const result = { sceneSha256: measurement.sceneSha256, sourceVideoSha256: measurement.sourceVideoSha256,
    mp4Sha256: digest(video), frames, fps, measuredSourceFrames: measurement.measuredSourceFrames,
    interpolatedFrames: measurement.interpolatedFrames, lastPoseSeconds: measurement.sourceTimesSeconds.at(-1),
    width, height, camera: "Helbild 0°" };
  await publish(path.join(output, "v4-front.mp4"), video);
  await publish(path.join(output, "v4-front.json"), Buffer.from(JSON.stringify(result, null, 2) + "\n"));
  console.log(result.mp4Sha256, frames + " rutor", "sista pose " + result.lastPoseSeconds + " s");
} finally {
  await unlink(file).catch(error => { if (error.code !== "ENOENT") throw error; });
  await rmdir(temp);
}
