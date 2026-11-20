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
const { buildDrawShoe } = await import("../../../studio/lib/card-shoe.mjs");
const { buildTable } = await import("../../bord/filtdjup-v1/bord.mjs");

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const EPS = 1e-6; // 0.001 mm from a measured material surface counts as touch.
const vec = (x,y,z) => new T.Vector3(x,y,z);
const bounds = points => new T.Box3().setFromPoints(points);
const tri = (a,b,c) => [a,b,c];
const decimals = (v, digits=4) => Number(v.toFixed(digits));
const millimetres = v => decimals(v * 1000);
// Only the texture painting calls need a canvas. The original mesh constructors
// still supply every world-space vertex; material colour plays no role in QA.
const context = new Proxy({ createImageData(w,h) { return {data:new Uint8ClampedArray(w*h*4)}; } },
  { get(o,key) { return key in o ? o[key] : () => {}; } });
globalThis.document = {createElement() { return {getContext: () => context}; }};

function facesOf(mesh) {
  const p = mesh.geometry.getAttribute("position");
  const vertices = Array.from({length:p.count}, (_,i) => new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld));
  const idx = mesh.geometry.getIndex();
  return Array.from({length:(idx?.count ?? p.count)/3}, (_,k) =>
    [0,1,2].map(i => vertices[idx ? idx.getX(3*k+i) : 3*k+i]));
}

function solid(name, faces) {
  const points = faces.flat();
  const center = points.reduce((s,p) => s.add(p), new T.Vector3()).divideScalar(points.length);
  const planes = [];
  for (const [a,b,c] of faces) {
    const p = new T.Plane().setFromCoplanarPoints(a,b,c);
    if (!Number.isFinite(p.constant) || p.normal.lengthSq() < .5) continue;
    if (p.distanceToPoint(center)>0) p.negate();
    if (planes.some(q => q.normal.distanceToSquared(p.normal) < 1e-14 && Math.abs(q.constant-p.constant) < 1e-7)) continue;
    assert.ok(points.every(v => p.distanceToPoint(v)<2e-7), "Icke-konvex del: "+name);
    planes.push(p);
  }
  assert.ok(planes.length>=4, "Tom volym: "+name);
  return {name, planes, bounds:bounds(points).expandByScalar(EPS)};
}

function prism(name, top, bottom) {
  const faces = [top.slice(0,3),bottom.slice(0,3)];
  for(let i=0;i<top.length;i++){
    const j=(i+1)%top.length;
    faces.push(tri(top[i],bottom[i],top[j]));
  }
  // Include all six or eight points when building bounds and checking convexity.
  for(let i=1;i<bottom.length-1;i++) faces.push(tri(bottom[0],bottom[i],bottom[i+1]));
  return solid(name,faces);
}

function section(triangle, planes, tolerance) {
  let polygon=triangle;
  for(const p of planes){
    const out=[];
    let a=polygon.at(-1), da=p.distanceToPoint(a)-tolerance;
    for(const b of polygon){
      const db=p.distanceToPoint(b)-tolerance;
      if((da<0)!==(db<0)) out.push(a.clone().lerp(b,da/(da-db)));
      if(db<=0) out.push(b);
      a=b; da=db;
    }
    if(!out.length) return [];
    polygon=out;
  }
  return polygon;
}

function contacts(subject, pieces) {
  const hits = new Set(), touches = new Set(), components = new Map();
  let maxDepth=0, worstPoint, worstTriangle;
  const totalBox=new T.Box3();
  for(const p of pieces) totalBox.union(p.bounds);
  for(const {points,box,id} of subject) {
    if(!box.intersectsBox(totalBox)) continue;
    for(const p of pieces){
      if(!box.intersectsBox(p.bounds)) continue;
      const overlap=section(points,p.planes,EPS);
      if(!overlap.length) continue;
      touches.add(id);
      const inner=section(points,p.planes,-EPS);
      if(!inner.length) continue;
      hits.add(id); components.set(p.name,(components.get(p.name)??0)+1);
      // A sample inside a convex solid gives a verified lower bound on the
      // deepest penetration. It is not a skin deformation or contact force.
      const middle=inner.reduce((sum,v)=>sum.add(v),new T.Vector3()).divideScalar(inner.length);
      for(const point of [...inner,middle]) {
        const depth=Math.min(...p.planes.map(plane=>-plane.distanceToPoint(point)));
        if(depth>maxDepth) {maxDepth=depth; worstPoint=point; worstTriangle=id;}
      }
    }
  }
  return {penetrating_triangles:hits.size, boundary_only_triangles:touches.size-hits.size,
    deepest_observed_inner_margin_mm:millimetres(maxDepth),
    ...(worstPoint ? {worst_xyz_m:worstPoint.toArray().map(v=>decimals(v,6)), worst_triangle:worstTriangle} : {}),
    components:Object.fromEntries(components)};
}

function closestSkin(geometry, point) {
  let nearest = Infinity;
  const hit=new T.Vector3(), triangle=new T.Triangle();
  for(const {points,box} of geometry) {
    if(box.distanceToPoint(point)>=nearest) continue;
    triangle.set(...points).closestPointToPoint(point,hit);
    nearest=Math.min(nearest,hit.distanceTo(point));
  }
  return millimetres(nearest);
}

// The contact point can slide a few mm within the finger pad. Measure the
// closest skin above a 14 x 14 mm patch on the actual bent playing card as
// well as the exact reference point. The two numbers answer different questions.
function padGap(geometry, target, curve, inverseShoe, width) {
  const local=target.clone().applyMatrix4(inverseShoe), radius=.007;
  const box=new T.Box3(target.clone().addScalar(-.024),target.clone().addScalar(.024));
  const nearby=geometry.filter(q=>q.box.intersectsBox(box))
    .map(q=>q.points.map(p=>p.clone().applyMatrix4(inverseShoe)));
  const xLo=Math.max(-width/2,local.x-radius), xHi=Math.min(width/2,local.x+radius);
  const across=[new T.Plane(vec(-1,0,0),xLo),new T.Plane(vec(1,0,0),-xHi)];
  let smallest=Infinity;
  for(let i=0;i<curve.length-1;i++){
    const [za,ya]=curve[i], [zb,yb]=curve[i+1];
    const zLo=Math.max(za,local.z-radius), zHi=Math.min(zb,local.z+radius);
    if(zLo>zHi) continue;
    const slope=(yb-ya)/(zb-za);
    const top=new T.Plane(vec(0,1,-slope),slope*za-ya).normalize();
    const halfspace=[...across,new T.Plane(vec(0,0,-1),zLo),new T.Plane(vec(0,0,1),-zHi),top.clone().negate()];
    for(const t of nearby)
      for(const p of section(t,halfspace,0)) smallest=Math.min(smallest,Math.max(0,top.distanceToPoint(p)));
  }
  return Number.isFinite(smallest) ? millimetres(smallest) : null;
}
const potential = faces => faces.map((points,id)=>({points,box:bounds(points),id}));
const midpoint = (a,b,t) => a.clone().lerp(b,t);
const lerpFrames = (a,b,t) => a.map((f,i)=>f.map((p,j)=>midpoint(p,b[i][j],t)));

const pathFile=await fs.readFile(process.argv[4] ?? path.join(here,"bana.json"));
const take=JSON.parse(pathFile);
const tableConfig=await fs.readFile(path.join(root,"studio/lib/table-layout.json"));
const layout=JSON.parse(tableConfig);
const cfg=take.shoe;
const {shoe,draw}=buildDrawShoe(cfg);
shoe.updateMatrixWorld(true);
const names=["botten","läpp","v-sidovägg","v-front","v-list","h-sidovägg","h-front","h-list","bakstycke","huv","kortstapel"];
const fixtures=shoe.children.filter(m=>m.geometry.type!=="PlaneGeometry" && m.geometry.getAttribute("position"));
assert.equal(names.length,fixtures.length);
const shoeSolids=fixtures.map((m,i)=>solid(names[i],facesOf(m)));
const table=buildTable(layout,false,{tex:null,span:1.8});
table.updateMatrixWorld(true);
const tabletop=table.children.find(m=>m.geometry?.type==="ShapeGeometry");
assert.ok(tabletop);
const wood=new T.Box3().setFromObject(table.children[0],true);
const slab=facesOf(tabletop).map((top,i)=>prism("skiva",top,top.map(p=>vec(p.x,wood.min.y,p.z))));
const curveFor=(a,b,t)=>a.card_curve_zy_m.map(([z,y],i)=>[z+(b.card_curve_zy_m[i][0]-z)*t, y+(b.card_curve_zy_m[i][1]-y)*t]);

function inspect(body, curve, anchors) {
  const geometry=potential(body);
  draw(curve);
  const card=shoe.children.at(-1);
  const cardFaces=potential(facesOf(card));
  const cardPoints=card.geometry.getAttribute("position");
  const station=(i,side)=>new T.Vector3().fromBufferAttribute(cardPoints,4*i+side).applyMatrix4(shoe.matrixWorld);
  const strip=[];
  for(let i=0;i<curve.length-1;i++) {
    strip.push(prism("kort", [station(i,0),station(i,1),station(i+1,1),station(i+1,0)],
      [station(i,2),station(i,3),station(i+1,3),station(i+1,2)]));
  }
  return {
    body_shoe:contacts(geometry,shoeSolids), body_card:contacts(geometry,strip), body_table:contacts(geometry,slab),
    card_shoe:contacts(cardFaces,shoeSolids), card_table:contacts(cardFaces,slab),
    distance_from_marked_pad_sites_to_skin_mm:Object.fromEntries(anchors.map(([name,point])=>[name,closestSkin(geometry,point)])),
    min_skin_gap_above_14mm_contact_patch_mm:Object.fromEntries(anchors.map(([name,point])=>
      [name,padGap(geometry,point,curve,shoe.matrixWorld.clone().invert(),cfg.cardWidth)]))
  };
}

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
