import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../../../studio/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const output = fileURLToPath(new URL(".", import.meta.url));
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"] });
const tmp = await mkdtemp(path.join(os.tmpdir(), "ur-pendeldrag-"));
const timeline = [];
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", err => errors.push(err.message));
  await page.goto("http://127.0.0.1:4317/bordsprov/rum3d?rum=atlas-full&stol=4&glas=1&blink=1&drag=1");
  await page.addStyleTag({ content: "body{max-width:none;padding:0}.stage{width:960px;height:540px;border-radius:0}header{height:55px;margin:0}" });
  await page.waitForFunction(() => document.querySelector("canvas").dataset.ready === "true", null, { timeout: 150000 });
  assert.equal(await page.locator("#status").innerText(), "");
  assert.equal(await page.locator("#play-draw").getAttribute("aria-pressed"), "true");
  await page.locator("#play-draw").click();
  // Export the actual WebGL framebuffer on its next draw, before the browser clears it.
  const capture = async (frame, light, coupled) => {
    return Buffer.from(await page.evaluate(async ({ frame, light, coupled }) => {
      const canvas = document.querySelector("canvas");
      const pendant = document.querySelector("#pendant"), slider = document.querySelector("#draw-frame");
      const switched = pendant.value !== light || canvas.dataset.drawFrame !== String(frame);
      document.querySelector("#pendant-table").checked = coupled;
      pendant.value = light;
      slider.value = String(frame);
      slider.dispatchEvent(new Event("input", { bubbles:true }));
      const raf = () => new Promise(resolve => requestAnimationFrame(resolve));
      do { await raf(); } while (canvas.dataset.drawFrame !== String(frame) || canvas.dataset.pendant !== light || canvas.dataset.sortedBackground !== "atlas-full");
      if (switched) { await raf(); await raf(); }
      const pixels = canvas.toDataURL("image/png");
      if (!pixels.startsWith("data:image/png;base64,")) throw Error("Canvasen saknar PNG-bild");
      return pixels.slice(pixels.indexOf(",") + 1);
    }, { frame, light, coupled }), "base64");
  };
  const sequence = await page.evaluate(async () => {
    const { frameAt } = await import(new URL("utdrag.mjs", document.baseURI));
    const { isDim } = await import(new URL("pendel.mjs", document.baseURI));
    return Array.from({ length: 72 }, (_, i) => [frameAt(i / 24) + 1, isDim(i / 24) ? "dim" : "steady"]);
  });
  const stillsOnly = process.argv.includes("--stills");
  for (const seat of [4, 1]) {
    await page.getByRole("button", { name: "Stol " + seat, exact: true }).click();
    for (const coupled of [false, true]) {
      for (const light of ["steady", "dim"]) {
        const name = "stol-" + seat + "-ruta17-" + (coupled ? "bord-" : "bakgrund-") + light + ".png";
        await writeFile(path.join(output, name), await capture(17, light, coupled));
      }
    }
    console.log("Ruta 17 från Stol", seat);
    if (stillsOnly) continue;
    const frames = new Map();
    for (let i = 0; i < sequence.length; i++) {
      const [frame, light] = sequence[i], id = light + frame;
      if (!frames.has(id)) frames.set(id, await capture(frame, light, true));
      await writeFile(path.join(tmp, seat + "-" + String(i).padStart(3,"0") + ".png"), frames.get(id));
      if (seat === 4) timeline.push({ videoFrame: i, pose: frame, light });
    }
    console.log("Alla 33 lägen från Stol", seat);
  }
  assert.deepEqual(errors, []);
  if (!stillsOnly) {
    const ft = path.join(process.env.WINDIR, "Fonts", "segoeui.ttf").replaceAll("\\", "/").replace(":", "\\:");
    const label = (seat,x) => "drawtext=fontfile='" + ft + "':text='Stol " + seat + "':fontsize=26:fontcolor=white:x=" + x + ":y=8";
    execFileSync("ffmpeg", ["-hide_banner","-loglevel","error","-y", ...[4,1].flatMap(s=>["-framerate","24","-i",path.join(tmp,s+"-%03d.png")]),
      "-filter_complex_threads","4","-filter_complex","[0:v][1:v]hstack,pad=iw:ih+48:0:48:color=0x18201d,"+label(4,"14")+","+label(1,"w/2+14"),
      "-frames:v","72","-c:v","libx264","-threads","4","-crf","15","-pix_fmt","yuv420p","-movflags","+faststart",path.join(output,"pendelljus-kortutdrag.mp4")]);
    assert.equal(new Set(timeline.map(f=>f.pose)).size,33);
    assert.deepEqual(timeline.filter(f=>f.light==="dim").map(f=>f.videoFrame), Array.from({length:12},(_,i)=>36+i));
    await writeFile(path.join(output,"tidslinje.json"),JSON.stringify(timeline)+"\n");
  }
  await page.close();
} finally {
  await browser.close();
  await rm(tmp, { recursive:true, force:true });
}
