import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { aspect, sideFieldOfView, tableView } from "./orbit-cameras.mjs";

const fingerNames = ["wrist", "thumb_null", "index_null", "middle_null", "ring_null", "pinky_null"];

// Keep the lighting of the registered v1 film (studio/tools/ankarkameran.mjs).
function lightStage(renderer, world, normalBias) {
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const bg = new T.Color(0x65786d);
  world.background = bg;
  world.fog = new T.Fog(bg, 2.75, 5.1);
  const floor = new T.Mesh(new T.PlaneGeometry(32, 32), new T.MeshStandardMaterial({
    color: 0x5b655c, roughness: .93, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
  }));
  floor.rotation.x = -Math.PI / 2;
  world.add(floor, new T.HemisphereLight(0xfff4e7, 0xc7d4cd, 1.75));
  const key = new T.DirectionalLight(0xffe9ce, 1.88);
  key.position.set(-1.8, 3.6, 2.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -1.5, right: 1.5, top: 1.6, bottom: -1.5, near: .2, far: 8 });
  key.shadow.normalBias = Number.isFinite(normalBias) && normalBias >= 0 && normalBias <= .005 ? normalBias : .0005;
  key.shadow.bias = -.00012;
  const rim = new T.DirectionalLight(0xe4edff, .85);
  rim.position.set(2, 2, -1);
  world.add(key, rim);
}

function disposeWorld(world) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), bitmaps = new Set(), skeletons = new Set();
  world.traverse(obj => {
    obj.shadow?.dispose();
    if (!obj.isMesh) return;
    geometries.add(obj.geometry);
    if (obj.skeleton) skeletons.add(obj.skeleton);
    for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const texture of textures) {
    if (typeof texture.image?.close === "function") bitmaps.add(texture.image);
    texture.dispose();
  }
  for (const bitmap of bitmaps) bitmap.close();
  for (const skeleton of skeletons) skeleton.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

function handCamera(points, angle, camera) {
  const center = new T.Box3().setFromPoints(points).getCenter(new T.Vector3());
  const elevation = T.MathUtils.degToRad(55);
  const radians = T.MathUtils.degToRad(angle);
  const outward = new T.Vector3(Math.sin(radians) * Math.cos(elevation), Math.sin(elevation), Math.cos(radians) * Math.cos(elevation));
  const right = new T.Vector3(Math.cos(radians), 0, -Math.sin(radians));
  const up = new T.Vector3().crossVectors(outward, right);
  const slope = Math.tan(T.MathUtils.degToRad(15));
  let distance = .37;
  const offset = new T.Vector3();
  for (const p of points) {
    offset.subVectors(p, center);
    const lateral = Math.abs(offset.dot(right)) / (slope * aspect * .78);
    const vertical = Math.abs(offset.dot(up)) / (slope * .78);
    distance = Math.max(distance, offset.dot(outward) + Math.max(lateral, vertical));
  }
  camera.position.copy(center).addScaledVector(outward, distance);
  camera.fov = 30;
  camera.lookAt(center);
  return center;
}

/** @param {HTMLCanvasElement} canvas @param {string} sceneUrl @param {AbortSignal} signal */
export async function createOrbitScene(canvas, sceneUrl, signal) {
  const url = new URL(sceneUrl, window.location.href);
  if (url.origin !== window.location.origin) throw Error("Scenen måste hämtas från den lokala studion.");
  const response = await fetch(url, { signal, cache: "no-cache" });
  if (!response.ok) throw Error("Givens 3D-scen gick inte att läsa.");
  const bytes = await response.arrayBuffer();
  signal.throwIfAborted();
  const asset = await new GLTFLoader().parseAsync(bytes, new URL(".", url).href);
  const world = new T.Scene();
  world.add(asset.scene);
  let renderer;
  try {
    signal.throwIfAborted();
    if (!asset.animations[0]) throw Error("Scenens givanimation saknas.");
    const joints = ["l", "r"].flatMap(side => fingerNames.map(finger => {
      const name = side + "_" + finger, joint = asset.scene.getObjectByName(name);
      if (!joint) throw Error("Givens fingerled " + name + " saknas.");
      return joint;
    }));
    const card = asset.scene.getObjectByName(T.PropertyBinding.sanitizeNodeName("Rött spelkort"))
      ?? asset.scene.getObjectByName(T.PropertyBinding.sanitizeNodeName("Utdelat gult kort"));
    const eyes = ["l_eye", "r_eye"].map(name => asset.scene.getObjectByName(name));
    if (eyes.some(eye => !eye)) throw Error("Paulinas ögonleder saknas.");
    if (!card) throw Error("Det utdelade kortet saknas.");
    // The node origin is not assumed to be the card centre. Keep its corners in node space.
    asset.scene.updateMatrixWorld(true);
    const cardLocal = new T.Box3(), vertex = new T.Vector3(), inverse = card.matrixWorld.clone().invert();
    card.traverse(obj => {
      if (!obj.isMesh) return;
      const attr = obj.geometry.getAttribute("position");
      for (let i = 0; i < attr.count; i++) cardLocal.expandByPoint(obj.getVertexPosition(i, vertex).applyMatrix4(obj.matrixWorld).applyMatrix4(inverse));
    });
    if (cardLocal.isEmpty()) throw Error("Kortets geometri saknas.");
    const corners = [];
    for (const x of [cardLocal.min.x, cardLocal.max.x]) for (const y of [cardLocal.min.y, cardLocal.max.y])
      for (const z of [cardLocal.min.z, cardLocal.max.z]) corners.push(new T.Vector3(x, y, z));
    const cardCenter = cardLocal.getCenter(new T.Vector3());
    renderer = new T.WebGLRenderer({ canvas, antialias: true });
    world.remove(asset.scene);
    lightStage(renderer, world, asset.parser.json.asset.extras?.portraitLighting?.shadowNormalBiasM);
    world.add(asset.scene);
    asset.scene.traverse(obj => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
    const mixer = new T.AnimationMixer(asset.scene), clip = asset.animations[0], action = mixer.clipAction(clip);
    action.setLoop(T.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    const camera = new T.PerspectiveCamera(40, aspect, .015, 30);
    const at = new T.Vector3(), fingertip = joints.map(() => new T.Vector3()), liveCorners = corners.map(() => new T.Vector3());
    // The gaze trial has a baked neutral pose. Its comparison camera stays at
    // that pose while the head turns in front of it.
    const restingEyeCenter = eyes[0].getWorldPosition(new T.Vector3()).lerp(eyes[1].getWorldPosition(vertex), .5);
    const highFov = sideFieldOfView(asset.parser.json.asset.extras);
    let gaze = new T.Vector3(), sampledSeconds = 0;
    let idMaterials;
    /** @param {number} frame @param {number} fps @param {number} index @param {boolean | "helbild" | "hander" | "ansikte" | "fast-ansikte"} cut */
    function draw(frame, fps, index, cut = "helbild") {
      const rate = Number.isFinite(fps) && fps > 0 ? fps : 24;
      sampledSeconds = Math.min(clip.duration, Math.max(0, Math.round(frame) || 0) / rate);
      action.paused = false;
      mixer.setTime(sampledSeconds);
      world.updateMatrixWorld(true);
      joints.forEach((joint, i) => joint.getWorldPosition(fingertip[i]));
      card.localToWorld(at.copy(cardCenter));
      corners.forEach((corner, i) => card.localToWorld(liveCorners[i].copy(corner)));
      const view = tableView(index, highFov);
      if (cut === "ansikte" || cut === "fast-ansikte") {
        const radians = view.azimuthDeg * Math.PI / 180;
        if (cut === "fast-ansikte") gaze.copy(restingEyeCenter);
        else gaze.copy(eyes[0].getWorldPosition(vertex)).add(eyes[1].getWorldPosition(vertex)).multiplyScalar(.5);
        gaze.y -= .022;
        camera.position.set(gaze.x + .96 * Math.sin(radians), gaze.y + .10, gaze.z + .96 * Math.cos(radians));
        camera.fov = 22;
        camera.lookAt(gaze);
      } else if (cut === true || cut === "hander") {
        const closeToCard = fingertip.some(p => p.distanceToSquared(at) < .18 ** 2);
        gaze = handCamera(closeToCard ? [...fingertip, ...liveCorners] : fingertip, view.azimuthDeg, camera);
      } else {
        camera.position.fromArray(view.positionM);
        gaze.fromArray(view.lookAtM);
        camera.fov = view.verticalFovDeg;
        camera.lookAt(gaze);
      }
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      const bounds = canvas.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(16, Math.min(1920, Math.round(Math.min(bounds.width, bounds.height * aspect) * ratio / 16) * 16));
      const height = width * 9 / 16;
      if (canvas.width !== width || canvas.height !== height) renderer.setSize(width, height, false);
      renderer.render(world, camera);
    }
    function inspect() {
      const project = p => {
        const v = p.clone().project(camera);
        return [(v.x + 1) * canvas.width / 2, (1 - v.y) * canvas.height / 2, v.z];
      };
      return {
        seconds: sampledSeconds, width: canvas.width, height: canvas.height, verticalFovDeg: camera.fov,
        eyeM: camera.position.toArray(), lookAtM: gaze.toArray(), cameraWorld: camera.matrixWorld.toArray(),
        projection: camera.projectionMatrix.toArray(), cardCenterM: at.toArray(), cardPx: project(at),
        cardCornersPx: liveCorners.map(project), handLandmarksPx: Object.fromEntries(joints.map((joint, i) => [joint.name, project(fingertip[i])])),
        eyeLandmarksPx: eyes.map(eye => project(eye.getWorldPosition(vertex)))
      };
    }
    function measureCardVisibility() {
      idMaterials ??= {
        card: new T.MeshBasicMaterial({ color: 0xffff00, toneMapped: false }),
        other: new T.MeshBasicMaterial({ color: 0, toneMapped: false })
      };
      const selected = new Set();
      card.traverse(obj => { if (obj.isMesh) selected.add(obj); });
      const original = new Map();
      const bg = world.background, fog = world.fog;
      try {
        world.traverse(obj => {
          if (!obj.isMesh) return;
          original.set(obj, obj.material);
          obj.material = selected.has(obj) ? idMaterials.card : idMaterials.other;
        });
        world.background = idMaterials.other.color;
        world.fog = null;
        renderer.shadowMap.enabled = false;
        renderer.render(world, camera);
        const gl = renderer.getContext(), w = canvas.width, h = canvas.height;
        const rgba = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
        let visible = 0;
        for (let i = 0; i < rgba.length; i += 4) if (rgba[i] >= 250 && rgba[i + 1] >= 250 && rgba[i + 2] <= 5) visible++;
        return visible;
      } finally {
        for (const [obj, material] of original) obj.material = material;
        world.background = bg;
        world.fog = fog;
        renderer.shadowMap.enabled = true;
        renderer.render(world, camera);
      }
    }
    return {
      draw, inspect, measureCardVisibility,
      dispose() {
        mixer.stopAllAction();
        mixer.uncacheRoot(asset.scene);
        disposeWorld(world);
        idMaterials?.card.dispose();
        idMaterials?.other.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      }
    };
  } catch (error) {
    disposeWorld(world);
    renderer?.dispose();
    throw error;
  }
}
