import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = path.resolve(here, "../../..");
const require = createRequire(path.join(root, "studio/package.json"));
const { chromium } = require("playwright-core");
const three = path.dirname(require.resolve("three"));
const rootFile = name => path.join(root, name);
const fromJson = async file => JSON.parse(await fs.readFile(rootFile(file), "utf8"));
const basis = await fromJson("test/bord/filtdjup-v1/matt.json");
const layout = await fromJson("studio/lib/table-layout.json");
// Keep the shoe and reference cross from the measured baseline across both variants.
layout.shoe = { x: basis.points.sko[0], z: basis.points.sko[2], width: 0.08, depth: 0.15 };
layout.dealerSeat = { x: 0, z: -0.39 };
layout.landing = { xCm: basis.points.kortmal[0] * 100, zCm: basis.points.kortmal[2] * 100 };
layout.table = { radiusX: 0.8, radiusZ: 0.54, centerZ: basis.points.mittkryss[2] };
const model = "test/dealer/paulina/filtdjup-v1-sits406/paulina-sits406.glb";
const room = "test/bakgrund/salong-v1.mjs";
const table = "test/bord/filtdjup-v1/bord.mjs";
const shoe = "test/artefakter/kortsko-v1.mjs";
const files = new Map([
  ["three.module.js", path.join(three, "three.module.js")],
  ["three.core.js", path.join(three, "three.core.js")],
  ["loaders/GLTFLoader.js", require.resolve("three/addons/loaders/GLTFLoader.js")],
  ["utils/BufferGeometryUtils.js", require.resolve("three/addons/utils/BufferGeometryUtils.js")],
  ["utils/SkeletonUtils.js", require.resolve("three/addons/utils/SkeletonUtils.js")],
  ...[room, table, shoe, model].map(name => [name, rootFile(name)]),
]);
const data = new Map(await Promise.all([...files].map(async ([name, file]) => [name, await fs.readFile(file)])));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const hashes = Object.fromEntries([room, table, shoe, model].map(name => [name, hash(data.get(name))]));
for (const name of [room, table, shoe]) assert.equal(hashes[name], basis.sources[name], name);

const origin = "http://bordstorlek.localhost/";
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage();
  await page.route("**/*", route => {
    const url = route.request().url();
    if (url === origin) return route.fulfill({ contentType: "text/html", body: '<script type="importmap">{"imports":{"three":"/three.module.js"}}</script>' });
    const name = url.slice(origin.length);
    if (!url.startsWith(origin) || !data.has(name)) return route.abort();
    return route.fulfill({ contentType: name === model ? "model/gltf-binary" : "text/javascript", body: data.get(name) });
  });
  await page.goto(origin);
  const { images, metrics } = await page.evaluate(async ({ basis, layout, model, table, shoe, room }) => {
    const T = await import("three");
    const { GLTFLoader } = await import("/loaders/GLTFLoader.js");
    const { buildTable, textiles } = await import("/" + table);
    const { addShoe } = await import("/" + shoe);
    const { buildSalon } = await import("/" + room);
    const scene = new T.Scene();
    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setSize(basis.width, basis.height, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    buildSalon(scene);
    const cube = new T.WebGLCubeRenderTarget(128, { type: T.HalfFloatType });
    const probe = new T.CubeCamera(0.02, 20, cube);
    probe.position.set(0, 0.10, 0);
    probe.update(renderer, scene);
    const pmrem = new T.PMREMGenerator(renderer);
    scene.environment = pmrem.fromCubemap(cube.texture).texture;
    scene.environmentIntensity = 0.48;
    addShoe(scene, layout.shoe);
    const paulina = (await new GLTFLoader().loadAsync("/" + model)).scene;
    paulina.traverse(node => {
      if (!node.isMesh) return;
      node.geometry.computeVertexNormals();
      node.material = new T.MeshStandardMaterial({ color: 0xc0d2ce, roughness: 0.9, side: T.DoubleSide });
      node.castShadow = node.receiveShadow = true;
    });
    scene.add(paulina);
    const seat = new T.Mesh(new T.BoxGeometry(0.32, 0.045, 0.27), new T.MeshStandardMaterial({ color: 0x3b4b45, roughness: 0.9 }));
    seat.position.set(layout.dealerSeat.x, basis.floorY + 0.406 - 0.045 / 2, layout.dealerSeat.z);
    scene.add(seat);
    const sharedCloth = textiles(layout);
    const images = {}, metrics = { variants: {}, cameras: {} };
    for (const [version, width, depth] of [["grund", 1.6, 1.08], ["storre", 1.8, 1.2]]) {
      const newLayout = { ...layout, table: { radiusX: width / 2, radiusZ: depth / 2, centerZ: -0.52 + depth / 2 } };
      const group = buildTable(newLayout, false, sharedCloth);
      scene.add(group);
      scene.updateMatrixWorld(true);
      const felt = group.children.find(child => child.geometry?.type === "ShapeGeometry");
      const feltBounds = new T.Box3().setFromObject(felt, true);
      const ray = new T.Raycaster(new T.Vector3(0, 1, -0.28 + 0.00001), new T.Vector3(0, -1, 0));
      if (ray.intersectObject(felt).length === 0) throw Error("Missing felt at the dealer edge");
      ray.ray.origin.z = -0.28 - 0.00001;
      if (ray.intersectObject(felt).length !== 0) throw Error("Unexpected felt behind the dealer edge");
      const measured = feltBounds.getSize(new T.Vector3());
      if (Math.abs(measured.x - width) > 0.0001 || Math.abs(measured.z - depth) > 0.0001 || Math.abs(feltBounds.min.y) > 0.0001) throw Error("Unexpected tabletop dimensions");
      const round = number => Number(number.toFixed(4));
      metrics.variants[version] = { widthCm: round(measured.x * 100), depthCm: round(measured.z * 100), feltFloorHeightCm: round((feltBounds.min.y - basis.floorY) * 100), rearCm: round(feltBounds.min.z * 100), frontCm: round(feltBounds.max.z * 100), centerDealerEdgeCm: [0, 0, -28] };
      for (const number of [4, 1]) {
        const c = basis.cameras[number];
        const camera = new T.PerspectiveCamera(c.fovVertical, basis.width / basis.height, 0.02, 20);
        camera.position.fromArray(c.eye);
        camera.lookAt(new T.Vector3(...c.aim));
        camera.updateMatrixWorld(true);
        const pixels = {};
        for (const [name, pos] of Object.entries(basis.points)) {
          const projected = new T.Vector3(...pos).project(camera);
          pixels[name] = [Math.round((1 + projected.x) * basis.width / 2), Math.round((1 - projected.y) * basis.height / 2)];
          if (!pixels[name].every((p, i) => p === c.pixels[name][i])) throw Error("Camera anchor mismatch: " + name);
        }
        metrics.cameras[number] = { eye: c.eye, aim: c.aim, verticalFov: c.fovVertical, pixels };
        renderer.render(scene, camera);
        images[version + "-stol-" + number] = renderer.domElement.toDataURL("image/png").split(",")[1];
      }
      scene.remove(group);
    }
    renderer.dispose();
    return { images, metrics };
  }, { basis, layout, model, table, shoe, room });
  for (const [name, image] of Object.entries(images)) {
    const bytes = Buffer.from(image, "base64");
    assert.equal(bytes.readUInt32BE(16), basis.width);
    assert.equal(bytes.readUInt32BE(20), basis.height);
    await fs.writeFile(path.join(here, name + ".png"), bytes);
  }
  await fs.writeFile(path.join(here, "matt.json"), JSON.stringify({ sources: hashes, width: basis.width, height: basis.height, points: basis.points, ...metrics }, null, 2) + "\n");
} finally {
  await browser.close();
}
