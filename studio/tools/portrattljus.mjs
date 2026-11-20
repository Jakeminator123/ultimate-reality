import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { digest, publish } from "./publicera-kamerafil.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const trial = path.join(repo, "avatars/paulina/giv-plats-4");
const source = path.join(trial, "v1/rigg/giv.glb");
const out = path.join(trial, "v2/underlag/portrattljus");
const rendering = JSON.parse(await readFile(path.join(trial, "v1/visning/rendering.json"), "utf8"));
assert.equal(digest(await readFile(source)), rendering.sceneSha256);
const neutral = [{ name: "svart.png", linear: 0 }, { name: "gra.png", linear: .36 }];
const cameraSpec = rendering.cameras.front;
const module = new URL("./ankarkameran.mjs", import.meta.url);
const base = "/__paulina-portrattljus/";
const result = { sourceSceneSha256: rendering.sceneSha256, frontFrame: 0,
  rendererSha256: digest(await readFile(module)), grayLinear: neutral[1].linear, files: {} };
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const html = '<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{' +
    '"three":"/bordsprov/rum3d/three.module.js","three/addons/":"/bordsprov/rum3d/addons/"}}</script><canvas data-scene="' + base + 'giv.glb"></canvas>';
  await page.route("**" + base, route => route.fulfill({ contentType: "text/html", body: html }));
  await page.route("**" + base + "giv.glb", route => route.fulfill({ contentType: "model/gltf-binary", path: source }));
  await page.route("**" + base + "kamera.mjs", route => route.fulfill({ contentType: "text/javascript", path: fileURLToPath(module) }));
  await page.goto("http://127.0.0.1:4317" + base);
  await mkdir(out, { recursive: true });
  for (const { name, linear } of neutral) {
    const png = await page.evaluate(async ({ base, cameraSpec, linear }) => {
      const { captureScene } = await import(base + "kamera.mjs");
      if (!captureScene) throw Error(window.problem || "Scenen saknas.");
      const { camera, renderer, world, mixer, asset } = captureScene;
      camera.fov = cameraSpec.verticalFovDeg;
      camera.position.fromArray(cameraSpec.positionM);
      camera.lookAt(...cameraSpec.lookAtM);
      camera.updateProjectionMatrix();
      mixer.setTime(0);
      const changed = [];
      asset.scene.traverse(mesh => {
        if (!mesh.isSkinnedMesh || !mesh.geometry.attributes._sam_index) return;
        const material = mesh.material.clone();
        material.map = null;
        material.color.setRGB(linear, linear, linear);
        changed.push([mesh, mesh.material]);
        mesh.material = material;
      });
      if (changed.length !== 1) throw Error("Fotokroppens material kunde inte isoleras.");
      renderer.render(world, camera);
      const image = renderer.domElement.toDataURL("image/png").split(",")[1];
      for (const [mesh, material] of changed) {
        mesh.material.dispose();
        mesh.material = material;
      }
      return image;
    }, { base, cameraSpec, linear });
    const bytes = Buffer.from(png, "base64");
    await publish(path.join(out, name), bytes);
    result.files[name] = digest(bytes);
  }
  await publish(path.join(out, "ljus.json"), Buffer.from(JSON.stringify(result, null, 2) + "\n"));
  console.log(out);
} finally {
  await browser.close();
}
