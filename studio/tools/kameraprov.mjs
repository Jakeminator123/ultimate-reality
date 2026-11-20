// Exportera den öppnade arbetsmodellens vilopose med kameran och renderaren från studion.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = fileURLToPath(new URL("../../", import.meta.url));
const studio = "http://127.0.0.1:4317";
const dealer = process.argv[2] ?? "paulina";
assert.match(dealer, /^[a-z0-9][a-z0-9-]*$/);
const hash = data => createHash("sha256").update(data).digest("hex");
const folder = await mkdtemp(path.join(os.tmpdir(), "ur-kameraprov-"));
let browser;
try {
  browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1480, height: 900 }, deviceScaleFactor: 1 });
  const loaded = new Map();
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.pathname === "/api/material" && url.searchParams.has("model"))
      loaded.set(url.searchParams.get("model"), response.body().then(hash));
  });
  await page.goto(studio + "/?dealer=" + dealer + "#modellering");
  const project = await (await page.request.get(studio + "/api/material?dealer=" + dealer + "&report=json")).json();
  assert.ok(project.geometry && project.revision, "Öppna en registrerad modellutgåva.");
  const surface = project.appearance ?? project.geometry;
  const photo = page.getByRole("button", { name: project.appearance ? "Fotoutseende · prov" : "Kroppsform", exact: true });
  await photo.click({ timeout: 90000 });
  for (const name of ["Rutnät · 10 cm", "Skelett", "Leder"]) {
    const layer = page.getByRole("button", { name, exact: true });
    if (await layer.getAttribute("aria-pressed") === "true") await layer.click();
  }
  const slider = page.getByRole("slider", { name: "Vridning", includeHidden: true, exact: true });
  const canvas = page.locator(".pose-canvas canvas");
  await page.addStyleTag({ content: ".pose-canvas{position:fixed!important;left:0;top:0;width:640px!important;height:640px!important;max-height:none!important;z-index:99999;pointer-events:none}" });
  await page.waitForFunction(() => document.querySelector(".pose-canvas canvas")?.width === 640);
  const viewUrl = await canvas.getAttribute("data-model");
  assert.equal(new URL(viewUrl, studio).searchParams.get("model"), surface.sha256);
  assert.equal(await loaded.get(surface.sha256), surface.sha256, "GLB-bytesen i den öppnade vyn avviker.");
  assert.equal(await loaded.get(project.geometry.sha256), project.geometry.sha256);

  // Tolv rutor i första läget, 60 steg till profil och tolv rutor i det sista läget.
  const fps = 24, samples = [], angleImages = new Map(), marks = [];
  const named = new Map([[0, "Front"], [45, "Trekvart"], [90, "Profil"]]);
  for (let frame = 0; frame < 84; frame++) {
    const angle = Math.round(Math.min(60, Math.max(0, frame - 11)) * 1.5);
    await slider.evaluate((node, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(node, String(value));
      node.dispatchEvent(new Event("input", { bubbles: true }));
    }, angle);
    await page.waitForFunction(deg => {
      const camera = document.querySelector(".pose-canvas canvas")?.dataset.camera;
      return camera && Math.abs(JSON.parse(camera).azimuth - deg) < .001;
    }, angle);
    const state = await canvas.evaluate(node => ({ model: node.dataset.model, camera: JSON.parse(node.dataset.camera) }));
    assert.equal(state.model, viewUrl);
    samples.push({ frame, ...state.camera });
    const output = path.join(folder, String(frame).padStart(3, "0") + ".png");
    const previous = angleImages.get(angle);
    if (previous) await copyFile(previous, output);
    else {
      await canvas.screenshot({ path: output });
      angleImages.set(angle, output);
      if (named.has(angle)) marks.push({ frame, label: named.get(angle) + " " + angle + "°" });
    }
  }
  const movie = path.join(folder, "vilopose.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-framerate", String(fps), "-i", path.join(folder, "%03d.png"),
    "-c:v", "libx264", "-threads", "4", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", movie]);
  const capture = {
    title: "Vilopose från front till profil", take: "sittvila-kameravridning-v1",
    geometry: project.geometry.sha256, appearance: project.appearance?.sha256 ?? null, card: null,
    cameras: [{ id: "Modellkameran", projection: "ortografisk", samples }], marks, videoSha256: hash(await readFile(movie)),
  };
  const receipt = path.join(folder, "tagning.json");
  await writeFile(receipt, JSON.stringify(capture));
  execFileSync(process.env.SAM3D_PYTHON || "python", [path.join(root, "tools/material_versions.py"),
    "--dealer", project.dealer, "film", "--file", movie, "--capture", receipt], { cwd: root, stdio: "inherit" });
} finally {
  try { await browser?.close(); } finally { await rm(folder, { recursive: true, force: true }); }
}
