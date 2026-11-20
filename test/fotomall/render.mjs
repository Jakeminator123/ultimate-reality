// From studio, with the Node version pinned in package.json:
// node ../test/fotomall/render.mjs [view-name ...]
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const studio = path.resolve(here, "../../studio");
const require = createRequire(path.join(studio, "package.json"));
const { chromium } = require("playwright-core");
const sharp = require("sharp");
const three = path.dirname(require.resolve("three"));
const output = path.join(studio, "public/fotomall/docka");
const origin = "http://fotomall.localhost/";
const files = new Map([
  ["scene.mjs", path.join(here, "scene.mjs")],
  ["three.module.js", path.join(three, "three.module.js")],
  ["three.core.js", path.join(three, "three.core.js")],
]);
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage();
  await page.route("**/*", async route => {
    const url = route.request().url();
    if (url === origin) return route.fulfill({
      contentType: "text/html",
      body: '<script type="importmap">{"imports":{"three":"/three.module.js"}}</script>',
    });
    const file = url.startsWith(origin) && files.get(url.slice(origin.length));
    if (!file) return route.abort();
    return route.fulfill({ contentType: "text/javascript", body: await fs.readFile(file) });
  });
  await page.goto(origin);
  const views = await page.evaluate(async () => Object.keys((await import("/scene.mjs")).views));
  const selected = process.argv.slice(2);
  if (selected.some(name => !views.includes(name))) throw Error("Okänd vy.");
  await fs.mkdir(output, { recursive: true });
  for (const name of selected.length ? selected : views) {
    const png = await page.evaluate(async name => (await import("/scene.mjs")).render(name), name);
    await sharp(Buffer.from(png.split(",")[1], "base64"))
      .resize(720, 880)
      .webp({ quality: 90, effort: 6, smartSubsample: true })
      .toFile(path.join(output, name + ".webp"));
    console.log(name);
  }
} finally {
  await browser.close();
}
