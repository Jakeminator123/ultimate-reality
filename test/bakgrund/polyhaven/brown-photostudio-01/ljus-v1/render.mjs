import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const output = fileURLToPath(new URL(".", import.meta.url));
const require = createRequire(new URL("../../../../../studio/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const base = "http://127.0.0.1:4317/bordsprov/brown-studio";
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 1660, height: 1030 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", item => { if (item.type() === "error") errors.push(item.location().url + " " + item.text()); });
  await page.goto(base + "?stol=4");
  await page.addStyleTag({ content: "body{max-width:none;padding:0}header{height:52px;margin:0}.stage{width:1600px;height:900px;border-radius:0}" });
  const waitLight = value => page.waitForFunction(value => document.querySelector("#stage").dataset.environment === value, value, { timeout: 180_000 });
  await waitLight("mild");
  assert.equal(await page.locator("#status").innerText(), "");
  for (const id of ["table", "dealer", "glass"]) assert.ok(await page.locator("#" + id).isChecked());
  for (const seat of [4, 1]) {
    const view = page.getByRole("button", { name: "Stol " + seat, exact: true });
    await view.click();
    assert.equal(await view.getAttribute("aria-pressed"), "true");
    for (const lighting of ["studio", "mild", "hdr"]) {
      await page.locator("#env-light").selectOption(lighting);
      await waitLight(lighting);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const name = `stol-${seat}-${lighting}.png`;
      const image = await page.locator("#stage").screenshot({ path: path.join(output, name), timeout: 90_000 });
      assert.deepEqual([image.readUInt32BE(16), image.readUInt32BE(20)], [1600, 900]);
      console.log(name);
    }
  }
  await page.getByRole("link", { name: "Se fotostudion i 360°" }).click();
  await page.waitForFunction(() => document.querySelector("#panorama")?.dataset.ready === "true", null, { timeout: 90_000 });
  const pano = page.locator("#panorama");
  const initial = await pano.screenshot({ path: path.join(output, "panorama.png") });
  await page.getByRole("button", { name: "Vrid åt höger" }).click();
  assert.ok(!initial.equals(await pano.screenshot()), "Riktningen ska ändras.");
  await page.getByRole("button", { name: "Till utgångsvyn" }).click();
  assert.deepEqual(await pano.screenshot(), initial);
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
