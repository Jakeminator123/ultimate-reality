import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../../studio/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const folder = fileURLToPath(new URL(".", import.meta.url));
const studio = "http://127.0.0.1:4317/bordsprov/rum3d";
const versions = [
  { id: "atlas", file: "snabb", label: "Snabbförhandsvisning" },
  { id: "atlas-full", file: "full", label: "Full 3D-version" },
];
const seats = [4, 1];

function comparisonPage() {
  const rows = seats.map(seat => {
    const pair = versions.map(({ id, file, label }) => {
      const png = `stol-${seat}-${file}.png`;
      return `<figure><figcaption>${label} <a href="${studio}?rum=${id}&amp;stol=${seat}&amp;glas=1">Vrid i 3D</a></figcaption>
<a href="${png}"><img src="${png}" alt="${label} från Stol ${seat}" width="1600" height="900"></a></figure>`;
    }).join("\n");
    return `<section><h2>Stol ${seat}</h2><div class="pair">${pair}</div></section>`;
  }).join("\n");
  return `<!doctype html>
<html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kasinorummet i Atlas · Två 3D-versioner</title><link rel="icon" href="data:,">
<style>
:root{color-scheme:dark;font:16px "DM Sans",system-ui,sans-serif;color:#f3efe4;background:#14221c}
*{box-sizing:border-box}body{max-width:1680px;margin:auto;padding:clamp(16px,3vw,44px)}
h1,h2{font-family:Georgia,serif;font-weight:400;margin:0}h1{font-size:clamp(30px,4vw,56px)}h2{font-size:1.7rem}
section{margin:1.6rem 0 2.4rem}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
figure{margin:0}figcaption{margin:.45rem 0;display:flex;align-items:baseline;gap:1rem}a{color:#ecd5aa}
a:focus-visible{outline:2px solid #ecd5aa;outline-offset:3px}img{display:block;width:100%;height:auto;border-radius:.35rem}
@media(max-width:640px){.pair{grid-template-columns:1fr}}
</style></head><body><h1>Kasinorummet i Atlas</h1>
<p>Två 3D-versioner från samma nio kamerabilder. Bord, kortsko, Paulinas hand och studioljus är låsta. Klicka på en bild för ursprungsstorleken 1600 × 900.</p>
${rows}</body></html>`;
}

const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"] });
try {
  for (const version of versions) {
    const page = await browser.newPage({ viewport: { width: 1760, height: 1100 }, deviceScaleFactor: 1 });
    try {
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", entry => { if (entry.type() === "error") errors.push(entry.text()); });
      await page.goto(studio + "?stol=4&glas=1&rum=" + version.id);
      await page.addStyleTag({ content: "body{max-width:none;padding:0}header{height:64px;margin:0}.stage{width:1600px;height:900px;border-radius:0}" });
      const stage = page.locator("#stage");
      await page.waitForFunction(() => document.querySelector("#stage").dataset.ready === "true", null, { timeout: 180_000 });
      assert.equal(await page.locator("#status").innerText(), "");
      assert.equal(await page.locator("#background").inputValue(), version.id);
      assert.equal(await page.locator("#lighting").inputValue(), "studio");
      for (const id of ["table", "dealer", "glass"]) assert.equal(await page.locator("#" + id).isChecked(), true);
      for (const seat of seats) {
        await page.getByRole("button", { name: "Stol " + seat, exact: true }).click();
        // Give Spark's post-frame update and asynchronous depth sort a full cycle after each seat change.
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.waitForFunction(id => document.querySelector("#stage").dataset.sortedBackground === id, version.id, { timeout: 180_000 });
        const filename = `stol-${seat}-${version.file}.png`;
        const png = await stage.screenshot({ path: path.join(folder, filename), timeout: 180_000 });
        assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1600, 900]);
        console.log(filename);
      }
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  }
  await writeFile(path.join(folder, "atlas-jamforelse.html"), comparisonPage(), "utf8");
} finally {
  await browser.close();
}
