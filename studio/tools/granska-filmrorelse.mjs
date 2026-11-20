import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { digest, publish } from "./publicera-kamerafil.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const root = path.join(repo, "avatars/paulina");
const edition = path.join(root, "giv-plats-4/filmrorelse/v2");
const output = path.resolve(process.argv[2] ?? path.join(edition, "visning"));
const origin = "http://127.0.0.1:4317/giv-plats-4/filmrorelse";
const receipt = JSON.parse(await readFile(path.join(edition, "rigg/rorelsematning.json"), "utf8"));
const proof = await fetch(origin + "/v2/filmrorelse.glb");
assert.ok(proof.ok, "Filmrigg V2 måste vara tillgänglig i den lokala studion.");
assert.equal(digest(Buffer.from(await proof.arrayBuffer())), receipt.sceneSha256);
const source = await readFile(path.join(root, "prov-70/v1/runway/original.mp4"));
assert.equal(digest(source), receipt.sourceVideoSha256);
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"] });
const camera = { label: "Front", azimuthDegrees: 0, cut: "helbild" };
const pictures = [];
try {
  const page = await browser.newPage({ viewport: { width: 1720, height: 930 }, deviceScaleFactor: 1 });
  await page.goto(origin + "?ruta=0");
  const view = page.locator('[data-orbit-state="ready"] canvas');
  await view.waitFor({ timeout: 60_000 });
  const controls = page.getByRole("group", { name: "Händelser i källfilmen" });
  await mkdir(output, { recursive: true });
  for (const frame of Object.values(receipt.keyframes)) {
    await controls.getByRole("button", { name: new RegExp(" · " + frame + "$") }).click();
    await page.waitForFunction(({ frame, fps }) => {
      const video = document.querySelector("video"), canvas = document.querySelector("canvas");
      return video && !video.seeking && video.readyState >= 2 && canvas?.dataset.orbitFrame === String(frame)
        && Math.floor(video.currentTime * fps + .00001) === frame;
    }, { frame, fps: receipt.fps });
    const [film, rig] = await Promise.all([page.locator("video").screenshot(), view.screenshot()]);
    const width = 720, height = 405;
    const [left, right] = await Promise.all([film, rig].map(bytes =>
      sharp(bytes).resize(width, height, { fit: "contain", background: "#152720" }).png().toBuffer()));
    const bytes = await sharp({ create: { width: width * 2, height, channels: 3, background: "#152720" } })
      .composite([{ input: left, left: 0, top: 0 }, { input: right, left: width, top: 0 }]).jpeg({ quality: 93 }).toBuffer();
    const name = "ruta-" + String(frame).padStart(3, "0") + ".jpg";
    await publish(path.join(output, name), bytes);
    pictures.push({ frame, seconds: frame / receipt.fps, file: name, sha256: digest(bytes) });
  }
  const register = { sceneSha256: receipt.sceneSha256, sourceVideoSha256: receipt.sourceVideoSha256,
    camera, left: "Kling 4 via Runway", right: "V4 med upphållet rött kort", pictures };
  await publish(path.join(output, "jamforelse.json"), Buffer.from(JSON.stringify(register, null, 2) + "\n"));
  console.log(output, receipt.sceneSha256, pictures.length + " bildpar");
} finally {
  await browser.close();
}
