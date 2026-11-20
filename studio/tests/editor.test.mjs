import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import next from "next";
import { chromium } from "playwright-core";

test(
  "två beskurna bilder, exakt JSON och filmgranskning återkommer från en sparad version",
  { timeout: 100000 },
  async (t) => {
    const temporary = await fs.mkdtemp(
      path.join(os.tmpdir(), "ultimate-reality-studio-test-"),
    );
    const root = path.join(temporary, "ultimate-reality-lab");
    assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
    t.after(() => fs.rm(temporary, { recursive: true, force: true }));
    await fs.mkdir(root);
    await Promise.all(
      ["inputs", "orders"].map((name) => fs.mkdir(path.join(root, name))),
    );
    await fs.writeFile(path.join(root, ".owner"), "ultimate-reality-lab/v1");
    process.env.ULTIMATE_REALITY_STORAGE = temporary;
    const previousKey = process.env.RUNWAYML_API_SECRET;
    process.env.RUNWAYML_API_SECRET = "local-test-sentinel";
    t.after(() => {
      if (previousKey === undefined) delete process.env.RUNWAYML_API_SECRET;
      else process.env.RUNWAYML_API_SECRET = previousKey;
    });
    const fixture = path.join(temporary, "granskning.mp4");
    const image = path.join(temporary, "referens.png");
    execFileSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=360x320:rate=8",
        "-t",
        "2",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        fixture,
      ],
      { windowsHide: true },
    );
    execFileSync(
      "ffmpeg",
      ["-v", "error", "-i", fixture, "-frames:v", "1", image],
      { windowsHide: true },
    );
    const app = next({ dev: false, dir: process.cwd() });
    await app.prepare();
    const server = http.createServer(app.getRequestHandler());
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = "http://127.0.0.1:" + server.address().port;
    const browser = await chromium.launch({
      channel: "msedge",
      headless: true,
      args: process.env.STUDIO_TEST_NO_WEBGL ? ["--disable-webgl"] : [],
      executablePath: process.env.STUDIO_TEST_BROWSER || undefined,
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
      });
      page.setDefaultTimeout(8000);
      const appErrors = [];
      const remote = [];
      page.on("pageerror", (error) => appErrors.push(error.message));
      page.on("request", (req) => {
        if (/^https?:/.test(req.url()) && !req.url().startsWith(origin + "/"))
          remote.push(req.url());
      });
      await page.goto(origin);
      await t.test("dealervalet öppnar Paulinas rigg eller ett tomt bildutkast och faserna följer med", async () => {
        async function mobileWidth() {
          await page.setViewportSize({ width: 320, height: 800 });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await page.setViewportSize({ width: 1280, height: 900 });
        }
        await page.getByRole("heading", { name: "Välj din dealer" }).waitFor();
        await mobileWidth();
        await page.getByRole("link", { name: "Börja med egna foton" }).click();
        assert.equal(await page.getByLabel("Version", { exact: true }).inputValue(), "");
        const work = page.getByRole("navigation", { name: "Arbetsyta" });
        await work.getByRole("link", { name: /Fas 1.*Bildpipeline/ }).click();
        await page.getByRole("heading", { name: "Bildstandard för en dealer" }).waitFor();
        await mobileWidth();
        assert.equal(await work.getByRole("link", { name: /Fas 1.*Bildpipeline/ }).getAttribute("aria-current"), "page");
        await work.getByRole("link", { name: "Översikt" }).click();
        await page.getByRole("link", { name: "Öppna Paulinas modell" }).click();
        await page.getByRole("heading", { name: "3D-modellering" }).waitFor();
        await mobileWidth();
        assert.equal(await work.getByRole("link", { name: /Fas 2.*3D-modell/ }).getAttribute("aria-current"), "page");
      });
      await page.getByRole("heading", { name: "Paulinas bildserie" }).waitFor();
      const material = await (await page.request.get(origin + "/api/material?report=json&dealer=paulina")).json();
      await page.getByRole("heading", { name: "Modellens underlag" }).waitFor();
      assert.equal(await page.getByRole("region", { name: "Paulinas bildserie" }).getByRole("button").count(), material.photos.length);
      await t.test("materialrapport och filmrutor följer de sparade filversionerna", async () => {
        const report = await page.request.get(origin + "/api/material?report=md&dealer=paulina");
        const markdown = await report.text();
        for (const photo of material.photos) {
          assert.ok(markdown.includes(photo.sha256));
          assert.ok(markdown.includes(photo.width + " × " + photo.height));
        }
        if (material.photos.length) {
          const wrong = new URL(material.photos[0].url, origin);
          wrong.searchParams.set("sha", "0".repeat(64));
          assert.equal((await page.request.get(wrong.href)).status(), 409);
        }
        const film = material.films.find(f => f.take === "sittvila-kameravridning-v1");
        if (film) {
          assert.equal(film.geometry, material.geometry.sha256);
          assert.equal(film.appearance, material.appearance?.sha256 ?? null);
          const partial = await page.request.get(origin + film.url, { headers: { Range: "bytes=0-15" } });
          assert.equal(partial.status(), 206);
          assert.equal((await partial.body()).length, 16);
          await page.getByText(film.title, { exact: true }).click();
          for (const review of film.reviews)
            await page.getByText(review.camera + " · ruta " + review.frames.join(", "), { exact: true }).first().waitFor();
          const mark = film.marks.find(m => m.seconds > 0);
          if (mark) {
            await page.getByRole("button", { name: mark.label + " · ruta " + mark.frame }).click();
            await page.waitForFunction(({ title, seconds }) => {
              const video = Array.from(document.querySelectorAll("video")).find(v => v.getAttribute("aria-label") === title);
              return video && !video.seeking && Math.abs(video.currentTime - seconds) < .001;
            }, { title: film.title, seconds: mark.seconds });
          }
        }
      });
      await t.test("en ny materialversion läses in i den öppna modelleringsvyn", async () => {
        const stamp = origin + "/api/material?dealer=paulina&stamp=1";
        assert.match((await (await page.request.get(stamp)).json()).stamp, /^[a-f0-9]{64}$/);
        await page.route(stamp, r => r.fulfill({ json: { stamp: "simulerad ny export" } }));
        try {
          const updated = page.waitForResponse(response => {
            const url = new URL(response.url());
            return url.pathname === "/api/material" && url.searchParams.get("report") === "json";
          });
          await page.evaluate(() => window.dispatchEvent(new Event("focus")));
          assert.equal((await updated).status(), 200);
        } finally { await page.unroute(stamp); }
      });
      await t.test("sittbilderna kan jämföras i originalens utsnitt och i frontens skala", async () => {
        const link = page.getByRole("link", { name: "Jämför sitthöjd och bildskala" });
        if (await link.count()) await link.click();
        else await page.goto(origin + "/bildstandard/sitthojd");
        await page.getByRole("heading", { name: "Sittande i tre vinklar" }).waitFor();
        const figures = page.locator("figure");
        if (await figures.count()) {
          assert.equal(await figures.count(), 3);
          const profile = figures.last().locator("img");
          assert.match(await profile.getAttribute("style"), /scale\(1\)/);
          const tolerance = page.getByRole("slider", { name: "Gräns för skalskillnad" });
          await figures.last().getByText("Granska utsnittet", { exact: true }).waitFor();
          const profileRow = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Profil" }) });
          await profileRow.getByText("−3,88 %").or(profileRow.getByText("-3,88 %")).first().waitFor();
          await tolerance.press("End");
          await figures.last().getByText("Utsnitt inom gränserna", { exact: true }).waitFor();
          await page.getByRole("button", { name: "Samma bildskala" }).click();
          assert.match(await profile.getAttribute("style"), /scale\(1\.040/);
          if (await profileRow.getByText("2 av 4").count()) await profileRow.getByText("Ej mätbart").waitFor();
          await page.getByRole("checkbox", { name: "Mätlinjer" }).uncheck();
          assert.equal(await figures.locator('[aria-hidden="true"]').count(), 0);
        } else {
          await page.getByText(/De lokala bilderna och mätningen/).waitFor();
        }
        await page.getByRole("link", { name: "3D-modellering" }).click();
        await page.getByRole("heading", { name: "Paulinas bildserie" }).waitFor();
      });
      await t.test("v2 byter synlig modell och fungerar med bara kroppsformen", async (modelTest) => {
        const current = await (await page.request.get(origin + "/api/modeling?current=1")).json();
        if (!current.activeModel?.appearanceUrl || process.env.STUDIO_TEST_NO_WEBGL) {
          modelTest.skip("Fotoutseendet och WebGL behövs för det visuella riggprovet.");
          return;
        }
        const neutral = page.getByRole("button", { name: "Kroppsform", exact: true });
        const look = page.getByRole("button", { name: "Fotoutseende · prov" });
        await neutral.click();
        const canvas = page.locator(".pose-canvas canvas");
        const neutralPixels = await canvas.screenshot();
        await look.click();
        assert.equal(await look.getAttribute("aria-pressed"), "true");
        assert.notDeepEqual(await canvas.screenshot(), neutralPixels);
        await page.getByRole("button", { name: "Sittande i trekvart" }).click();
        assert.equal(await look.getAttribute("aria-pressed"), "true");
        const lookPixels = await canvas.screenshot();
        await page.getByRole("button", { name: "Endast rigg" }).click();
        assert.equal(await look.getAttribute("aria-pressed"), "false");
        assert.equal(await page.getByRole("button", { name: "Skelett", exact: true }).getAttribute("aria-pressed"), "true");
        await page.getByRole("checkbox", { name: "Alla 127 leder" }).check();
        await page.getByText("127 visas", { exact: true }).waitFor();
        const rigPixels = await canvas.screenshot();
        assert.notDeepEqual(rigPixels, lookPixels);
        await page.locator("summary").filter({ hasText: "Prova armar och fingrar" }).click();
        const measurements = page.locator(".rig-joint-measurements");
        const restAngle = await measurements.locator("dd").first().innerText();
        await page.getByRole("slider", { name: /Böjning/ }).press("End");
        assert.notDeepEqual(await canvas.screenshot(), rigPixels);
        assert.notEqual(await measurements.locator("dd").first().innerText(), restAngle);
        await page.getByLabel("Led att prova").selectOption("r_index1");
        await measurements.getByText("Led till fingertopp", { exact: true }).waitFor();
        await page.locator("summary").filter({ hasText: "Kameravärden" }).click();
        await page.getByRole("slider", { name: "Avstånd till riktpunkt" }).press("End");
        assert.match(await page.locator(".rig-camera summary").innerText(), /6 m/);
        await page.getByRole("slider", { name: "Vridning" }).press("Home");
        assert.match(await page.locator(".rig-camera summary").innerText(), /Bakifrån/);
        await page.getByRole("button", { name: "Trekvart", exact: true }).click();
        const cameraSummary = page.locator(".rig-camera summary");
        assert.match(await cameraSummary.innerText(), /Vänster trekvart · sidled 45° · höjdvinkel 0° · 3 m/);
        const elevation = page.getByRole("slider", { name: "Höjdvinkel" });
        await elevation.press("ArrowRight");
        await elevation.press("ArrowRight");
        await cameraSummary.getByText("Utanför sittreceptets vinkel").waitFor();
        assert.match(await cameraSummary.innerText(), /höjdvinkel 2°/);
        await page.getByRole("button", { name: "Trekvart", exact: true }).click();
        const pivotHeight = page.getByRole("slider", { name: "Riktpunktens höjd över 3D-golvet" });
        const cameraHeight = async () => JSON.parse(await canvas.getAttribute("data-camera"));
        const beforeShift = await cameraHeight();
        await pivotHeight.press("ArrowRight");
        const afterShift = await cameraHeight();
        const shift = afterShift.target[1] - beforeShift.target[1];
        assert.ok(shift > .004 && shift < .016);
        assert.ok(Math.abs(shift - (afterShift.position[1] - beforeShift.position[1])) < 1e-6);
        assert.ok(Math.abs(afterShift.elevation - beforeShift.elevation) < 1e-6);
        await page.getByRole("button", { name: "Trekvart", exact: true }).click();
        await page.getByRole("checkbox", { name: "Visa riktpunkt och tillgängliga ögonlinjer" }).check();
        await page.locator(".rig-target").waitFor();
        if (await page.locator(".rig-eye-comparison").count()) {
          await page.locator(".rig-eye-model").waitFor();
          assert.ok(Number.parseFloat(await page.locator(".rig-eye-model").evaluate(e => e.style.top)) > 0);
          await page.locator(".rig-eye-photo").waitFor();
        }
        await page.getByRole("checkbox", { name: "Visa riktpunkt och tillgängliga ögonlinjer" }).uncheck();
        await look.click();
        assert.equal(await page.getByRole("button", { name: "Leder", exact: true }).getAttribute("aria-pressed"), "true");
        await page.getByRole("button", { name: "Återställ leder" }).click();
        const jawOption = page.getByLabel("Led att prova").locator('option[value="c_jaw"]');
        if (await jawOption.count()) {
          const skeleton = page.getByRole("button", { name: "Skelett", exact: true });
          const joints = page.getByRole("button", { name: "Leder", exact: true });
          await skeleton.click(); await joints.click();
          await page.getByLabel("Led att prova").selectOption("c_jaw");
          const closedJaw = await canvas.screenshot();
          await page.getByRole("slider", { name: /Käköppning/ }).press("End");
          assert.notDeepEqual(await canvas.screenshot(), closedJaw);
          await page.getByRole("button", { name: "Återställ leder" }).click();
          assert.deepEqual(await canvas.screenshot(), closedJaw);
          await skeleton.click(); await joints.click();
          await page.getByLabel("Led att prova").selectOption("l_lowarm");
          await page.getByRole("button", { name: "Trekvart", exact: true }).click();
        }
        if (process.env.STUDIO_RIG_QA_SCREEN) {
          await page.getByRole("checkbox", { name: "Alla 127 leder" }).uncheck();
          await page.locator("summary").filter({ hasText: "Prova armar och fingrar" }).click();
          await page.setViewportSize({ width: 1360, height: 1120 });
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({ path: process.env.STUDIO_RIG_QA_SCREEN });
          await page.setViewportSize({ width: 1280, height: 900 });
        }
        const file = origin + current.activeModel.appearanceUrl;
        await page.route(file, route => route.fulfill({ status: 404, body: "" }));
        try {
          await page.reload();
          await page.getByText("En alternativ modellfil kunde inte läsas på den här datorn.").waitFor();
          assert.equal(await neutral.isEnabled(), true);
          assert.equal(await neutral.getAttribute("aria-pressed"), "true");
          assert.equal(await look.isDisabled(), true);
        } finally {
          await page.unroute(file);
        }
      });
      await page.getByRole("link", { name: "Filmutkast", exact: true }).click();
      await page.getByText("API-nyckel konfigurerad på servern.").waitFor();
      const config = await page.request.get(origin + "/api/runway");
      assert.deepEqual(await config.json(), { state: "configured" });
      const denied = await page.request.post(origin + "/api/runway", {
        headers: { Origin: "https://example.invalid" },
      });
      assert.equal(denied.status(), 403);
      process.env.RUNWAYML_API_SECRET = "";
      const missing = await page.request.post(origin + "/api/runway");
      assert.deepEqual(await missing.json(), { state: "missing" });
      process.env.RUNWAYML_API_SECRET = "local-test-sentinel";
      await page.getByRole("button", { name: "Spara version" }).waitFor();
      await page.locator(".screen img").waitFor();
      if (process.env.STUDIO_QA_SCREEN)
        await page.screenshot({ path: process.env.STUDIO_QA_SCREEN });
      await page.getByRole("button", { name: "Byt startbild" }).click();
      await page.locator("input[type=file]").setInputFiles(image);
      await page
        .locator(".viewer-foot")
        .getByText("referens.png", { exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Beskär", exact: true }).click();
      const original = await page.locator(".screen img").getAttribute("src");
      await page.getByRole("slider", { name: "Zoom" }).press("End");
      await page.waitForFunction(
        (uri) =>
          document.querySelector(".screen img")?.getAttribute("src") !== uri &&
          document.querySelector(".screen img"),
        original,
      );
      const cropped = await page.locator(".screen img").getAttribute("src");
      await page.getByRole("button", { name: "Lägg till slutbild" }).click();
      await page.getByRole("button", { name: /Bordstudie/ }).click();
      await page
        .getByLabel("Prompt", { exact: true })
        .fill("Granska en ny giv med samma landningspunkt.");
      await page.getByLabel("Filmlängd").selectOption("10");
      await page.locator(".draft-estimate").getByText(/120 krediter/).waitFor();
      await page.getByRole("link", { name: "Jämför modeller" }).click();
      await page.locator(".estimate-total").getByText("120 krediter").waitFor();
      await page.getByRole("button", { name: /Seedance 2.5/ }).click();
      await page.getByLabel("Längd på resultatet").selectOption("5");
      await page.getByLabel("Upplösning", { exact: true }).selectOption("4K");
      await page.getByLabel("Leveransformat").selectOption("MOV");
      await page.getByLabel("Referensfilm totalt").selectOption("5");
      await page.locator(".estimate-total").getByText("835 krediter").waitFor();
      await page.getByRole("button", { name: /Aleph 2.0/ }).click();
      await page.getByLabel("Källfilmens längd").selectOption("5");
      await page.getByLabel("Leveransformat").selectOption("ProRes MOV");
      await page.locator(".estimate-total").getByText("165 krediter").waitFor();
      await page.setViewportSize({ width: 375, height: 840 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.getByRole("navigation", { name: "Arbetsyta" }).getByRole("link", { name: /Fas 2.*3D-modell/ }).click();
      const archiveOpened = page.waitForEvent("popup");
      await page.getByRole("navigation", { name: "Arbetsyta" }).getByRole("link", { name: "Övrigt", exact: true }).click();
      const archive = await archiveOpened;
      await archive.setViewportSize({ width: 375, height: 840 });
      await archive.getByText("Inga bevarade SAM-prov hittades.").waitFor();
      await archive.getByRole("button", { name: "referens.png" }).click();
      assert.equal(await archive.getByRole("button", { name: "3D", exact: true }).isDisabled(), true);
      const run = "sam-20261119T120000Z-0123456789ab";
      const saved = path.join(root, "saved", run);
      const referenceName = (await fs.readdir(path.join(root, "inputs"))).find(name => name.startsWith("referens--"));
      const prefix = "01-" + path.parse(referenceName).name;
      await fs.mkdir(saved, { recursive: true });
      await fs.writeFile(path.join(saved, "run.json"), JSON.stringify({
        id: run, schema: "ultimate-reality-lab/v1", state: "complete", inputs: [{ path: path.join(root, "inputs", referenceName) }],
      }));
      await fs.copyFile(image, path.join(saved, prefix + ".png"));
      await fs.copyFile(image, path.join(saved, prefix + "-jamforelse.png"));
      await fs.writeFile(path.join(saved, prefix + ".html"), "<p>Lokalt vridprov</p>");
      await archive.getByRole("button", { name: "Uppdatera modelleringsunderlag" }).click();
      await archive.getByRole("button", { name: "3D", exact: true }).click();
      await archive.frameLocator("iframe").getByText("Lokalt vridprov").waitFor();
      const comparison = await archive.getByRole("link", { name: "Jämför proportioner och vinklar" }).getAttribute("href");
      const comparisonResponse = await page.request.get(origin + comparison);
      assert.equal(comparisonResponse.status(), 200);
      assert.deepEqual(await comparisonResponse.body(), await fs.readFile(image));
      await archive.getByRole("button", { name: "Överlägg" }).click();
      await archive.locator(".reference-surface img").evaluate(img => img.decode());
      assert.ok(await archive.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.equal((await page.request.get(origin + "/api/modeling?run=" + run + "&index=2&view=mesh")).status(), 404);
      const modelUrl = origin + "/api/modeling?run=" + run + "&index=1&view=";
      assert.equal((await page.request.get(modelUrl + "front")).status(), 404);
      assert.equal((await page.request.get(modelUrl + "bordsvila")).status(), 404);
      assert.equal((await page.request.get(modelUrl + "utseende")).status(), 404);
      assert.equal((await page.request.get(modelUrl + "rak")).status(), 404);
      for (const view of ["front", "bordsvila", "utseende", "rak"]) {
        const marker = Buffer.from("glTF-" + view);
        await fs.writeFile(path.join(saved, prefix + "-" + view + ".glb"), marker);
        const response = await page.request.get(modelUrl + view);
        assert.equal(response.status(), 200);
        assert.equal(response.headers()["content-type"], "model/gltf-binary");
        assert.deepEqual(await response.body(), marker);
      }
      const inventory = await (await page.request.get(origin + "/api/modeling")).json();
      assert.ok(inventory.poses.some(p => p.run === run && p.index === 1 && p.hasFront && p.hasTablePose && p.hasAppearance && p.hasUpright));
      await archive.close();
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.getByRole("link", { name: "Filmutkast" }).click();
      await page.locator("summary").filter({ hasText: "Headers och JSON-kropp" }).click();
      await page.getByLabel("Visa fullständiga bilddata").check();
      const payload = JSON.parse(await page.locator("pre").innerText());
      assert.equal(payload.promptImage.length, 2);
      assert.equal(payload.promptImage[0].uri, cropped);
      assert.equal(
        payload.promptImage[1].uri,
        await page.locator(".screen img").getAttribute("src"),
      );
      assert.equal(payload.duration, 10);
      const downloadEvent = page.waitForEvent("download");
      await page.getByRole("button", { name: "Hämta JSON" }).click();
      const download = await downloadEvent;
      const downloaded = path.join(temporary, "payload.json");
      await download.saveAs(downloaded);
      assert.deepEqual(
        JSON.parse(await fs.readFile(downloaded, "utf8")),
        payload,
      );
      await page
        .getByRole("button", { name: "Filmgranskning", exact: true })
        .click();
      await page.getByRole("button", { name: "Välj film" }).click();
      await page.locator("input[type=file]").setInputFiles(fixture);
      await page.getByText("Bildruta 1 / 16").waitFor();
      assert.equal(await page.getByLabel("Filmens källa").inputValue(), "unknown");
      await page.getByLabel("Filmens källa").selectOption("runway-mcp");
      await page.getByText("360 × 320", { exact: true }).waitFor();
      await page.getByText("8 fps", { exact: true }).waitFor();
      await page.getByText("MP4 · H264", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Nästa", exact: true }).click();
      await page.getByText("Bildruta 2 / 16").waitFor();
      await page.getByRole("button", { name: "Sätt inpunkt" }).click();
      await page
        .getByLabel("Kommentar på bildrutan")
        .fill("Kontrollera greppet.");
      await page.getByRole("button", { name: "Markera", exact: true }).click();
      await page.getByRole("button", { name: "Spara version" }).click();
      await page.getByText("Sparad som version 1").waitFor();
      await page.reload();
      await page.waitForFunction(
        () =>
          document.querySelector("textarea")?.value ===
          "Granska en ny giv med samma landningspunkt.",
      );
      await page
        .getByRole("button", { name: "Filmgranskning", exact: true })
        .click();
      await page.getByText("Kontrollera greppet.").waitFor();
      assert.equal(await page.getByLabel("Filmens källa").inputValue(), "runway-mcp");
      await page.getByText("Ruta 2–16").waitFor();
      const record = JSON.parse(
        await fs.readFile(
          path.join(root, "orders", "giv-plats-4", "v1.json"),
          "utf8",
        ),
      );
      assert.deepEqual(record.request.body, payload);
      assert.equal(record.request.transport, "runway-api");
      assert.equal(record.request.state, "draft");
      assert.equal(JSON.stringify(record).includes("local-test-sentinel"), false);
      const originalFilm = await fs.readFile(
        path.join(root, "inputs", record.draft.review.film),
      );
      assert.deepEqual(originalFilm, await fs.readFile(fixture));
      const conflict = await page.request.post(origin + "/api/draft", {
        data: { draft: record.draft, base: 0, payload },
      });
      assert.equal(conflict.status(), 409);
      // v1 was written without scene settings. It must still open and be editable.
      await page.getByRole("link", { name: "3D-scen" }).click();
      const seat4 = page.locator('[data-seat="4"]'),
        seat1 = page.locator('[data-seat="1"]');
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-seat="4"]')
            ?.getAttribute("data-frame") === "55",
      );
      assert.notDeepEqual(await seat4.screenshot(), await seat1.screenshot());
      if (process.env.STUDIO_TEST_NO_WEBGL)
        assert.equal(await seat4.getAttribute("data-renderer"), "svg");
      if (process.env.STUDIO_SCENE_QA_SCREEN)
        await page.screenshot({ path: process.env.STUDIO_SCENE_QA_SCREEN });
      await page
        .getByRole("button", { name: "Handdetalj", exact: true })
        .click();
      await page.getByRole("button", { name: "Kontakt", exact: true }).click();
      const before = await seat4.screenshot();
      await page
        .getByRole("slider", { name: "Extra fingerglapp" })
        .press("End");
      assert.notDeepEqual(await seat4.screenshot(), before);
      await page.getByRole("slider", { name: "Sidled" }).press("End");
      await page.getByRole("slider", { name: "Djup" }).press("Home");
      await page.getByRole("button", { name: "Släpp", exact: true }).click();
      assert.equal(await seat4.getAttribute("data-frame"), "78");
      assert.equal(await seat1.getAttribute("data-frame"), "78");
      if (process.env.STUDIO_HAND_QA_SCREEN)
        await page.screenshot({ path: process.env.STUDIO_HAND_QA_SCREEN });
      await page.getByRole("button", { name: "Spara bildpar" }).click();
      await page
        .getByText("Bildparet från ruta 78 finns i labbets inkorg.")
        .waitFor();
      const pictures = (await fs.readdir(path.join(root, "inputs"))).filter(
        (n) => /^giv-stol-[14]-ruta-78-hand/.test(n),
      );
      assert.equal(pictures.length, 2);
      await page.getByRole("button", { name: "Spara version" }).click();
      await page.getByText("Sparad som version 2").waitFor();
      await page.reload();
      await page.waitForFunction(
        () =>
          document
            .querySelector('[data-seat="1"]')
            ?.getAttribute("data-frame") === "78",
      );
      assert.equal(
        await page.getByLabel("Extra fingerglapp").inputValue(),
        "18",
      );
      assert.equal(
        await page.getByLabel("Sidled", { exact: true }).inputValue(),
        "19",
      );
      assert.equal(
        await page.getByLabel("Djup", { exact: true }).inputValue(),
        "-3",
      );
      await page.getByRole("button", { name: "Placera direkt i bild" }).click();
      const frontBounds = await seat4.boundingBox();
      await seat4.click({
        position: { x: frontBounds.width * 0.42, y: frontBounds.height * 0.12 },
      });
      assert.equal(
        await page.getByLabel("Sidled", { exact: true }).inputValue(),
        "19",
      );
      await seat4.click({
        position: { x: frontBounds.width * 0.42, y: frontBounds.height * 0.9 },
      });
      assert.notEqual(
        await page.getByLabel("Sidled", { exact: true }).inputValue(),
        "19",
      );
      const second = JSON.parse(
        await fs.readFile(
          path.join(root, "orders", "giv-plats-4", "v2.json"),
          "utf8",
        ),
      );
      assert.deepEqual(second.request.body, payload);
      await page.getByRole("link", { name: "Startprompter", exact: true }).click();
      const preset = page.getByLabel("Klipp eller egen mall");
      await preset.selectOption("tva-kort");
      assert.match(await page.getByLabel("Startprompt", { exact: true }).inputValue(), /two positions/);
      await preset.selectOption("blink");
      const personalPrompt = "Fixed camera. The dealer blinks once and smiles.";
      await page.getByLabel("Startprompt", { exact: true }).fill(personalPrompt);
      await page.getByLabel("Namn på egen mall").fill("Min blinkning");
      await page.getByRole("button", { name: "Spara egen mall" }).click();
      await page.getByText("Sparad på labbdisken som Min blinkning.").waitFor();
      await page.reload();
      await preset.selectOption({ label: "Min blinkning" });
      assert.equal(await page.getByLabel("Startprompt", { exact: true }).inputValue(), personalPrompt);
      await page.getByRole("button", { name: "Använd i filmutkast" }).click();
      assert.equal(await page.getByLabel("Filmlängd").inputValue(), "1");
      await page.locator(".draft-estimate").getByText(/4 krediter/).waitFor();
      await page.getByRole("button", { name: "Spara version" }).click();
      await page.getByText("Sparad som version 3").waitFor();
      await page.reload();
      await page.getByText("Din slutbild finns kvar", { exact: false }).waitFor();
      const v3 = (await (await page.request.get(origin + "/api/draft?v=3")).json()).record;
      assert.equal(v3.request.body.promptImage.length, 1);
      assert.equal(v3.request.body.ratio, "auto_720p");
      assert.equal(v3.request.body.duration, 1);
      assert.ok(v3.draft.last);
      await page.getByLabel("Utkastets modell").selectOption("wan3");
      assert.equal(await page.getByLabel("Filmlängd").inputValue(), "2");
      await page.getByLabel("Filmlängd").selectOption("30");
      await page.getByRole("button", { name: "Spara version" }).click();
      await page.getByText("Sparad som version 4").waitFor();
      const v4 = (await (await page.request.get(origin + "/api/draft?v=4")).json()).record;
      assert.equal(v4.request.body.promptImage.length, 2);
      assert.equal(v4.request.body.model, "wan3");
      assert.equal(v4.request.body.duration, 30);
      assert.equal(v4.request.body.ratio, "auto_1080p");
      const invalid = await page.request.post(origin + "/api/draft", {
        data: { draft: { ...v4.draft, duration: 1 }, base: 4, payload: v4.request.body },
      });
      assert.equal(invalid.status(), 400);
      await page.getByRole("link", { name: "Modeller och pris" }).click();
      await page.getByLabel("Jämför klipplängd").selectOption("1");
      await page.getByRole("heading", { name: "Grok Imagine Video 1.5 Lite" }).waitFor();
      assert.equal(await page.getByLabel("Längd på resultatet").inputValue(), "1");
      await page.getByLabel("Jämför klipplängd").selectOption("30");
      await page.getByRole("heading", { name: "WAN 3.0" }).waitFor();
      await page.setViewportSize({ width: 375, height: 840 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      assert.deepEqual(appErrors, []);
      assert.deepEqual(remote, []);
      await t.test("fotomallen visar alla nio vinklar och båda prompterna från den sparade HTML-filen offline", async () => {
        const guideUrl = origin + "/fotomall.html";
        assert.equal((await page.request.get(guideUrl + "?kallbild=finns-inte")).status(), 404);
        const response = await page.request.get(guideUrl + "?hamta=1");
        assert.equal(response.status(), 200);
        assert.match(response.headers()["content-disposition"], /Fotomall-steg-1\.html/);
        const guideFile = path.join(temporary, "Fotomall-steg-1.html");
        await fs.writeFile(guideFile, await response.body());
        const offline = await browser.newPage({ viewport: { width: 390, height: 844 } });
        try {
          await offline.context().setOffline(true);
          await offline.goto(pathToFileURL(guideFile).href);
          assert.equal(await offline.getByRole("button", { name: /^Förstora / }).count(), 4);
          await offline.getByRole("button", { name: "Visa alla", exact: true }).click();
          const sizes = await offline.locator(".photo-button img").evaluateAll(async images => {
            await Promise.all(images.map(image => image.decode()));
            return images.map(image => ({ width: image.clientWidth, height: image.clientHeight, natural: image.naturalWidth }));
          });
          assert.equal(sizes.length, 9);
          assert.ok(sizes.every(p => p.natural === 720 && Math.abs(p.height - p.width * 880 / 720) < 2));
          assert.ok(await offline.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await offline.getByRole("button", { name: "Visa dockans vinkel för bild 11" }).click();
          assert.equal(await offline.locator("dialog[open] #large-title").innerText(), "Vänsterhandens kortgrepp");
          await offline.getByRole("button", { name: "Stäng", exact: true }).click();
          assert.equal(await offline.getByRole("button", { name: /^Kopiera prompt / }).count(), 2);
          assert.equal(await offline.locator("[data-studio]").getAttribute("href"), origin + "/#modellering");
          assert.equal(await offline.getByRole("link", { name: "Bildstandard i studion" }).getAttribute("href"), origin + "/bildstandard");
        } finally {
          await offline.close();
        }
      });
      await t.test("egna foton och roller ger en kopierbar prompt och en komplett bildmall utan exempeldata", async () => {
        const standard = await browser.newPage({ viewport: { width: 390, height: 844 } });
        try {
          await standard.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin });
          await standard.goto(origin + "/fotomall.html#nya-bilder");
          await standard.waitForURL("**/ovrigt/fotomall#nya-bilder");
          await standard.getByRole("link", { name: "Bildstandard i studion" }).click();
          await standard.goto(origin + "/fotomall.html");
          await standard.waitForURL("**/bildstandard");
          const view = standard.getByLabel("Bildvy", { exact: true });
          assert.equal(await view.locator("option").count(), 12);
          await view.selectOption("hander/kortdrag-vanster");
          const prompt = standard.locator("#prompttext");
          assert.match(await prompt.inputValue(), /cirka 20° över den vita ytan/);
          assert.match(await prompt.inputValue(), /241, 240, 242/);
          assert.match(await prompt.inputValue(), /222, 198, 250/);
          const card = standard.getByRole("img", { name: /Mörkröd kortbaksida med ljust X/ });
          const ink = await card.evaluate(async (img) => {
            await img.decode();
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const context = canvas.getContext("2d");
            context.drawImage(img, 0, 0);
            const rgb = (x, y) => Array.from(context.getImageData(x, y, 1, 1).data);
            return { size: [canvas.width, canvas.height], back: rgb(1, 100), x: rgb(126, 178), dot: rgb(40, 40) };
          });
          assert.deepEqual(ink, { size: [252, 356], back: [152, 1, 9, 255], x: [241, 240, 242, 255], dot: [222, 198, 250, 255] });
          const png = await fs.readFile(image);
          await standard.getByLabel("Välj referensfoton").setInputFiles([
            { name: "porträtt.png", mimeType: "image/png", buffer: png },
            { name: "eget-kort.png", mimeType: "image/png", buffer: png },
          ]);
          await standard.getByLabel("Roll för eget-kort.png").selectOption("Kortets mönster");
          const selected = await prompt.inputValue();
          assert.match(selected, /porträtt\.png.*Identitet/);
          assert.match(selected, /eget-kort\.png.*Kortets mönster/);
          assert.doesNotMatch(selected, /241, 240, 242|222, 198, 250|Paulina/);
          await standard.getByRole("button", { name: "Kopiera prompt" }).click();
          await standard.getByText("Prompten har kopierats.").waitFor();
          const clipboard = await standard.evaluate(() => navigator.clipboard.readText());
          assert.equal(clipboard.replace(/\r\n/g, "\n"), selected);

          const download = standard.waitForEvent("download");
          await standard.getByRole("button", { name: "Hämta alla vyer som JSON" }).click();
          const data = JSON.parse(await fs.readFile(await (await download).path(), "utf8"));
          assert.equal(data.schemaVersion, 1);
          assert.deepEqual(data.kortstandard, { id: "egen-kortreferens", filer: ["eget-kort.png"] });
          assert.equal(data.vyer.length, 12);
          assert.equal(data.vyer.filter((vy) => vy.recept.extra).length, 1);
          assert.equal(data.vyer.find((vy) => vy.recept.id === "hander/kortdrag-vanster").prompt, selected);
          assert.ok(data.vyer.every((vy) => vy.filuppgifter.breddPx === null && vy.osakerhet === "" && vy.kalla === ""));
          assert.doesNotMatch(JSON.stringify(data), /Paulina/i);
          const localExport = standard.getByRole("button", { name: "Hämta Paulinas ifyllda mall" });
          if (await localExport.count()) {
            const pending = standard.waitForEvent("download");
            await localExport.click();
            const local = JSON.parse(await fs.readFile(await (await pending).path(), "utf8"));
            assert.equal(local.avatar, "Paulina");
            assert.equal(local.kortstandard.id, "vit-ram-punkt-v1");
            assert.equal(local.vyer.length, data.vyer.length);
            assert.deepEqual(local.referenser, []);
            const record = local.vyer.find((vy) => vy.id === "hander/kortdrag-vanster");
            assert.deepEqual(Object.keys(record.filuppgifter), Object.keys(data.vyer[0].filuppgifter));
            assert.ok(record.filuppgifter.breddPx > 0 && record.observation.ljus && record.osakerhet);
            assert.match(record.filuppgifter.sha256, /^[a-f0-9]{64}$/);
            assert.match(record.prompt, /tunn vit ram/);
          }
          await standard.getByLabel("Välj referensfoton").setInputFiles([
            { name: "helfigur.png", mimeType: "image/png", buffer: png },
            { name: "sittfront.png", mimeType: "image/png", buffer: png },
            { name: "sidofoto.png", mimeType: "image/png", buffer: png },
          ]);
          await standard.getByLabel("Roll för helfigur.png").selectOption("Godkänd ståfront");
          await standard.getByLabel("Roll för sittfront.png").selectOption("Godkänd sittfront");
          for (const [id, included, excluded] of [
            ["staende/trekvart", "helfigur.png", "sittfront.png"],
            ["staende/profil", "helfigur.png", "sittfront.png"],
            ["sittande/front", "helfigur.png", "sittfront.png"],
            ["sittande/trekvart", "sittfront.png", "helfigur.png"],
            ["sittande/profil", "sittfront.png", "helfigur.png"],
          ]) {
            await view.selectOption(id);
            const instructions = await prompt.inputValue();
            assert.ok(instructions.includes(included) && !instructions.includes(excluded));
            assert.match(instructions, /porträtt\.png.*Identitet/);
            assert.match(instructions, /sidofoto\.png.*Kompletterande original/);
          }
          await view.selectOption("ansikte/profil");
          assert.doesNotMatch(await prompt.inputValue(), /eget-kort\.png|helfigur\.png|sittfront\.png/);
          assert.ok(await standard.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

          const publicView = await standard.request.get(origin + "/bildstandard", { headers: { "sec-fetch-site": "cross-site" } });
          assert.equal(publicView.status(), 200);
          assert.match(await publicView.text(), /lokala exempelbild saknas/);
        } finally {
          await standard.close();
        }
      });
      await t.test("fyra egna foton blir ett lokalt Runway-utkast med pris, bildordning och sparade original", async () => {
        const order = await browser.newPage({ viewport: { width: 390, height: 844 } });
        try {
          await order.goto(origin + "/bildstandard");
          await order.getByRole("link", { name: "Beställ bildserie i Runway" }).click();
          await order.getByRole("heading", { name: "Beställ en bildserie" }).waitFor();
          assert.equal(await order.getByRole("button", { name: "Skicka ståfront" }).isDisabled(), true);
          const png = await fs.readFile(image);
          const names = ["sidovy.png", "selfie.png", "kropp.png", "ansikte.png"];
          await order.locator("input[type=file]").setInputFiles(names.map((name) => ({ name, mimeType: "image/png", buffer: png })));
          await order.getByText("18 / 225 API-krediter").waitFor();
          const save = order.waitForResponse((res) => res.url() === origin + "/api/bildpipeline" && res.request().method() === "POST");
          await order.getByRole("button", { name: "Spara lokalt utkast" }).click();
          const revision = await (await save).json();
          assert.equal(revision.mode, "draft");
          assert.deepEqual(revision.steps[0].dependsOn, []);
          assert.match(revision.steps[0].prompt, /Create a new photograph/);
          assert.ok(revision.files.length === 4 && Object.values(revision.jobs).every((job) => job.status === "waiting"));
          await order.waitForFunction((id) => document.querySelector("#pipeline-version")?.value === id, revision.id);
          const original = await order.request.get(origin + "/api/bildpipeline?" + new URLSearchParams({ id: revision.id, original: "0" }));
          assert.ok((await original.body()).equals(png));
          assert.equal((await order.request.get(origin + "/api/bildpipeline", { headers: { "sec-fetch-site": "cross-site" } })).status(), 403);
          await order.reload();
          await order.waitForFunction((id) => document.querySelector("#pipeline-version")?.value === id, revision.id);
          assert.equal(await order.getByRole("button", { name: "Skicka ståfront" }).isEnabled(), true);
          assert.ok(await order.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        } finally {
          await order.close();
        }
      });
    } finally {
      await browser.close();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await app.close();
    }
  },
);
