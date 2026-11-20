import * as T from "three";
import { pendantCentre } from "./pendel.mjs";

export const pendantCandela = 12;

export function addPendantLight(scene) {
  // The reconstructed bulb has no photometry. Model the opening towards the table.
  const light = new T.SpotLight(0xffd19b, pendantCandela, 15, T.MathUtils.degToRad(55), .45, 2);
  light.position.fromArray(pendantCentre);
  light.target.position.set(0, .02, 0);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  // A shadow map spanning the whole room quantizes the grazing light across the felt.
  // Aim its narrower frustum at the hand, card and rim.
  light.shadow.focus = .38;
  light.shadow.camera.near = 1.5;
  light.shadow.normalBias = .012;
  light.shadow.bias = -.002;
  light.shadow.radius = 3;
  light.shadow.intensity = .70;
  light.visible = false;
  scene.add(light, light.target);
  return light;
}

export function frameAt(seconds) {
  // Hold each endpoint so a viewer can see the card before and after the draw.
  // A new cycle starts with the first card in its original pose.
  const progress = T.MathUtils.clamp((seconds % 3 - .45) / 1.9, 0, 1);
  return Math.round(32 * progress);
}

export function motionFrame(mesh, appearance) {
  mesh.updateWorldMatrix(true, false);
  const source = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  const geometry = appearance.pieces(source);
  source.dispose();
  return geometry;
}

export function drawCardAt(frame, take, drawCard) {
  const left = Math.floor(frame / 4), right = Math.min(left + 1, take.frames.length - 1);
  const fraction = frame / 4 - left;
  const a = take.frames[left].card_curve_zy_m, b = take.frames[right].card_curve_zy_m;
  drawCard(a.map(([z, y], k) => [T.MathUtils.lerp(z, b[k][0], fraction), T.MathUtils.lerp(y, b[k][1], fraction)]));
}

export async function loadDraw(loader, url, look, body, firstPose, take, drawCard) {
  const poses = [firstPose];
  for (let i = 1; i < take.frames.length; i++) {
    const result = await loader.loadAsync(url("drag-" + String(i).padStart(2, "0") + ".glb"));
    const mesh = result.scene.getObjectByProperty("isMesh", true);
    const geometry = motionFrame(mesh, look);
    geometry.forEach((part, j) => {
      const original = firstPose[j];
      if (part.attributes.position.count !== original.attributes.position.count ||
          part.index?.count !== original.index?.count ||
          part.index?.array.some((value, vertex) => value !== original.index.array[vertex])) {
        throw Error("Utdragets poser använder olika meshtopologi.");
      }
    });
    poses.push(geometry);
    mesh.geometry.dispose();
  }
  let previous = -1;
  return frame => {
    if (previous === frame) return;
    const left = Math.floor(frame / 4), right = Math.min(left + 1, poses.length - 1);
    const fraction = frame / 4 - left;
    for (let j = 0; j < body.length; j++) {
      const piece = body[j].geometry;
      const a = poses[left][j].attributes.position.array, b = poses[right][j].attributes.position.array;
      const position = piece.attributes.position;
      for (let k = 0; k < a.length; k++) position.array[k] = a[k] + (b[k] - a[k]) * fraction;
      position.needsUpdate = true;
      piece.computeVertexNormals();
      piece.computeBoundingSphere();
    }
    drawCardAt(frame, take, drawCard);
    previous = frame;
  };
}
