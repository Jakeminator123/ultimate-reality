import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire, registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = fileURLToPath(new URL(".", import.meta.url));
const root = path.resolve(directory, "../../../../../..");
const dependency = createRequire(path.join(root, "studio/package.json"));
const three = path.join(path.dirname(dependency.resolve("three")), "three.module.js");
registerHooks({ resolve(name, context, next) {
  return next(name === "three" ? pathToFileURL(three).href : name, context);
} });
const T = await import("three");
const { GLTFLoader } = await import(pathToFileURL(dependency.resolve("three/addons/loaders/GLTFLoader.js")));
const { createDrawInspection, facesOf, potential, closestSkin, padGap, curveFor, vec, millimetres } =
  await import("../../../../../artefakter/kasinorum-utdrag-100/kollisionsgeometri.mjs");
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const drawFile = path.join(root, "test/artefakter/skoriktning-70-30/bana.json");
const rigFile = path.join(root, "avatars/paulina/3d/fas1-v2/utseende/paulina-fas1-v2-utseende.glb");
const clipFile = process.argv[2] ?? path.join(root, "test/dealer/paulina/kortdrag-v2-v1/paulina-kortdrag-v2-v1.glb");
const output = process.argv[3] ?? path.join(directory, "matt-v2-grepp.json");
const loader = new GLTFLoader();

// Texture decoding is irrelevant to triangle contact. Only disconnect the material in memory.
async function loadModel(bytes) {
  const end = 20 + bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.subarray(20, end));
  for (const mesh of doc.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  const json = Buffer.from(JSON.stringify(doc));
  const padded = (json.length + 3) & ~3;
  const stripped = Buffer.concat([bytes.subarray(0,20), json, Buffer.alloc(padded-json.length, 32), bytes.subarray(end)]);
  stripped.writeUInt32LE(stripped.length, 8);
  stripped.writeUInt32LE(padded, 12);
  return loader.parseAsync(stripped.buffer.slice(stripped.byteOffset, stripped.byteOffset + stripped.byteLength), "");
}

function skinParts(scene) {
  const parts = [];
  scene.traverse(object => { if (object.isSkinnedMesh) parts.push(object); });
  assert.ok(parts.length, "Modellen saknar en skinnad yta.");
  return parts;
}

function meshHash(mesh) {
  const hash = createHash("sha256");
  for (const attribute of [mesh.geometry.index, mesh.geometry.attributes.position,
    mesh.geometry.attributes.skinIndex, mesh.geometry.attributes.skinWeight]) {
    const { array } = attribute;
    hash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
  }
  return hash.digest("hex");
}

// Assign by the strongest skin weight. Restrict contact checks to triangles with
// at least two vertices from that specific digit's two distal phalanges.
function handTriangles(mesh) {
  const ids = mesh.geometry.attributes.skinIndex;
  const weights = mesh.geometry.attributes.skinWeight;
  const bones = mesh.skeleton.bones;
  const labels = Array.from({ length:ids.count }, (_, n) => {
    let lane = 0;
    for (let i = 1; i < 4; i++) if (weights.getComponent(n,i) > weights.getComponent(n,lane)) lane = i;
    return bones[ids.getComponent(n,lane)].name;
  });
  const indices = mesh.geometry.index;
  const sets = { index:[], middle:[] };
  for (let t=0; t<indices.count/3; t++) {
    const names = [0,1,2].map(k => labels[indices.getX(3*t+k)]);
    for (const finger of Object.keys(sets)) {
      const prefix = "l_" + finger;
      const isDistal = name => name === prefix+"2" || name === prefix+"3" || name === prefix+"_null";
      if (names.filter(isDistal).length >= 2) sets[finger].push(t);
    }
  }
  assert.ok(sets.index.length && sets.middle.length, "Båda distala fingerytorna måste kunna identifieras.");
  return { sets, labels, indices };
}

// On two disjoint closed triangles the minimum occurs at a vertex/face or
// between two edges. A separate volumetric test reports any penetration.
function edgeDistanceSquared(p, q, r, s) {
  const u = q.clone().sub(p), v = s.clone().sub(r), w = p.clone().sub(r);
  const a = u.dot(u), b = u.dot(v), c = v.dot(v), d = u.dot(w), e = v.dot(w);
  const clamp = n => Math.max(0,Math.min(1,n));
  const det = a*c-b*b;
  let t = det > 1e-24 ? clamp((b*e-c*d)/det) : 0;
  const z = c > 0 ? (b*t+e)/c : 0;
  if (z < 0 || c === 0) t = a > 0 ? clamp(-d/a) : 0;
  else if (z > 1) t = a > 0 ? clamp((b-d)/a) : 0;
  return w.addScaledVector(u,t).addScaledVector(v,-clamp(z)).lengthSq();
}

function surfaceDistance(first, second) {
  let best = Infinity;
  const target = new T.Vector3(), triangle = new T.Triangle();
  for (const a of first) for (const b of second) {
    const x = Math.max(0,a.box.min.x-b.box.max.x,b.box.min.x-a.box.max.x);
    const y = Math.max(0,a.box.min.y-b.box.max.y,b.box.min.y-a.box.max.y);
    const z = Math.max(0,a.box.min.z-b.box.max.z,b.box.min.z-a.box.max.z);
    if (x*x+y*y+z*z >= best) continue;
    for (const [vertices, opposite] of [[a.points,b.points],[b.points,a.points]]) {
      triangle.set(...opposite);
      for (const vertex of vertices)
        best = Math.min(best, triangle.closestPointToPoint(vertex,target).distanceToSquared(vertex));
    }
    for (let i=0;i<3;i++) for (let j=0;j<3;j++)
      best = Math.min(best, edgeDistanceSquared(a.points[i],a.points[(i+1)%3],b.points[j],b.points[(j+1)%3]));
  }
  return millimetres(Math.sqrt(best));
}

const [bytes, sourceBytes, takeBytes, configBytes] = await Promise.all([
  readFile(clipFile), readFile(rigFile), readFile(drawFile), readFile(path.join(root, "studio/lib/table-layout.json")),
]);
const take = JSON.parse(takeBytes);
const { inspect, inverseShoe, fixtures, tabletop } = createDrawInspection(take.shoe, JSON.parse(configBytes));
const shoeFaces = potential(fixtures.flatMap(mesh=>facesOf(mesh)));
const feltFaces = potential(facesOf(tabletop));
const [model, source] = await Promise.all([loadModel(bytes), loadModel(sourceBytes)]);
const meshes = skinParts(model.scene), sourceMeshes = skinParts(source.scene);
const body = meshes.find(m => m.geometry.hasAttribute("_sam_index"));
assert.ok(body, "MHR-hudens källattribut saknas.");
const { sets, labels, indices } = handTriangles(body);
const sourceHashes = sourceMeshes.map(meshHash).sort(), renderHashes = meshes.map(meshHash).sort();
const bindMatches = JSON.stringify(sourceHashes) === JSON.stringify(renderHashes);
const fps = 24, frames = 33;
assert.equal(model.animations.length, 1, "Provet förutsätter en entydig animation i GLB.");
const clip = model.animations[0];
assert.ok(Math.abs(clip.duration-(frames-1)/fps)<.00001, "GLB:s tidbas stämmer inte med KORT-02.");
const mixer = new T.AnimationMixer(model.scene);
const action = mixer.clipAction(clip).setLoop(T.LoopOnce, 1);
action.clampWhenFinished = true;
action.play();
const probes = ["root","c_spine3","r_wrist","r_index_null","l_wrist","l_index_null","l_middle_null"];
const trackedBones = Object.fromEntries(probes.map(name => {
  const bone = body.skeleton.getBoneByName(name);
  assert.ok(bone, "Saknad led " + name);
  return [name,bone];
}));
const firstBones = {}, maxDisplacement = {};
const pairs = ["body_shoe","body_card","body_table","card_shoe","card_table"];
const samples = [];
const padAtFrame = [];

for (let n = 0; n < frames; n++) {
  mixer.setTime(Math.min(n/fps, clip.duration));
  model.scene.updateMatrixWorld(true);
  for (const mesh of meshes) mesh.skeleton.update();
  const faces = meshes.map(mesh => facesOf(mesh, true));
  const bodyFaces = faces[meshes.indexOf(body)];
  const a = take.frames[Math.floor(n/4)], b = take.frames[Math.min(take.frames.length-1, Math.floor(n/4)+1)];
  const t = n%4 / 4, curve = curveFor(a,b,t);
  const anchors = Object.keys(sets).map(name => [name,
    vec(...a.contacts[name].pad_xyz_m).lerp(vec(...b.contacts[name].pad_xyz_m),t)]);
  padAtFrame.push(Object.fromEntries(anchors.map(([finger,p]) => [finger,p])));
  const tableTriangles = new Set();
  const results = inspect(faces.flat(), curve, anchors, id => tableTriangles.add(id));
  const labelsOnTable = {};
  for (const id of tableTriangles) {
    let face = id, part = 0;
    while (face >= faces[part].length) face -= faces[part++].length;
    const bone = meshes[part] === body ? labels[indices.getX(3*face)] : meshes[part].name;
    labelsOnTable[bone] = (labelsOnTable[bone] ?? 0) + 1;
  }
  results.body_table.first_vertex_dominant_bones = labelsOnTable;
  for (const kind of ["body_shoe","body_card","body_table"]) {
    if (results[kind].worst_triangle === undefined) continue;
    let face = results[kind].worst_triangle, part = 0;
    while (face >= faces[part].length) face -= faces[part++].length;
    results[kind].worst_mesh = meshes[part].name;
    if (meshes[part] === body)
      results[kind].worst_face_bones = [0,1,2].map(k => labels[indices.getX(3*face+k)]);
  }
  const digits = {};
  for (const [finger, anchor] of anchors) {
    const digit = potential(sets[finger].map(id => bodyFaces[id]));
    digits[finger] = {
      gap_over_14mm_patch_mm: padGap(digit, anchor, curve, inverseShoe, take.shoe.cardWidth),
      distance_to_anchor_mm: closestSkin(digit, anchor),
      clearance_to_shoe_mm: surfaceDistance(digit, shoeFaces),
      clearance_to_felt_mm: surfaceDistance(digit, feltFaces),
    };
  }
  const displacements = {};
  for (const [name,bone] of Object.entries(trackedBones)) {
    const point = bone.getWorldPosition(new T.Vector3());
    firstBones[name] ??= point;
    displacements[name] = millimetres(firstBones[name].distanceTo(point));
    maxDisplacement[name] = Math.max(maxDisplacement[name] ?? 0, displacements[name]);
  }
  samples.push({frame:n+1, seconds:n/fps, fingers:digits, ...results, movement_since_start_mm:displacements});
}
const violations = Object.fromEntries(pairs.map(key => [key, samples.filter(s=>s[key].penetrating_triangles>0).map(s=>s.frame)]));
const fingers = Object.fromEntries(Object.keys(sets).map(f => {
  const gaps = samples.map(s => s.fingers[f].gap_over_14mm_patch_mm);
  const measured = gaps.filter(v => v !== null);
  return [f, { measured_frames: measured.length, gap_range_mm: measured.length ? [Math.min(...measured),Math.max(...measured)] : null,
    max_distance_to_anchor_mm: Math.max(...samples.map(s=>s.fingers[f].distance_to_anchor_mm)),
    min_clearance_to_shoe_mm: Math.min(...samples.map(s=>s.fingers[f].clearance_to_shoe_mm)),
    min_clearance_to_felt_mm: Math.min(...samples.map(s=>s.fingers[f].clearance_to_felt_mm)),
    pad_start_end_displacement_mm: millimetres(padAtFrame[0][f].distanceTo(padAtFrame.at(-1)[f])) }];
}));
const report = {
  animation_file: path.relative(root,clipFile), animation_sha256:digest(bytes), animation_name:clip.name,
  source_sha256:digest(sourceBytes), source_bind_meshes_match:bindMatches, source_bind_mesh_hashes:sourceHashes,
  animation_bind_mesh_hashes:renderHashes, card_path_sha256:digest(takeBytes), table_layout_sha256:digest(configBytes),
  take:take.take, first_card_travel_mm:take.frames.at(-1).travel_mm, frames, fps,
  tolerance_mm:.001, distal_triangles:Object.fromEntries(Object.entries(sets).map(([k,v])=>[k,v.length])),
  cameras:[4,1], collisions_by_frame:violations, fingers, max_joint_movement_since_start_mm:maxDisplacement, samples,
};
await writeFile(output, JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({ source_bind_meshes_match:bindMatches, fingers, collisions_by_frame:violations,
  max_observed_inner_mm:Object.fromEntries(pairs.map(k => [k,Math.max(...samples.map(s=>s[k].deepest_observed_inner_margin_mm))])),
  max_joint_movement_since_start_mm:maxDisplacement },null,2));
if (!bindMatches || Object.values(violations).some(found => found.length) ||
    Object.values(fingers).some(finger => finger.measured_frames !== frames)) process.exitCode = 2;
