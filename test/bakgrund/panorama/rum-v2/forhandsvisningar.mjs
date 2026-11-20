import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../../../studio/package.json", import.meta.url));
const { panoramaRooms } = require("./lib/panorama-rooms.ts");
const { chromium } = require("playwright-core");
const sharp = require("sharp");
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 1664, height: 1285 }, deviceScaleFactor: 1 });
  for (const room of panoramaRooms) {
    await page.goto("http://127.0.0.1:4317/bordsprov/panorama/" + room.id);
    const canvas = page.locator("canvas[data-ready=true]");
    await canvas.waitFor({ timeout: 45_000 });
    const pixels = await canvas.screenshot();
    const file = fileURLToPath(new URL(room.id + ".jpg", import.meta.url));
    await sharp(pixels).resize(960, 540, { fit: "cover" }).jpeg({ quality: 92 }).toFile(file);
  }
} finally {
  await browser.close();
}
