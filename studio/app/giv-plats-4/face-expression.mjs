import { BufferAttribute } from "three";

export const expressionTarget = "SnettLeende";
export const expressionClip = "Snett leende · vila till vila";

// Each point is an existing SAM vertex registered on Paulina's original 03.
// Radii and displacements below are millimetres in the seated mesh's bind space.
// The pull on the dealer's right corner continues into her cheek. The opposite
// brow rises, while the inner part of her right brow draws slightly inwards.
const actions = [
  { sam: 5042, radius: [17, 14, 18], move: [-5.7, 9.8, -1.65] },
  { sam: 4869, radius: [19, 19, 15], move: [-1.55, 3.8, 2.2] },
  { sam: 3782, radius: [7, 13, 12], move: [-0.45, 0.65, -0.9] },
  { sam: 904, radius: [15, 13, 16], move: [0.3, -2.8, 0.7] },
  { sam: 3323, radius: [22, 9, 12], move: [-1.2, 0.9, 1.1] },
  { sam: 1156, radius: [19, 13, 18], move: [0.7, 8.35, 0.85] },
  { sam: 653, radius: [12, 13, 11], move: [0.25, 3.0, 0.65] },
  { sam: 5098, radius: [19, 12, 14], move: [1.2, -2.4, 0.5] }
];
const irisIds = [4383, 1497];

function smooth(low, high, value) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

function expressionField(position, identifiers) {
  const requested = new Set([...actions.map(action => action.sam), ...irisIds]);
  const centers = new Map();
  for (let i = 0; i < identifiers.length; i++) {
    const id = identifiers[i];
    if (requested.has(id) && !centers.has(id)) centers.set(id, position.slice(i * 3, i * 3 + 3));
  }
  if (centers.size !== requested.size) throw Error("Paulinas registrerade ansiktspunkter saknas.");
  const regions = actions.map(action => ({ ...action, center: centers.get(action.sam) }));
  const eyes = irisIds.map(id => centers.get(id));
  return function displacement(x, y, z, out) {
    out[0] = out[1] = out[2] = 0;
    let lid = 1;
    for (const p of eyes) {
      const r = Math.hypot((x - p[0]) / .0215, (y - p[1]) / .0095, (z - p[2]) / .014);
      lid = Math.min(lid, smooth(1.05, 1.85, r));
    }
    for (const { center, radius, move } of regions) {
      const dx = (x - center[0]) * 1000 / radius[0];
      const dy = (y - center[1]) * 1000 / radius[1];
      const dz = (z - center[2]) * 1000 / radius[2];
      const r2 = dx * dx + dy * dy + dz * dz;
      if (r2 >= 9) continue;
      const falloff = Math.exp(-.5 * r2) * (1 - smooth(4, 9, r2)) * lid / 1000;
      out[0] += falloff * move[0];
      out[1] += falloff * move[1];
      out[2] += falloff * move[2];
    }
  };
}

/** Calculate glTF-relative POSITION and NORMAL on the original bind-space mesh. */
export function buildPaulinaExpression(position, normal, samIndex) {
  if (position.length !== normal.length || position.length !== samIndex.length * 3) {
    throw Error("Ansiktsgeometrins koordinater stämmer inte.");
  }
  const displacement = expressionField(position, samIndex);
  const offset = new Float32Array(position.length), normalOffset = new Float32Array(position.length);
  const d = [0, 0, 0], plus = [0, 0, 0], minus = [0, 0, 0];
  const derivative = new Float64Array(9), step = .00015;
  for (let i = 0; i < position.length; i += 3) {
    const x = position[i], y = position[i + 1], z = position[i + 2];
    displacement(x, y, z, d);
    if (Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]) < 1e-8) continue;
    offset.set(d, i);
    // Transform the existing smooth normal with the local deformation gradient.
    // UV seams can share a position while keeping distinct authored normals.
    for (let axis = 0; axis < 3; axis++) {
      const dx = axis === 0 ? step : 0, dy = axis === 1 ? step : 0, dz = axis === 2 ? step : 0;
      displacement(x + dx, y + dy, z + dz, plus);
      displacement(x - dx, y - dy, z - dz, minus);
      for (let row = 0; row < 3; row++) {
        derivative[3 * axis + row] = (axis === row ? 1 : 0) + (plus[row] - minus[row]) / (2 * step);
      }
    }
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = derivative;
    const [nx, ny, nz] = [normal[i], normal[i + 1], normal[i + 2]];
    let px = nx * (by * cz - bz * cy) + ny * (cy * az - cz * ay) + nz * (ay * bz - az * by);
    let py = nx * (bz * cx - bx * cz) + ny * (cz * ax - cx * az) + nz * (az * bx - ax * bz);
    let pz = nx * (bx * cy - by * cx) + ny * (cx * ay - cy * ax) + nz * (ax * by - ay * bx);
    const length = Math.hypot(px, py, pz);
    px /= length; py /= length; pz /= length;
    normalOffset.set([px - nx, py - ny, pz - nz], i);
  }
  return { position: offset, normal: normalOffset };
}

/** Attach to the glTF root, set a weight from 0 to 1, then release before disposing its scene. */
export function createPaulinaExpression(scene) {
  let mesh;
  scene.traverse(obj => {
    if (obj.isSkinnedMesh && obj.geometry.hasAttribute("_sam_index")) mesh = obj;
  });
  if (!mesh) throw Error("Paulinas ansiktsyta saknas i scenen.");
  const original = mesh.geometry;
  const originalWeights = mesh.morphTargetInfluences;
  const originalDictionary = mesh.morphTargetDictionary;
  let index = originalDictionary?.[expressionTarget], owned;
  if (index === undefined) {
    if (original.morphAttributes.position?.length) throw Error("Scenen har en annan uppsättning ansiktsuttryck.");
    const { position, normal, _sam_index } = original.attributes;
    const deltas = buildPaulinaExpression(position.array, normal.array, _sam_index.array);
    owned = original.clone();
    owned.morphTargetsRelative = true;
    for (const [key, delta] of Object.entries(deltas)) {
      const target = new BufferAttribute(delta, 3);
      target.name = expressionTarget;
      owned.morphAttributes[key] = [target];
    }
    mesh.geometry = owned;
    mesh.updateMorphTargets();
    index = mesh.morphTargetDictionary[expressionTarget];
  }
  const previous = mesh.morphTargetInfluences[index];
  let disposed = false;
  return {
    set(weight) {
      if (disposed) throw Error("Ansiktsprovet är avslutat.");
      mesh.morphTargetInfluences[index] = Number.isFinite(weight) ? Math.min(1, Math.max(0, weight)) : 0;
    },
    dispose() {
      if (disposed) return;
      mesh.morphTargetInfluences[index] = previous;
      if (owned) {
        mesh.geometry = original;
        mesh.morphTargetInfluences = originalWeights;
        mesh.morphTargetDictionary = originalDictionary;
        owned.dispose();
      }
      disposed = true;
    }
  };
}
