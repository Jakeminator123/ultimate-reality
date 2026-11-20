import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { digest, publish, readIfPresent } from "./publicera-kamerafil.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const trial = path.join(repo, "avatars/paulina/giv-plats-4");
const args = process.argv.slice(2);
const eyeTest = args[0] === "--blickprov";
const closeUp = args.length === 3 && (args[0] === "--narbild" || eyeTest);
assert.ok(!args.length || closeUp, "Använd portrattljus.mjs [--narbild | --blickprov giv.glb utmapp].");
const source = closeUp ? path.resolve(args[1]) : path.join(trial, "v1/rigg/giv.glb");
const out = closeUp ? path.resolve(args[2]) : path.join(trial, "v2/underlag/portrattljus");
const rendering = JSON.parse(await readFile(path.join(trial, "v1/visning/rendering.json"), "utf8"));
const receipt = closeUp ? JSON.parse(await readFile(path.join(path.dirname(source), "givmatning.json"), "utf8")) : rendering;
const sourceSha256 = digest(await readFile(source));
assert.equal(sourceSha256, receipt.sceneSha256);

const module = new URL("./ankarkameran.mjs", import.meta.url);
const base = "/__paulina-portrattljus/";
const result = { sourceSceneSha256: sourceSha256, frontFrame: 0,
  rendererSha256: digest(await readFile(module)), grayLinear: .36, files: {} };
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
  const passes = [{ name: "svart.png", linear: 0 }, { name: "gra.png", linear: result.grayLinear }];
  if (closeUp) {
    result.cameras = {};
    for (const deg of [0, 36, 69, -36]) passes.push({ name: "ansikte-" + deg + ".png", linear: null, deg });
    if (eyeTest) passes.push({ name: "ogon-fran-kortdraget.png", linear: null, eyeFrame: receipt.keyframes.ready });
  }
  for (const { name, linear, deg = 0, eyeFrame } of passes) {
    const frame = await page.evaluate(async ({ base, cameraSpec, linear, closeUp, deg, eyeFrame, fps }) => {
      const { captureScene } = await import(base + "kamera.mjs");
      if (!captureScene) throw Error(window.problem || "Scenen saknas.");
      const { camera, renderer, world, mixer, asset } = captureScene;
      const eyeJoints = ["r_eye", "l_eye"].map(n => asset.scene.getObjectByName(n));
      let isolated;
      if (eyeFrame !== undefined) {
        mixer.setTime(eyeFrame / fps);
        isolated = eyeJoints.map(node => node.quaternion.clone());
      }
      mixer.setTime(0);
      if (isolated) eyeJoints.forEach((node, i) => node.quaternion.copy(isolated[i]));
      world.updateMatrixWorld(true);
      const target = camera.position.clone().fromArray(cameraSpec.lookAtM);
      camera.position.fromArray(cameraSpec.positionM);
      camera.fov = cameraSpec.verticalFovDeg;
      if (closeUp) {
        const eyes = ["l_eye", "r_eye"].map(n => asset.scene.getObjectByName(n).getWorldPosition(target.clone()));
        target.copy(eyes[0]).add(eyes[1]).multiplyScalar(.5);
        target.y -= .022;
        const radians = deg * Math.PI / 180;
        camera.position.set(target.x + .96 * Math.sin(radians), target.y + .10, target.z + .96 * Math.cos(radians));
        camera.fov = 22;
      }
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      const changed = [];
      try {
        if (linear !== null) {
          asset.scene.traverse(mesh => {
            if (!mesh.isSkinnedMesh || !mesh.geometry.attributes._sam_index) return;
            const material = mesh.material.clone();
            material.map = null;
            material.color.setRGB(linear, linear, linear);
            changed.push([mesh, mesh.material]);
            mesh.material = material;
          });
          if (changed.length !== 1) throw Error("Fotokroppens material kunde inte isoleras.");
        }
        renderer.render(world, camera);
        return { image: renderer.domElement.toDataURL("image/png").split(",")[1], camera: {
          positionM: camera.position.toArray(), lookAtM: target.toArray(), width: renderer.domElement.width,
          height: renderer.domElement.height, verticalFovDeg: camera.fov, projection: camera.projectionMatrix.toArray(),
          worldToCamera: camera.matrixWorldInverse.toArray()
        } };
      } finally {
        for (const [mesh, material] of changed) {
          mesh.material.dispose();
          mesh.material = material;
        }
      }
    }, { base, cameraSpec: rendering.cameras.front, linear, closeUp, deg, eyeFrame, fps: receipt.fps });
    const bytes = Buffer.from(frame.image, "base64");
    await publish(path.join(out, name), bytes);
    result.files[name] = digest(bytes);
    if (closeUp && linear === null && eyeFrame === undefined) result.cameras[deg] = frame.camera;
  }
  if (eyeTest) {
    const [a, b] = await Promise.all(["ansikte-0.png", "ogon-fran-kortdraget.png"].map(name =>
      sharp(path.join(out, name)).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
    assert.deepEqual(a.info, b.info);
    const { width, height, channels } = a.info;
    const bounds = [width, height, -1, -1];
    let count = 0;
    for (let i = 0; i < width * height; i++) {
      const off = i * channels;
      if (a.data[off] === b.data[off] && a.data[off + 1] === b.data[off + 1] && a.data[off + 2] === b.data[off + 2]) continue;
      const x = i % width, y = Math.floor(i / width);
      bounds[0] = Math.min(x, bounds[0]); bounds[1] = Math.min(y, bounds[1]);
      bounds[2] = Math.max(x, bounds[2]); bounds[3] = Math.max(y, bounds[3]); count++;
    }
    result.isolatedEyeTest = { fixedFrame: 0, eyeFrame: receipt.keyframes.ready, width, height,
      changedPixels: count, boundsPx: count ? bounds : null };
    if (receipt.eyeSkin03) assert.ok(count > 30 && bounds[0] > 485 && bounds[1] > 250 && bounds[2] < 795 && bounds[3] < 375,
      "Studiokameran ska se en ändring begränsad till båda ögonens område.");
  }
  const manifest = path.join(out, "ljus.json");
  // Earlier V1 light measurements stay reproducible even if the renderer has
  // since gained support for newer scenes: all freshly measured pixels must match.
  const prior = !closeUp && await readIfPresent(manifest);
  if (prior) {
    const registered = JSON.parse(prior);
    assert.deepEqual({ ...registered, rendererSha256: result.rendererSha256 }, result);
  } else {
    await publish(manifest, Buffer.from(JSON.stringify(result, null, 2) + "\n"));
  }
  console.log(out);
} finally {
  await browser.close();
}
