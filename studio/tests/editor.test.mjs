import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
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
      await page.getByRole("link", { name: "3D-modellering" }).click();
      await page.getByText("Inga bevarade SAM-prov hittades.").waitFor();
      await page.getByRole("button", { name: "referens.png" }).click();
      assert.equal(await page.getByRole("button", { name: "3D", exact: true }).isDisabled(), true);
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
      await page.getByRole("button", { name: "Uppdatera modelleringsunderlag" }).click();
      await page.getByRole("button", { name: "3D", exact: true }).click();
      await page.frameLocator("iframe").getByText("Lokalt vridprov").waitFor();
      const comparison = await page.getByRole("link", { name: "Jämför proportioner och vinklar" }).getAttribute("href");
      const comparisonResponse = await page.request.get(origin + comparison);
      assert.equal(comparisonResponse.status(), 200);
      assert.deepEqual(await comparisonResponse.body(), await fs.readFile(image));
      await page.getByRole("button", { name: "Överlägg" }).click();
      await page.locator(".reference-surface img").evaluate(img => img.decode());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.equal((await page.request.get(origin + "/api/modeling?run=" + run + "&index=2&view=mesh")).status(), 404);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.getByRole("link", { name: "Filmutkast" }).click();
      await page.locator("summary").click();
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
    } finally {
      await browser.close();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await app.close();
    }
  },
);
