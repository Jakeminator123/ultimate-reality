import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire, registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = path.resolve(here, "../../..");
const studio = createRequire(path.join(root,"studio/package.json"));
const threeModule = path.join(path.dirname(studio.resolve("three")), "three.module.js");
registerHooks({ resolve(specifier, context, next) {
  return next(specifier === "three" ? pathToFileURL(threeModule).href : specifier, context);
} });
const T = await import("three");
const { GLTFLoader } = await import(pathToFileURL(studio.resolve("three/addons/loaders/GLTFLoader.js")));
const { EPS, vec, decimals, millimetres, facesOf, midpoint, lerpFrames, curveFor, createDrawInspection } = await import("./kollisionsgeometri.mjs");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const pathFile=await fs.readFile(process.argv[4] ?? path.join(here,"bana.json"));
const take=JSON.parse(pathFile);
const tableConfig=await fs.readFile(path.join(root,"studio/lib/table-layout.json"));
const layout=JSON.parse(tableConfig);
const cfg=take.shoe;
const { inspect, fixtures, tabletop, wood } = createDrawInspection(cfg, layout);

const input=path.resolve(process.argv[2]??path.join(here,"handkandidat/mhr-arm"));
const output=path.resolve(process.argv[3]??path.join(here,"matt-kollisioner.json"));
const loader=new GLTFLoader(), bodies=[], hashes=[];
const appearanceArgument=process.argv.indexOf("--utseende");
let appearance,appearanceHash;
if(appearanceArgument>=0){
  const bytes=await fs.readFile(process.argv[appearanceArgument+1]);
  appearanceHash=hash(bytes);
  // The collision pass needs the same vertex deformation as the renderer,
  // but the Node loader has no image decoder. Strip only the material links
  // from an in-memory GLB and keep its exact binary geometry and skin.
  const jsonEnd=20+bytes.readUInt32LE(12);
  const document=JSON.parse(bytes.subarray(20,jsonEnd));
  for(const mesh of document.meshes)for(const prim of mesh.primitives)delete prim.material;
  const json=Buffer.from(JSON.stringify(document));
  const padded=(json.length+3)&~3;
  const glb=Buffer.concat([Buffer.from(bytes.subarray(0,20)),json,Buffer.alloc(padded-json.length,32),bytes.subarray(jsonEnd)]);
  glb.writeUInt32LE(glb.length,8);
  glb.writeUInt32LE(padded,12);
  const {prepareAppearance}=await import("./avatarutseende.mjs");
  appearance=prepareAppearance(await loader.parseAsync(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),""));
}
for(let i=0;i<take.frames.length;i++){
  const filename="drag-"+String(i).padStart(2,"0")+".glb";
  const bytes=await fs.readFile(path.join(input,filename));
  let {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),"");
  scene.updateMatrixWorld(true);
  if(appearance){
    const meshes=[];
    scene.traverse(obj=>{if(obj.isMesh)meshes.push(obj);});
    assert.equal(meshes.length,1);
    const source=meshes[0].geometry.clone().applyMatrix4(meshes[0].matrixWorld);
    scene=new T.Group();
    for(const piece of appearance.pieces(source))scene.add(new T.Mesh(piece));
    scene.updateMatrixWorld(true);
  }
  const faces=[];
  scene.traverse(obj=>{if(obj.isMesh) faces.push(...facesOf(obj));});
  assert.ok(faces.length>0);
  if(i>0) assert.equal(faces.length,bodies[0].length);
  // Finger and card correspondences are only interpolated between matching
  // topology. Test the indices, not just the number of triangles.
  const topology=createHash("sha256");
  scene.traverse(obj=>{if(obj.isMesh){
    const geom=obj.geometry;
    topology.update(String(geom.attributes.position.count));
    if(geom.index) topology.update(Buffer.from(geom.index.array.buffer,geom.index.array.byteOffset,geom.index.array.byteLength));
  }});
  const topo=topology.digest("hex");
  if(i) assert.equal(topo,hashes[0].index_hash,"Topologin byts mellan bildrutorna.");
  bodies.push(faces);
  hashes.push({file:filename,sha256:hash(bytes),index_hash:topo});
}
const samples=[];
for(let f=0;f<bodies.length;f++){
  const j=Math.min(f+1,bodies.length-1), left=take.frames[f], right=take.frames[j];
  for(const t of f===j ? [0] : [0,.25,.5,.75]){
    const body=t===0 ? bodies[f] : lerpFrames(bodies[f],bodies[j],t);
    const anchors=Object.keys(left.contacts).map(n=>[n,midpoint(vec(...left.contacts[n].pad_xyz_m),vec(...right.contacts[n].pad_xyz_m),t)]);
    samples.push({frame:f+1+t, type:t===0?"exported":"linear interpolation", ...inspect(body,curveFor(left,right,t),anchors)});
  }
}
const collisions=samples.filter(s=>["body_shoe","body_card","body_table","card_shoe","card_table"].some(k=>s[k].penetrating_triangles));
const report={take:take.take, path_sha256:hash(pathFile),appearance_sha256:appearanceHash,body_directory:path.relative(root,input),hashes,
  geometry_sources:["studio/lib/card-shoe.mjs","test/bord/filtdjup-v1/bord.mjs"], tabletop_depth_m:-wood.min.y,
  table_layout_sha256:hash(tableConfig),table_width_m:decimals(wood.max.x-wood.min.x,6),table_length_m:decimals(wood.max.z-wood.min.z,6),
  tolerance_mm:millimetres(EPS), body_triangles:bodies[0].length, sampled_frames:samples.length,
  interpolated_frames:samples.length-bodies.length,frames_with_penetration:collisions.map(s=>s.frame),samples};
await fs.writeFile(output,JSON.stringify(report,null,2)+"\n");
if (process.argv[5] && process.argv[5]!=="--utseende") {
  // Boundary edges occur in exactly one triangle of the rendered felt.
  const boundary = new Map();
  for (const points of facesOf(tabletop)) {
    for (let i=0; i<3; i++) {
      const edge = [points[i], points[(i+1)%3]].map(p => [decimals(p.x,7),decimals(p.z,7)]);
      const key = edge.map(p => p.join(",")).sort().join("|");
      if (boundary.has(key)) boundary.delete(key);
      else boundary.set(key,edge);
    }
  }
  const foot = facesOf(fixtures[0]).flat().filter(p => Math.abs(p.y)<EPS);
  const footprint = [...new Map(foot.map(p => [[p.x,p.z].join(","), [p.x,p.z]])).values()];
  await fs.writeFile(process.argv[5], JSON.stringify({felt_edges_xz_m:[...boundary.values()],shoe_foot_xz_m:footprint})+"\n");
}
console.log(JSON.stringify({output, samples:samples.length, collisions:report.frames_with_penetration,
  peak_inner_mm:Object.fromEntries(["body_shoe","body_card","body_table","card_shoe","card_table"].map(k=>
    [k,Math.max(...samples.map(s=>s[k].deepest_observed_inner_margin_mm))]))}));
if(collisions.length) process.exitCode=2;
