import * as T from "three";
import { buildSalon, floorY, columnPosition } from "../../bakgrund/salong-v1.mjs";
import { addShoe } from "../../artefakter/kortsko-v1.mjs";
import { buildTable, textiles, trimDepth } from "./bord.mjs";

export function renderPairs(layout) {
  const width = 1600, height = 900;
  const scene = new T.Scene();
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  buildSalon(scene);

  // Bake the room that is actually visible into the reflections on leather and brass.
  const cube = new T.WebGLCubeRenderTarget(128, { type: T.HalfFloatType });
  const probe = new T.CubeCamera(0.02, 20, cube);
  probe.position.set(0, 0.10, 0);
  probe.update(renderer, scene);
  const pmrem = new T.PMREMGenerator(renderer);
  const reflection = pmrem.fromCubemap(cube.texture);
  scene.environment = reflection.texture;
  scene.environmentIntensity = 0.48;
  addShoe(scene, layout.shoe);
  const cloth = textiles(layout);
  const aim = new T.Vector3(0, 0.095, -0.035);
  const cameras = {}, cameraData = {};
  const rounded = v => Number(v.toFixed(5));
  const vector = v => v.toArray().map(rounded);
  const points = {
    mittkryss: [0, 0, layout.table.centerZ],
    kortmal: [layout.landing.xCm / 100, 0, layout.landing.zCm / 100],
    sko: [layout.shoe.x, 0, layout.shoe.z],
    pelare: [columnPosition[0], 0.43, columnPosition[1]],
  };
  for (const seat of [4, 1]) {
    const cam = new T.PerspectiveCamera(48, width / height, 0.02, 20);
    // Back up along each studio seat's radius to include the entire rail.
    cam.position.fromArray(layout.eyes[seat]);
    cam.position.x *= 1.34;
    cam.position.z *= 1.34;
    cam.lookAt(aim);
    cam.updateMatrixWorld();
    cameras[seat] = cam;
    const direction = cam.getWorldDirection(new T.Vector3());
    const projected = {};
    for (const [key, point] of Object.entries(points)) {
      const p = new T.Vector3(...point).project(cam);
      projected[key] = [Math.round((1 + p.x) * width / 2), Math.round((1 - p.y) * height / 2)];
    }
    // Where the camera-to-column ray crosses the back wall. Side seat sees the
    // same column against the right wall instead if it intersects that first.
    const ray = new T.Vector3(...points.pelare).sub(cam.position);
    const tBack = (-3 - cam.position.z) / ray.z;
    const tRight = ray.x > 0 ? (3.55 - cam.position.x) / ray.x : Infinity;
    const back = cam.position.clone().addScaledVector(ray, Math.min(tBack, tRight));
    cameraData[seat] = {
      eye: vector(cam.position), aim: vector(aim), direction: vector(direction),
      floorHeightCm: rounded(100 * (cam.position.y - floorY)), fovVertical: cam.fov,
      fovHorizontal: rounded(T.MathUtils.radToDeg(2 * Math.atan(cam.aspect * Math.tan(T.MathUtils.degToRad(cam.fov / 2))))),
      downDegrees: rounded(T.MathUtils.radToDeg(-Math.asin(direction.y))), pixels: projected,
      wallBehindColumn: { wall: tBack <= tRight ? "bakvägg" : "höger vägg", xyz: vector(back) },
    };
  }
  const images = {}, bounds = {};
  for (const shorter of [false, true]) {
    const variant = shorter ? "kort" : "grund";
    const group = buildTable(layout, shorter, cloth);
    scene.add(group);
    group.updateMatrixWorld(true);
    // Geometry vertices give the actual extents, including rail and feet.
    const measure = new T.Box3().setFromObject(group, true);
    bounds[variant] = { min: vector(measure.min), max: vector(measure.max) };
    for (const seat of [4, 1]) {
      renderer.render(scene, cameras[seat]);
      const labeled = document.createElement("canvas");
      labeled.width = width;
      labeled.height = height;
      const ctx = labeled.getContext("2d");
      ctx.drawImage(renderer.domElement, 0, 0);
      ctx.fillStyle = "rgba(24,33,28,0.88)";
      ctx.beginPath();
      ctx.roundRect(32, 30, 118, 40, 6);
      ctx.fill();
      ctx.font = '600 23px "Segoe UI", sans-serif';
      ctx.fillStyle = "#f8f4e9";
      ctx.fillText("Stol " + seat, 57, 57);
      images[variant + "-stol-" + seat + ".png"] = labeled.toDataURL("image/png").split(",")[1];
    }
    scene.remove(group);
  }
  pmrem.dispose();
  cube.dispose();
  reflection.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return { images, metadata: { id: "filtdjup-v1", width, height, floorY, trimDepth, points, cameras: cameraData, bounds } };
}
