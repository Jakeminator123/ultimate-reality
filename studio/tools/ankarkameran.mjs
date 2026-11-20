import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
try {
  const renderer = new T.WebGLRenderer({
    canvas: document.querySelector("canvas"),
    antialias: true,
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(1);
  renderer.setSize(1280, 720, false);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const world = new T.Scene(),
    bg = new T.Color(0x65786d);
  world.background = bg;
  const fog = new T.Fog(bg, 2.75, 5.1);
  world.fog = fog;
  const floor = new T.Mesh(new T.PlaneGeometry(32, 32), new T.MeshStandardMaterial({
    color: 0x5b655c,
    roughness: .93,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  world.add(floor);
  world.add(new T.HemisphereLight(0xfff4e7, 0xc7d4cd, 1.75));
  const key = new T.DirectionalLight(0xffe9ce, 1.88);
  key.position.set(-1.8, 3.6, 2.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {
    left: -1.5,
    right: 1.5,
    top: 1.6,
    bottom: -1.5,
    near: .2,
    far: 8
  });
  key.shadow.normalBias = .0005;
  key.shadow.bias = -.00012;
  world.add(key);
  const rim = new T.DirectionalLight(0xe4edff, .85);
  rim.position.set(2, 2, -1);
  world.add(rim);
  const asset = await new GLTFLoader().loadAsync("/__ankare-prov/ankare.glb");
  world.add(asset.scene);
  const mixer = new T.AnimationMixer(asset.scene),
    action = mixer.clipAction(asset.animations[0]);
  action.setLoop(T.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  mixer.addEventListener("finished", () => {
    action.paused = false;
  });
  const camera = new T.PerspectiveCamera(31, 1280 / 720, .015, 30),
    target = new T.Vector3(.072, .862, .233),
    radius = 1.62,
    up = .93;
  const yellow = new T.MeshBasicMaterial({
      color: 0xffff00,
      toneMapped: false
    }),
    blue = new T.MeshBasicMaterial({
      color: 0x0000ff,
      toneMapped: false
    }),
    black = new T.MeshBasicMaterial({
      color: 0x000000,
      toneMapped: false
    });
  const hand = new T.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false
  });
  const objects = [];
  world.traverse(obj => {
    if (!obj.isMesh) return;
    obj.castShadow = obj !== floor;
    obj.receiveShadow = obj !== floor;
    const name = obj.name.toLocaleLowerCase("sv");
    let semantic = black;
    if (name.startsWith("gult_") || name.startsWith("gult ")) semantic = yellow;else if (/kortskons|skokind|främre.skokind|matningsslits|mynningens|kortstock|översta.kort/.test(name)) semantic = blue;
    if (obj.isSkinnedMesh) {
      const attr = obj.geometry.attributes,
        colors = new Uint8Array(attr.position.count * 3);
      for (let v = 0; v < attr.position.count; v++) {
        let strongest = 0,
          joint = 0;
        for (let k = 0; k < 4; k++) {
          const w = attr.skinWeight.getComponent(v, k);
          if (w > strongest) {
            strongest = w;
            joint = attr.skinIndex.getComponent(v, k);
          }
        }
        const jointName = obj.skeleton.bones[joint].name;
        if (/^l_(wrist|thumb|index|middle|ring|pinky)/.test(jointName)) colors[v * 3] = 255;
        if (/^r_(wrist|thumb|index|middle|ring|pinky)/.test(jointName)) colors[v * 3 + 1] = 255;
      }
      obj.geometry.setAttribute("color", new T.BufferAttribute(colors, 3, true));
      semantic = hand;
    }
    objects.push([obj, obj.material, semantic]);
  });
  if (!objects.some(entry => entry[2] === yellow)) throw Error("Gula skokortet saknas");
  function point(xyz) {
    const q = new T.Vector3(...xyz).project(camera);
    return [(q.x * .5 + .5) * 1280, (.5 - q.y * .5) * 720];
  }
  function inspect(raw, ids) {
    const stats = {
      leftHand: [0, 1280, 720, -1, -1],
      rightHand: [0, 1280, 720, -1, -1],
      shoe: [0, 1280, 720, -1, -1],
      yellow: [0, 1280, 720, -1, -1]
    };
    const channels = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
    let corroborated = 0;
    for (let i = 0; i < 1280 * 720; i++) {
      const off = i * 4,
        r = ids[off],
        g = ids[off + 1],
        b = ids[off + 2];
      let box;
      if (r > 220 && g > 220 && b < 36) {
        box = stats.yellow;
        for (let c = 0; c < 3; c++) channels[c][raw[off + c]]++;
        if (raw[off] > 100 && raw[off + 1] > 90 && raw[off + 2] < .58 * Math.min(raw[off], raw[off + 1])) corroborated++;
      } else if (r > 220 && g < 35 && b < 35) {
        box = stats.leftHand;
      } else if (g > 220 && r < 35 && b < 35) {
        box = stats.rightHand;
      } else if (b > 220 && r < 35 && g < 35) {
        box = stats.shoe;
      } else {
        continue;
      }
      const x = i % 1280,
        y = 719 - Math.floor(i / 1280);
      box[0]++;
      box[1] = Math.min(box[1], x);
      box[2] = Math.min(box[2], y);
      box[3] = Math.max(box[3], x);
      box[4] = Math.max(box[4], y);
    }
    const median = stats.yellow[0] ? channels.map(bins => {
      let s = 0;
      for (let i = 0; i < 256; i++) {
        s += bins[i];
        if (s * 2 >= stats.yellow[0]) return i;
      }
    }) : null;
    const card = objects.find(entry => entry[2] === yellow)[0],
      p = card.geometry.attributes.position;
    const corners = Array.from({
      length: 4
    }, (_, i) => point(card.localToWorld(new T.Vector3().fromBufferAttribute(p, i)).toArray()));
    const fullArea = Math.abs(corners.reduce((sum, [x, y], i) => {
      const [x1, y1] = corners[(i + 1) % 4];
      return sum + x * y1 - y * x1;
    }, 0)) * .5;
    return {
      visiblePixels: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, v[0]])),
      pixelBounds: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, v[0] ? v.slice(1) : null])),
      yellowMedianRGB: median,
      yellowConfirmedPixels: corroborated,
      projectedYellowCorners: corners,
      projectedYellowAreaPx: fullArea,
      visibleYellowFraction: Math.min(1, stats.yellow[0] / Math.max(1, fullArea))
    };
  }
  function capture(time, azimuth, landmarks, mask = true) {
    mixer.setTime(time);
    const rad = T.MathUtils.degToRad(azimuth);
    camera.position.set(target.x + radius * Math.sin(rad), target.y + up, target.z + radius * Math.cos(rad));
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    renderer.render(world, camera);
    const png = renderer.domElement.toDataURL("image/png").split(",")[1];
    let stats = {};
    if (mask) {
      const gl = renderer.getContext();
      const raw = new Uint8Array(1280 * 720 * 4),
        ids = new Uint8Array(raw.length);
      gl.readPixels(0, 0, 1280, 720, gl.RGBA, gl.UNSIGNED_BYTE, raw);
      objects.forEach(([m, _, sem]) => m.material = sem);
      world.background = black.color;
      world.fog = null;
      renderer.shadowMap.enabled = false;
      renderer.render(world, camera);
      gl.readPixels(0, 0, 1280, 720, gl.RGBA, gl.UNSIGNED_BYTE, ids);
      stats = inspect(raw, ids);
      objects.forEach(([m, original]) => m.material = original);
      world.background = bg;
      world.fog = fog;
      renderer.shadowMap.enabled = true;
    }
    return {
      png,
      stats: {
        ...stats,
        time,
        azimuth,
        cameraWorld: [...camera.matrixWorld.elements],
        worldToCamera: [...camera.matrixWorldInverse.elements],
        projection: [...camera.projectionMatrix.elements],
        screen: Object.fromEntries(Object.entries(landmarks).map(([k, p]) => [k, point(p)]))
      }
    };
  }
  window.captureAnchor = capture;
} catch (e) {
  window.problem = String(e.stack || e);
}
