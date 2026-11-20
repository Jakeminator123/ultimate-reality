import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { digest, publish } from "../studio/tools/publicera-kamerafil.mjs";

// Re-render the existing studio camera's hand region using a narrower frustum.
// The lens position, pose, light and projection onto the original image stay fixed.
const root = fileURLToPath(new URL("../", import.meta.url));
const requireStudio = createRequire(path.join(root, "studio/package.json"));
const { chromium } = requireStudio("playwright-core");
const sharp = requireStudio("sharp");
const [modelPath, cameraPath, outputPath, frameValue = "92"] = process.argv.slice(2);
assert.ok(modelPath && cameraPath && outputPath,
  "Ange scen.glb, kameraverifikation.json, utdatamapp och valfri nollbaserad ruta.");
const model = path.resolve(modelPath), out = path.resolve(outputPath);
const cameraData = JSON.parse(await readFile(path.resolve(cameraPath)));
const frame = Number(frameValue);
const reference = cameraData.measurements[frame];
assert.ok(Number.isInteger(frame) && reference, "Rutan har ingen uppmätt handgräns i kamerakvittot.");
assert.equal(digest(await readFile(model)), cameraData.sceneSha256);
const renderSource = path.join(root, "studio/tools/ankarkameran.mjs");
const manifest = { sceneSha256: cameraData.sceneSha256, frame, fps: cameraData.timeline.fps,
  studioRendererSha256: digest(await readFile(renderSource)), scale: 5, images: {} };
const modulePath = "/__paulina-handprov/ankarkameran.mjs";
const base = "/__paulina-handprov/";
await mkdir(out, { recursive: true });
sharp.concurrency(4);
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const html = '<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{' +
    '"three":"/bordsprov/rum3d/three.module.js","three/addons/":"/bordsprov/rum3d/addons/"}}</script>' +
    '<canvas data-scene="/__paulina-handprov/giv.glb"></canvas>';
  await page.route("**" + base, route => route.fulfill({ contentType: "text/html; charset=utf-8", body: html }));
  await page.route("**" + modulePath, route => route.fulfill({ contentType: "text/javascript; charset=utf-8", path: renderSource }));
  await page.route("**" + base + "giv.glb", route => route.fulfill({ contentType: "model/gltf-binary", path: model }));
  await page.goto("http://127.0.0.1:4317" + base);
  const tiles = [];
  for (const [row, viewName] of ["front", "sida70"].entries()) {
    const view = cameraData.cameras[viewName];
    for (const [col, handName] of ["rightHand", "leftHand"].entries()) {
      const [left, top, right, bottom] = reference[viewName].boundsPx[handName];
      const region = [left - 8, top - 8, right - left + 17, bottom - top + 17];
      const result = await page.evaluate(async ({ url, view, region, time, scale }) => {
        const { captureScene } = await import(url);
        if (!captureScene) throw Error(window.problem || "Kunde inte läsa scenen i studiokameran.");
        const { renderer, camera, world, mixer, objects } = captureScene;
        const { MeshBasicMaterial } = await import("three");
        mixer.setTime(time);
        world.updateMatrixWorld(true);
        camera.fov = view.verticalFovDeg;
        camera.position.fromArray(view.positionM);
        camera.lookAt(...view.lookAtM);
        camera.setViewOffset(view.width, view.height, ...region);
        camera.updateMatrixWorld(true);
        renderer.setSize(region[2] * scale, region[3] * scale, false);
        function shot() {
          renderer.render(world, camera);
          return renderer.domElement.toDataURL("image/png").split(",")[1];
        }
        const lit = shot(), changed = [];
        try {
          for (const [object, material] of objects) {
            if (!object.isSkinnedMesh || !material.map) continue;
            const unlit = new MeshBasicMaterial({ map: material.map, side: material.side, fog: false, toneMapped: false });
            changed.push([object, material, unlit]);
            object.material = unlit;
          }
          return { lit, albedo: shot() };
        } finally {
          for (const [object, initial, replacement] of changed) { object.material = initial; replacement.dispose(); }
        }
      }, { url: modulePath, view, region, time: frame / manifest.fps, scale: manifest.scale });
      for (const [pass, base64] of Object.entries(result)) {
        const name = viewName + "-" + handName + "-" + pass + ".png";
        const pixels = Buffer.from(base64, "base64");
        await publish(path.join(out, name), pixels);
        manifest.images[name] = { sha256: digest(pixels), originalViewPx: region,
          width: region[2] * manifest.scale, height: region[3] * manifest.scale };
        if (pass === "lit") {
          const tile = await sharp(pixels).resize(530, 530, { fit: "contain", background: "#283b32" }).png().toBuffer();
          const title = (viewName === "front" ? "Framifrån" : "+70°") + " · " + (col ? "Paulinas vänsterhand" : "Paulinas högerhand");
          const label = Buffer.from('<svg width="530" height="34"><rect width="530" height="34" fill="#283b32"/>' +
            '<text x="14" y="24" font-family="Segoe UI" font-size="18" fill="white">' + title + "</text></svg>");
          tiles.push({ input: tile, left: col * 530, top: row * 564 + 34 }, { input: label, left: col * 530, top: row * 564 });
        }
      }
    }
  }
  const overview = await sharp({ create: { width: 1060, height: 1128, channels: 3, background: "#283b32" } })
    .composite(tiles).jpeg({ quality: 96, chromaSubsampling: "4:4:4" }).toBuffer();
  await publish(path.join(out, "hander-ruta-" + frame + ".jpg"), overview);
  manifest.overviewSha256 = digest(overview);
  await publish(path.join(out, "narbildsmatning.json"), Buffer.from(JSON.stringify(manifest, null, 2) + "\n"));
  console.log(out, cameraData.sceneSha256, "ruta", frame);
} finally {
  await browser.close();
}
