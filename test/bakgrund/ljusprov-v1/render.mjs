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
const addons = path.resolve(three, "../examples/jsm");
const origin = "http://ljusprov.localhost/";
const files = new Map();
for (const name of ["three.module.js", "three.core.js"]) files.set("/" + name, path.join(three, name));
for (const name of ["loaders/HDRLoader.js", "objects/GroundedSkybox.js"]) files.set("/addons/" + name, path.join(addons, name));
for (const file of ["test/bakgrund/ljusprov-v1/prov.mjs", "test/bakgrund/salong-v1.mjs", "test/bord/filtdjup-v1/bord.mjs", "test/artefakter/kortsko-v1.mjs"]) {
  files.set("/" + file, path.join(root, file));
}
const assetHashes = {
  studio_kontrast_04: "d21c1aa8efa72d97f77dc77213e3b7f0fa8f3f295ad6fbfff35e2adc63b69bb7",
  lythwood_lounge: "73eac612deceab404e268048c35db4b09d27d7142b5b63d11f811d6354b133c5",
};
for (const [name, hash] of Object.entries(assetHashes)) {
  const filename = name + "_4k.hdr", file = path.join(here, "../polyhaven", filename);
  assert.equal(createHash("sha256").update(await fs.readFile(file)).digest("hex"),hash,filename);
  files.set("/asset/" + filename,file);
}
const config = JSON.parse(await fs.readFile(path.join(root,"studio/lib/table-layout.json"),"utf8"));
const cal = JSON.parse(await fs.readFile(path.join(root,"test/bord/filtdjup-v1/matt.json"),"utf8"));
const variants = ["salong","studioljus","studiofond","lounge"];
const images = {};
const browser = await chromium.launch({ channel:"msedge", headless:true, args:["--enable-unsafe-swiftshader"] });
try {
  for (const variant of variants) {
    const page = await browser.newPage();
    try {
      await page.route("**/*", async route => {
        const url = route.request().url();
        if (url === origin) return route.fulfill({contentType:"text/html",body:'<script type="importmap">{"imports":{"three":"/three.module.js","three/addons/":"/addons/"}}</script>'});
        const file = url.startsWith(origin) && files.get(new URL(url).pathname);
        if (!file) return route.abort();
        return route.fulfill({contentType:file.endsWith(".hdr")?"application/octet-stream":"text/javascript",body:await fs.readFile(file)});
      });
      await page.goto(origin);
      const result = await page.evaluate(async ({config, cal, variant}) => {
        const { renderStudy } = await import("/test/bakgrund/ljusprov-v1/prov.mjs");
        return renderStudy(config, cal, variant);
      }, {config, cal, variant});
      for (const seat of [1,4]) for (const [anchor, point] of Object.entries(result.projected[seat])) {
        assert.deepEqual(point,cal.cameras[seat].pixels[anchor]);
      }
      images[variant] = result.images;
      console.log(variant + " · två kameror och tre fasta ankare verifierade");
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
assert.equal(new Set(Object.values(images).flatMap(pair=>Object.values(pair))).size,8);
const template = await fs.readFile(path.join(here,"visare.mall.html"),"utf8");
const html = template.replace("__IMAGES__", JSON.stringify(images));
const target = process.argv[2] ? path.resolve(process.argv[2]) : path.join(here,"ljusprov.html");
const existing = await fs.readFile(target,"utf8").catch(e=>{ if (e.code !== "ENOENT") throw e; });
if (existing && existing !== html) throw Error("Resultatet finns redan. Ange en ny HTML-fil för nästa version.");
await fs.writeFile(target,html);
console.log(target);
