import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = path.resolve(here, "../../..");
const require = createRequire(path.join(root, "studio/package.json"));
const {chromium} = require("playwright-core");
const three = path.dirname(require.resolve("three"));
const addons = path.resolve(three, "../examples/jsm");
const files = new Map();
for (const f of ["three.core.js", "three.module.js"]) files.set(f, path.join(three, f));
for (const f of ["loaders/GLTFLoader.js", "utils/BufferGeometryUtils.js", "utils/SkeletonUtils.js"])
  files.set("addons/" + f, path.join(addons, f));
for (const f of ["test/bakgrund/salong-v1.mjs", "test/bakgrund/kasinorum-v1/rum.mjs",
  "test/bord/filtdjup-v1/bord.mjs", "studio/lib/card-shoe.mjs"]) files.set(f, path.join(root, f));
files.set("room.glb", path.join(here, "Kasinorum.glb"));
files.set("dealer.glb", process.argv[3] ? path.resolve(process.argv[3])
  : path.join(root, "test/artefakter/kortsko-vanster-v1/sankt-arm.glb"));
const hash = createHash("sha256").update(await fs.readFile(files.get("room.glb"))).digest("hex");
if (hash !== "6c6585a3f853aafd23761ba817f8e5b016d0a29fa36bcb331890d30ae092d73a") throw Error("Rumsfilen tillhör en annan version.");
const json = async file => JSON.parse(await fs.readFile(path.join(root, file), "utf8"));
const config = {
  layout: await json("test/bord/filtdjup-v1/layout-v1.json"),
  cal: await json("test/bord/filtdjup-v1/matt.json"),
  shoeLayout: {...await json("studio/lib/card-shoe.json"), yawDegrees:-70}
};
const origin = "http://kasinoprov.localhost/";
const browser = await chromium.launch({channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"]});
try {
  const page = await browser.newPage();
  await page.route("**/*", async route => {
    const url = route.request().url();
    if (url === origin) return route.fulfill({contentType: "text/html", body: '<script type="importmap">{"imports":{"three":"/three.module.js"}}</script>'});
    const file = url.startsWith(origin) && files.get(url.slice(origin.length));
    if (!file) return route.abort();
    return route.fulfill({contentType: file.endsWith(".glb") ? "model/gltf-binary" : "text/javascript", body: await fs.readFile(file)});
  });
  await page.goto(origin);
  const {photos, checks, floor} = await page.evaluate(async config => {
    const {compareRooms} = await import("/test/bakgrund/kasinorum-v1/rum.mjs");
    return compareRooms(config);
  }, config);
  const template = await fs.readFile(path.join(here, "visare.mall.html"), "utf8");
  const output = process.argv[2] ? path.resolve(process.argv[2]) : path.join(here, "referensvinkel.html");
  const html = template.replace("__PHOTOS__", JSON.stringify(photos));
  const previous = await fs.readFile(output, "utf8").catch(e => { if (e.code !== "ENOENT") throw e; });
  if (previous && previous !== html) throw Error("Välj en ny sökväg för den ändrade versionen.");
  await fs.writeFile(output, html);
  console.log(JSON.stringify({hash, floor, checks, images: Object.keys(photos).length, output}));
} finally {
  await browser.close();
}
