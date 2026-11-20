import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const folder = fileURLToPath(new URL(".", import.meta.url));
const require = createRequire(new URL("../../../studio/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 1760, height: 1100 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", err => errors.push(err.message));
  page.on("console", entry => { if (entry.type() === "error") errors.push(entry.location().url + " " + entry.text()); });
  await page.goto("http://127.0.0.1:4317/bordsprov/rum3d?stol=4&glas=1");
  await page.addStyleTag({ content: "body{max-width:none;padding:0}header{height:64px;margin:0}.stage{width:1600px;height:900px;border-radius:0}" });
  const stage = page.locator("#stage");
  await page.waitForFunction(() => document.querySelector("#stage").dataset.ready === "true");
  assert.equal(await page.locator("#status").innerText(), "");
  assert.equal(await page.locator("#background").inputValue(), "mesh");
  for (const id of ["table", "dealer", "glass"]) assert.equal(await page.locator("#" + id).isChecked(), true);
  const box = await stage.boundingBox();
  assert.deepEqual([box.width, box.height], [1600, 900]);
  for (const seat of [4, 1]) {
    await page.getByRole("button", { name: "Stol " + seat, exact: true }).click();
    for (const [setting, label] of [["studio", "fore"], ["lamps", "efter"]]) {
      await page.locator("#lighting").selectOption(setting);
      await page.waitForFunction(value => document.querySelector("#stage").dataset.lighting === value, setting);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const file = `stol-${seat}-${label}.png`;
      const png = await stage.screenshot({ path: path.join(folder, file), timeout: 60_000 });
      assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1600, 900]);
      console.log(file);
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
