import * as T from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { GroundedSkybox } from "three/addons/objects/GroundedSkybox.js";
import { buildSalon, floorY } from "../salong-v1.mjs";
import { buildTable, textiles } from "../../bord/filtdjup-v1/bord.mjs";
import { addShoe } from "../../artefakter/kortsko-v1.mjs";

// Estimate a direction for the contact shadow from the brightest integrated
// patch above the horizon. RGBE rows start at the north pole.
function keyDirection(texture) {
  const { width, height, data } = texture.image;
  const columns = 24, rows = 8, bins = new Float64Array(columns * rows);
  for (let y = 0; y < height * 0.46; y += 8) {
    const latitude = Math.PI * (0.5 - (y + 0.5) / height);
    for (let x = 0; x < width; x += 8) {
      const i = 4 * (y * width + x);
      const lum = 0.2126 * T.DataUtils.fromHalfFloat(data[i]) +
        0.7152 * T.DataUtils.fromHalfFloat(data[i + 1]) + 0.0722 * T.DataUtils.fromHalfFloat(data[i + 2]);
      const bin = Math.floor(y / (height / 2) * rows) * columns + Math.floor(x / width * columns);
      bins[bin] += lum * Math.cos(latitude);
    }
  }
  const peak = bins.indexOf(Math.max(...bins));
  const lon = 2 * Math.PI * ((peak % columns + 0.5) / columns - 0.5);
  const lat = Math.PI / 2 * (1 - (Math.floor(peak / columns) + 0.5) / rows);
  return new T.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
}

function addFloorLamp(scene) {
  const group = new T.Group();
  group.position.set(0.80, floorY, -1.17);
  const brass = new T.MeshStandardMaterial({ color: 0xb09661, roughness: 0.32, metalness: 0.8 });
  const cloth = new T.MeshStandardMaterial({ color: 0xf2dfb9, roughness: 0.95, side: T.DoubleSide });
  for (const [top, bottom, height, y, material] of [
    [0.14, 0.16, 0.031, 0.0155, brass], [0.014, 0.015, 1.34, 0.70, brass],
    [0.14, 0.22, 0.27, 1.43, cloth], [0.016, 0.020, 0.022, 1.577, brass],
  ]) {
    const m = new T.Mesh(new T.CylinderGeometry(top, bottom, height, 64), material);
    m.position.y = y;
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  }
  scene.add(group);
}

export async function renderStudy(layout, calibration, variant) {
  const { width, height } = calibration;
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  let raw, cube, reflection;
  const images = {}, projected = {};
  try {
    const salon = variant === "salong" || variant === "studioljus";
    if (salon) buildSalon(scene);
    if (variant === "salong") {
      cube = new T.WebGLCubeRenderTarget(128, { type: T.HalfFloatType });
      const probe = new T.CubeCamera(0.02, 20, cube);
      probe.position.set(0, 0.1, 0);
      probe.update(renderer, scene);
      reflection = pmrem.fromCubemap(cube.texture);
    } else {
      const asset = variant === "lounge" ? "lythwood_lounge" : "studio_kontrast_04";
      raw = await new HDRLoader().loadAsync("/asset/" + asset + "_4k.hdr");
      raw.mapping = T.EquirectangularReflectionMapping;
      reflection = pmrem.fromEquirectangular(raw);
      if (!salon) {
        const heightEstimate = 1.5;
        const dome = new GroundedSkybox(raw, heightEstimate, 9, 96);
        dome.position.y = floorY + heightEstimate;
        dome.renderOrder = -1;
        scene.add(dome);
        const catcher = new T.Mesh(new T.PlaneGeometry(15, 15), new T.ShadowMaterial({ opacity: 0.36, depthWrite: false }));
        catcher.rotation.x = -Math.PI/2;
        catcher.position.y = floorY + 0.001;
        catcher.receiveShadow = true;
        scene.add(catcher);
        const shadowKey = new T.DirectionalLight(0xfff5e8, 0.35);
        shadowKey.position.copy(keyDirection(raw)).multiplyScalar(4);
        shadowKey.castShadow = true;
        Object.assign(shadowKey.shadow.camera, { left:-3, right:3, top:3, bottom:-3, near:0.1, far:10 });
        shadowKey.shadow.mapSize.set(2048, 2048);
        shadowKey.shadow.normalBias = 0.001;
        scene.add(shadowKey);
        if (variant === "lounge") addFloorLamp(scene);
      }
    }
    scene.environment = reflection.texture;
    scene.environmentIntensity = salon ? 0.48 : 1;
    addShoe(scene, layout.shoe);
    scene.add(buildTable(layout, false, textiles(layout)));
    for (const seat of [4, 1]) {
      const spec = calibration.cameras[seat];
      const camera = new T.PerspectiveCamera(spec.fovVertical, width/height, 0.02, 20);
      camera.position.fromArray(spec.eye);
      camera.lookAt(new T.Vector3(...spec.aim));
      camera.updateMatrixWorld();
      projected[seat] = {};
      for (const anchor of ["mittkryss","kortmal","sko"]) {
        const p = new T.Vector3(...calibration.points[anchor]).project(camera);
        projected[seat][anchor] = [Math.round((1+p.x)*width/2), Math.round((1-p.y)*height/2)];
      }
      renderer.render(scene, camera);
      images[seat] = renderer.domElement.toDataURL("image/webp", 0.94);
    }
    return { images, projected };
  } finally {
    raw?.dispose(); cube?.dispose(); reflection?.dispose(); pmrem.dispose();
    renderer.dispose(); renderer.forceContextLoss();
  }
}
