import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDim } from "./pendel.mjs";

const require = createRequire(new URL("../../../../studio/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const output = fileURLToPath(new URL(".", import.meta.url));
const tmp = await mkdtemp(path.join(os.tmpdir(), "ur-pendel-"));
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://127.0.0.1:4317/bordsprov/rum3d?rum=atlas-full&stol=4&glas=1");
  await page.addStyleTag({ content: "body{max-width:none;padding:0}header{height:64px;margin:0}.stage{width:960px;height:540px;border-radius:0}" });
  await page.waitForFunction(() => document.querySelector("#stage").dataset.ready === "true", null, { timeout: 180_000 });
  const stage = page.locator("#stage");
  assert.equal(await page.locator("#status").innerText(), "");
  assert.equal(await page.locator("#pendant-controls").isVisible(), true);
  for (const seat of [4, 1]) {
    await page.getByRole("button", { name: "Stol " + seat, exact: true }).click();
    for (const state of ["steady", "dim"]) {
      await page.locator("#pendant").selectOption(state);
      await page.waitForFunction(state => {
        const data = document.querySelector("#stage").dataset;
        return data.pendant === state && data.sortedBackground === "atlas-full";
      }, state, { timeout: 180_000 });
      // Spark applies recolour to its sort buffer after rendering the current frame.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
      await stage.screenshot({ path: path.join(tmp, seat + "-" + state + ".png"), timeout: 180_000 });
      console.log(seat, state);
    }
  }
  await page.locator("#pendant").selectOption("blink");
  await page.locator("#record-view").click();
  for (const state of ["dim", "steady", "dim"]) {
    await page.waitForFunction(state => document.querySelector("#stage").dataset.pendant === state, state, { timeout: 30_000 });
  }
  await page.locator("#record-view").click();
  await page.locator("#recorded-view").waitFor();
  const recordingBytes = await page.locator("#recorded-view").evaluate(async link => (await (await fetch(link.href)).blob()).size);
  assert.ok(recordingBytes > 2000, "Inspelningen saknar bilddata");
  console.log("Liveinspelning", recordingBytes, "byte");
  assert.deepEqual(errors, []);
  await page.close();
} finally {
  await browser.close();
}

try {
  // Keep both seats in sync even if a software GPU takes longer than one frame to sort the full world.
  const fps = 24, frames = 9 * fps;
  const inputs = [4, 1].flatMap(seat => ["steady", "dim"].map(state => path.join(tmp, seat + "-" + state + ".png")));
  const switches = [];
  for (let frame = 0; frame < frames; frame++) {
    if (isDim(frame / fps) && (frame === 0 || !isDim((frame - 1) / fps))) switches.push([frame]);
    if (isDim(frame / fps) && !isDim((frame + 1) / fps)) switches.at(-1).push(frame);
  }
  assert.deepEqual(switches, [[36, 47], [108, 119], [180, 191]]);
  const expression = switches.map(([first, last]) => `between(n,${first},${last})`).join("+");
  const fontFile = path.join(process.env.WINDIR ?? "C:/Windows", "Fonts", "segoeui.ttf").replaceAll("\\", "/").replace(":", "\\:");
  const label = (text, x, y, size) => `drawtext=fontfile='${fontFile}':text='${text}':fontsize=${size}:fontcolor=white:x=${x}:y=${y}`;
  const filter = ["[0:v][2:v]hstack[normal]", "[1:v][3:v]hstack[dim]", `[normal][dim]overlay=enable='${expression}',crop=iw:540,pad=iw:ih+48:0:48:color=0x18201d`,
    label("Stol 4", 14, 8, 26), label("Stol 1", "w/2+14", 8, 26)];
  const graph = filter.slice(0, 2).join(";") + ";" + filter.slice(2).join(",");
  const ff = ["-hide_banner", "-loglevel", "error", "-y", ...inputs.flatMap(name => ["-loop", "1", "-framerate", String(fps), "-i", name])];
  execFileSync("ffmpeg", [...ff, "-filter_complex_threads", "4", "-filter_complex", graph, "-frames:v", String(frames),
    "-c:v", "libx264", "-threads", "4", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(output, "lampblink.mp4")]);
  const details = inputs.map((_, i) => {
    const [x,y] = i < 2 ? [680, 68] : [145, 87];
    return `[${i}:v]crop=150:150:${x}:${y},scale=300:300,pad=300:336:0:36:color=0x18201d,${label("Stol " + (i < 2 ? 4 : 1) + (i % 2 ? " · Dämpat" : " · Fast sken"), 12, 4, 20)}[detail${i}]`;
  });
  const detailGraph = [...details, "[detail0][detail2]hstack[top]", "[detail1][detail3]hstack[bottom]", "[top][bottom]vstack"].join(";");
  execFileSync("ffmpeg", [...ff, "-filter_complex_threads", "4", "-filter_complex", detailGraph, "-frames:v", "1", "-q:v", "2", path.join(output, "kontroll.jpg")]);
  for (const [i, centre] of [[0, [755, 143]], [1, [220, 162]]]) {
    const rgb = inputs.slice(2*i, 2*i+2).map(file => execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 4_000_000 }));
    let normal = 0, dim = 0, count = 0, changedOutside = 0;
    for (let y = 0; y < 540; y++) for (let x = 0; x < 960; x++) {
      const index = 3 * (y * 960 + x);
      const dx = Math.abs(x-centre[0]), dy = Math.abs(y-centre[1]);
      const a = rgb[0][index + 1], b = rgb[1][index + 1];
      if (dx < 11 && dy < 10 && a > 150) { normal += a; dim += b; count++; }
      if ((dx > 175 || dy > 175) && Math.abs(a - b) > 5) changedOutside++;
    }
    assert.ok(count > 20 && dim / normal < .70, "Ljuskärnan måste mörkna tydligt");
    assert.ok(changedOutside < 250, "Ljusändringen sprids utanför nischen");
    console.log("Stol", [4, 1][i], "kärnans gröna kanal", (dim / normal).toFixed(3), "ändrade pixlar utanför nischen", changedOutside);
  }
  await rm(tmp, { recursive: true, force: true });
  console.log("9 s • 24 bilder/s •", path.join(output, "lampblink.mp4"));
} catch (error) {
  console.error("Kontrollbilder för felsökning:", tmp);
  throw error;
}
