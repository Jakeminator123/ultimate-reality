import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = path.resolve(here, "../../..");
const require = createRequire(path.join(root, "studio/package.json"));
const { chromium } = require("playwright-core");
const three = path.dirname(require.resolve("three"));
const modules = {
  "three.module.js": path.join(three, "three.module.js"),
  "three.core.js": path.join(three, "three.core.js"),
  "test/bord/filtdjup-v1/scen.mjs": path.join(here, "scen.mjs"),
  "test/bord/filtdjup-v1/bord.mjs": path.join(here, "bord.mjs"),
  "test/bakgrund/salong-v1.mjs": path.join(root, "test/bakgrund/salong-v1.mjs"),
  "test/artefakter/kortsko-v1.mjs": path.join(root, "test/artefakter/kortsko-v1.mjs"),
};
const out = process.argv[2] ? path.resolve(process.argv[2]) : here;
await fs.mkdir(out, { recursive: true });
const origin = "http://bordsprov.localhost/";
const layoutFile = path.join(root, "test/bord/filtdjup-v1/layout-v1.json");
const layout = JSON.parse(await fs.readFile(layoutFile, "utf8"));
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage();
  await page.route("**/*", async route => {
    const url = route.request().url();
    if (url === origin) return route.fulfill({ contentType: "text/html", body: '<script type="importmap">{"imports":{"three":"/three.module.js"}}</script>' });
    const file = url.startsWith(origin) && modules[url.slice(origin.length)];
    if (!file) return route.abort();
    return route.fulfill({ contentType: "text/javascript", body: await fs.readFile(file) });
  });
  await page.goto(origin);
  const { images, metadata } = await page.evaluate(async layout => {
    const { renderPairs } = await import("/test/bord/filtdjup-v1/scen.mjs");
    return renderPairs(layout);
  }, layout);
  for (const [key, depth] of [["grund", 1.08], ["kort", 0.96]]) {
    const bounds = metadata.bounds[key];
    assert.ok(Math.abs(bounds.max[0] - bounds.min[0] - 1.60) < 0.0001);
    assert.ok(Math.abs(bounds.max[2] - bounds.min[2] - depth) < 0.0001);
  }
  for (const camera of Object.values(metadata.cameras)) {
    for (const [x,y] of Object.values(camera.pixels)) assert.ok(x >= 0 && x < metadata.width && y >= 0 && y < metadata.height, "Scenpunkt utanför kamerans bild");
  }
  const digest = bytes => createHash("sha256").update(bytes).digest("hex");
  metadata.sources = {};
  for (const file of [layoutFile, ...Object.values(modules).filter(f=>f.endsWith(".mjs"))]) {
    metadata.sources[path.relative(root,file).replaceAll("\\","/")] = digest(await fs.readFile(file));
  }
  metadata.images = {};
  const files = {};
  for (const [name, png] of Object.entries(images)) {
    const bytes = Buffer.from(png, "base64");
    assert.equal(bytes.readUInt32BE(16), metadata.width);
    assert.equal(bytes.readUInt32BE(20), metadata.height);
    metadata.images[name] = digest(bytes);
    files[name] = bytes;
  }
  assert.equal(new Set(Object.values(metadata.images)).size, 4);
  const json = JSON.stringify(metadata, null, 2);
  files["matt.json"] = Buffer.from(json + "\n");
  const template = await fs.readFile(path.join(here, "visare.mall.html"), "utf8");
  files["index.html"] = Buffer.from(template.replace("__METADATA__", json));
  // An existing result is a source version. Use a fresh directory for new exports.
  for (const [name, bytes] of Object.entries(files)) {
    const existing = await fs.readFile(path.join(out, name)).catch(e => { if (e.code !== "ENOENT") throw e; });
    if (existing && !existing.equals(bytes)) throw Error(name + " har redan en version. Ange en ny målmapp.");
  }
  for (const [name, bytes] of Object.entries(files)) await fs.writeFile(path.join(out, name), bytes);
  console.log(JSON.stringify({ output: out, bounds: metadata.bounds, cameras: metadata.cameras }));
} finally {
  await browser.close();
}
