import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const folder = fileURLToPath(new URL(".", import.meta.url));
const require = createRequire(new URL("../../../../../studio/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const temp = await mkdtemp(path.join(os.tmpdir(), "ur-handljus-"));
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"] });
const stillsOnly = process.argv.includes("--stills");
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
try {
  const page = await browser.newPage({ viewport: { width: 1640, height: 1030 }, deviceScaleFactor: 1 });
  const errors = [], wrongAssets = [];
  page.on("pageerror", err => errors.push(err.message));
  page.on("request", request => {
    if (/\/rum3d\/(hand|utseende|drag-\d+)\.glb/.test(request.url())) wrongAssets.push(request.url());
  });
  await page.addInitScript(() => document.addEventListener("roomready", event => {
    const { camera, controls } = event.detail;
    window.readStudyCamera = () => ({
      position:camera.position.toArray(), target:controls.target.toArray(), fov:camera.fov,
      aspect:camera.aspect, near:camera.near, far:camera.far,
    });
  }, { capture: true, once: true }));
  await page.addInitScript(() => document.addEventListener("handready", event => {
    const { fill, scene, glass, renderer } = event.detail;
    window.handLighting = {
      brownPhotostudioFraction:.5, environmentIntensity:scene.environmentIntensity,
      glassEnvironmentIntensity:glass.material.envMapIntensity, exposure:renderer.toneMappingExposure,
      emitters:fill.children.filter(child => child.isSpotLight).map(light => ({
        position:light.position.toArray(), target:light.target.position.toArray(),
        distanceToTargetM:light.position.distanceTo(light.target.position), intensityCd:light.intensity,
        halfAngleDeg:light.angle*180/Math.PI, penumbra:light.penumbra,
        colorSRGB:light.color.getHexString(), castShadow:light.castShadow,
      })),
    };
  }, { capture:true, once:true }));
  const animatedModel = page.waitForResponse(r => new URL(r.url()).pathname === "/bordsprov/handljus/pose.glb", { timeout:180000 });
  await page.goto("http://127.0.0.1:4317/bordsprov/handljus?stol=4");
  await page.addStyleTag({ content: "body{max-width:none;padding:0}.stage{width:1600px;height:900px;border-radius:0}" });
  await page.waitForFunction(() => document.querySelector("#stage").dataset.handReady, null, { timeout: 180000 });
  assert.equal(await page.locator("#status").innerText(), "");
  const rigResponse = await animatedModel;
  assert.equal(rigResponse.status(),200);
  const rigSha256 = sha256(await rigResponse.body());
  const cameras = {};
  const lighting = await page.evaluate(() => window.handLighting);
  assert.equal(lighting.emitters.length, 4);
  await page.locator("#play-hand").click();
  await page.waitForFunction(() => document.querySelector("#stage").dataset.pose === "33", null, { timeout: 30000 });
  assert.equal(await page.locator("#play-hand").getAttribute("aria-pressed"), "false");

  const keyFrames = [1, 17, 33];
  for (const seat of [4, 1]) {
    const cameraButton = page.getByRole("button", { name: "Stol " + seat, exact: true });
    await cameraButton.click();
    assert.equal(await cameraButton.getAttribute("aria-pressed"), "true");
    cameras[seat] = await page.evaluate(() => window.readStudyCamera());
    for (const light of ["utan", "mjukt"]) {
      await page.locator("#soft-fill").setChecked(light === "mjukt");
      const values = (light === "utan" || stillsOnly) ? keyFrames : Array.from({ length:33 }, (_, i) => i + 1);
      for (const frame of values) {
        const encoded = await page.evaluate(async ({ frame, light }) => {
          const canvas = document.querySelector("#stage"), slider = document.querySelector("#hand-frame");
          slider.value = String(frame);
          slider.dispatchEvent(new Event("input"));
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          if (canvas.dataset.pose !== String(frame) || canvas.dataset.fill !== light) throw Error("Fel ljus eller pose vid fångst.");
          return canvas.toDataURL("image/png").split(",")[1];
        }, { frame, light });
        const pixels = Buffer.from(encoded, "base64");
        assert.deepEqual([pixels.readUInt32BE(16), pixels.readUInt32BE(20)], [1600,900]);
        if (keyFrames.includes(frame)) await writeFile(path.join(folder, `stol-${seat}-ruta${frame}-${light}.png`), pixels);
        if (light === "mjukt" && !stillsOnly) await writeFile(path.join(temp, `${seat}-${String(frame).padStart(2,"0")}.png`), pixels);
      }
      console.log("Stol", seat, light, values.length, "bilder");
    }
  }
  assert.deepEqual(wrongAssets, []);
  assert.deepEqual(errors, []);
  await page.close();
  execFileSync("python", [path.join(folder, "jamfor.py")], { stdio: "inherit" });
  if (!stillsOnly) {
    const font = path.join(process.env.WINDIR, "Fonts", "segoeui.ttf").replaceAll("\\","/").replace(":", "\\:");
    const label = (value, x, y, size) => `drawtext=fontfile='${font}':text='${value}':fontcolor=white:fontsize=${size}:x=${x}:y=${y}`;
    const graph = [
      "[0:v]split[full4][detail4]", "[1:v]split[full1][detail1]",
      "[full4]scale=800:450[top4]", "[full1]scale=800:450[top1]",
      "[top4][top1]hstack,pad=1600:486:0:36:color=0x18201d," + label("Stol 4",12,3,22) + "," + label("Stol 1",812,3,22) + "[top]",
      "[detail4]crop=320:120:831:379,scale=800:300[close4]",
      "[detail1]crop=320:120:605:367,scale=800:300[close1]",
      "[close4][close1]hstack,pad=1600:332:0:32:color=0x18201d," + label("Vänsterhand och sko",12,3,19) + ","
        + label("Vänsterhand och sko",812,3,19) + "[bottom]",
      "[top][bottom]vstack,tpad=start=12:stop=27:start_mode=clone:stop_mode=clone",
    ].join(";");
    execFileSync("ffmpeg", ["-nostdin","-hide_banner","-loglevel","error","-y",
      ...[4,1].flatMap(seat => ["-framerate","24","-start_number","1","-i",path.join(temp,seat+"-%02d.png")]),
      "-filter_complex_threads","4","-filter_complex",graph,"-c:v","libx264","-threads","4","-crf","15",
      "-pix_fmt","yuv420p","-movflags","+faststart",path.join(folder,"kortdrag-v2.mp4")]);
    const probe = JSON.parse(execFileSync("ffprobe", ["-v","error","-select_streams","v:0","-show_entries",
      "stream=width,height,nb_frames,r_frame_rate,duration","-of","json",path.join(folder,"kortdrag-v2.mp4")]));
    assert.equal(probe.streams[0].nb_frames, "72");
    assert.equal(Number(probe.streams[0].duration), 3);
    const timeline = Array.from({ length: 72 }, (_, i) => ({ videoFrame: i, pose: Math.max(1, Math.min(33, i-11)) }));
    await writeFile(path.join(folder,"tidslinje.json"), JSON.stringify({ fps:24, take:"skoriktning-70-30-v1", motionVersion:"paulina-kortdrag-v2-v1", frames:timeline })+"\n");
    const filmSha256 = sha256(await readFile(path.join(folder,"kortdrag-v2.mp4")));
    const record = {
      film:"kortdrag-v2.mp4", filmSha256, rigSha256, modelUrl:rigResponse.url(), units:"meter",
      cameras, lighting, fps:24, width:1600, height:818, totalFrames:72, additionalStartHold:12, additionalEndHold:27,
      marks:[{frame:12,pose:1},{frame:28,pose:17},{frame:44,pose:33}],
    };
    await writeFile(path.join(folder,"filmunderlag.json"),JSON.stringify(record,null,2)+"\n");
    console.log(probe.streams[0]);
  }
} finally {
  await browser.close();
  await rm(temp, { recursive:true, force:true });
}
