import * as T from "three";
import { captureScene } from "./ankarkameran.mjs";

const width = 1280;
const height = 720;
const pixels = width * height;
const hairId = new T.MeshBasicMaterial({ color: 0xff00ff, toneMapped: false });
const stockId = new T.MeshBasicMaterial({ color: 0x00ffff, toneMapped: false });

function selectNode(scene, name, optional = false) {
  const selected = scene.asset.scene.getObjectByName(T.PropertyBinding.sanitizeNodeName(name));
  if (!selected && optional) return new Set();
  if (!selected) throw Error("GLB-noden saknas: " + name);
  const meshes = new Set();
  selected.traverse(child => { if (child.isMesh) meshes.add(child); });
  if (!meshes.size) throw Error("GLB-noden saknar yta: " + name);
  return meshes;
}

function describeMaterials(meshes) {
  return [...meshes].flatMap(mesh => (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
    .map(material => ({
      mesh: mesh.name, material: material.name, baseColorSRGB: material.color?.getHexString(),
      baseColorTexture: Boolean(material.map), doubleSided: material.side === T.DoubleSide
    })));
}

function projectCard(meshes, point) {
  const box = new T.Box3(), p = new T.Vector3();
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const mesh of meshes) {
    const positions = mesh.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      mesh.localToWorld(mesh.getVertexPosition(i, p));
      box.expandByPoint(p);
      const [x, y] = point(p.toArray());
      bounds[0] = Math.min(bounds[0], x);
      bounds[1] = Math.min(bounds[1], y);
      bounds[2] = Math.max(bounds[2], x);
      bounds[3] = Math.max(bounds[3], y);
    }
  }
  const center = box.getCenter(p).toArray();
  return { centerM: center, boundsM: [box.min.toArray(), box.max.toArray()], centerPx: point(center), boundsPx: bounds };
}

function inspectPixels(raw, ids) {
  const bounds = Object.fromEntries(["card", "nextStock", "crown", "leftHand", "rightHand"].map(k => [k, [width, height, -1, -1]]));
  const counts = { card: 0, nextStock: 0, crown: 0, leftHand: 0, rightHand: 0 };
  let yellowStockPixels = 0;
  const color = { interiorSamples: 0, yellow: 0, white: 0, boundarySamples: 0, yellowBoundary: 0, whiteBoundary: 0 };
  const totals = [0, 0, 0];
  function yellowId(i) {
    const off = i * 4;
    return ids[off] >= 250 && ids[off + 1] >= 250 && ids[off + 2] <= 5;
  }
  for (let i = 0; i < pixels; i++) {
    const off = i * 4, r = ids[off], g = ids[off + 1], b = ids[off + 2];
    let tag;
    if (yellowId(i)) tag = "card";
    else if (r <= 5 && g >= 250 && b >= 250) tag = "nextStock";
    else if (r > 220 && g < 35 && b > 220) tag = "crown";
    else if (r > 220 && g < 35 && b < 35) tag = "leftHand";
    else if (g > 220 && r < 35 && b < 35) tag = "rightHand";
    else continue;
    const x = i % width, y = height - 1 - Math.floor(i / width);
    const box = bounds[tag];
    counts[tag]++;
    box[0] = Math.min(box[0], x);
    box[1] = Math.min(box[1], y);
    box[2] = Math.max(box[2], x);
    box[3] = Math.max(box[3], y);
    if (tag !== "card" && tag !== "nextStock") continue;
    const red = raw[off], green = raw[off + 1], blue = raw[off + 2];
    const isYellow = red > 90 && green > 80 && blue < .58 * Math.min(red, green);
    if (tag === "nextStock") {
      yellowStockPixels += Number(isYellow);
      continue;
    }
    const low = Math.min(red, green, blue);
    const isWhite = low > 150 && Math.max(red, green, blue) - low < 26;
    color.interiorSamples++;
    color.yellow += Number(isYellow);
    color.white += Number(isWhite);
    totals[0] += red; totals[1] += green; totals[2] += blue;
    if (x === 0 || x === width - 1 || y === 0 || y === height - 1 ||
        !yellowId(i - 1) || !yellowId(i + 1) || !yellowId(i - width) || !yellowId(i + width)) {
      color.boundarySamples++;
      color.yellowBoundary += Number(isYellow);
      color.whiteBoundary += Number(isWhite);
    }
  }
  for (const key of Object.keys(counts)) if (!counts[key]) bounds[key] = null;
  color.meanRGB = counts.card ? totals.map(total => Math.round(total / counts.card)) : null;
  return { counts, boundsPx: bounds, color, yellowStockPixels };
}

if (captureScene) {
  const { asset, renderer, world, camera, mixer, objects, bg, fog, yellow, black, hand, point } = captureScene;
  const hairMeshes = selectNode(captureScene, "Paulinas hår");
  const gl = renderer.getContext();
  let cardMeshes, nextStockMeshes;
  window.selectDealCard = (name, stockName) => {
    cardMeshes = selectNode(captureScene, name);
    nextStockMeshes = selectNode(captureScene, stockName, true);
    return { dealt: describeMaterials(cardMeshes), nextStock: describeMaterials(nextStockMeshes) };
  };
  window.captureDeal = (time, view, p4M, measure) => {
    mixer.setTime(time);
    world.updateMatrixWorld(true);
    camera.fov = view.verticalFovDeg;
    camera.position.fromArray(view.positionM);
    camera.lookAt(...view.lookAtM);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    renderer.render(world, camera);
    const png = renderer.domElement.toDataURL("image/png").split(",")[1];
    const card = projectCard(cardMeshes, point);
    const nextStock = nextStockMeshes.size ? projectCard(nextStockMeshes, point) : null;
    if (!measure) return { png, card };
    const raw = new Uint8Array(pixels * 4), ids = new Uint8Array(raw.length);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    try {
      for (const [mesh, , semantic] of objects) {
        if (cardMeshes.has(mesh)) mesh.material = yellow;
        else if (nextStockMeshes.has(mesh)) mesh.material = stockId;
        else if (hairMeshes.has(mesh)) mesh.material = hairId;
        else mesh.material = semantic === hand ? hand : black;
      }
      world.background = black.color;
      world.fog = null;
      renderer.shadowMap.enabled = false;
      renderer.render(world, camera);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, ids);
    } finally {
      for (const [mesh, material] of objects) mesh.material = material;
      world.background = bg;
      world.fog = fog;
      renderer.shadowMap.enabled = true;
    }
    const measured = inspectPixels(raw, ids);
    const p4AreaM = [[-.0315, -.0445], [.0315, -.0445], [.0315, .0445], [-.0315, .0445]];
    return {
      png, card, nextStock, measured,
      matrices: {
        cameraWorld: camera.matrixWorld.toArray(),
        worldToCamera: camera.matrixWorldInverse.toArray(),
        projection: camera.projectionMatrix.toArray()
      },
      p4CenterPx: point(p4M),
      p4CardCornersPx: p4AreaM.map(([x, z]) => point([p4M[0] + x, p4M[1], p4M[2] + z])),
      animationDurationSeconds: asset.animations[0].duration
    };
  };
}
