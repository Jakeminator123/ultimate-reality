import * as T from "three";
import assert from "node:assert/strict";
import { buildDrawShoe } from "../../../studio/lib/card-shoe.mjs";
import { buildTable } from "../../bord/filtdjup-v1/bord.mjs";

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

function facesOf(mesh, skinned = false) {
  const p = mesh.geometry.getAttribute("position");
  const vertices = Array.from({length:p.count}, (_,i) => {
    const point = new T.Vector3();
    if (skinned) mesh.getVertexPosition(i, point);
    else point.fromBufferAttribute(p, i);
    return point.applyMatrix4(mesh.matrixWorld);
  });
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

function contacts(subject, pieces, onPenetration) {
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
      onPenetration?.(id, p.name);
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

const curveFor=(a,b,t)=>a.card_curve_zy_m.map(([z,y],i)=>[z+(b.card_curve_zy_m[i][0]-z)*t, y+(b.card_curve_zy_m[i][1]-y)*t]);


export function createDrawInspection(cfg, layout) {
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
  function inspect(body, curve, anchors, onTablePenetration) {
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
      body_shoe:contacts(geometry,shoeSolids), body_card:contacts(geometry,strip), body_table:contacts(geometry,slab,onTablePenetration),
      card_shoe:contacts(cardFaces,shoeSolids), card_table:contacts(cardFaces,slab),
      distance_from_marked_pad_sites_to_skin_mm:Object.fromEntries(anchors.map(([name,point])=>[name,closestSkin(geometry,point)])),
      min_skin_gap_above_14mm_contact_patch_mm:Object.fromEntries(anchors.map(([name,point])=>
        [name,padGap(geometry,point,curve,shoe.matrixWorld.clone().invert(),cfg.cardWidth)]))
    };
  }
  return { inspect, fixtures, tabletop, wood, inverseShoe: shoe.matrixWorld.clone().invert() };
}

export { EPS, vec, decimals, millimetres, facesOf, midpoint, lerpFrames, curveFor, potential, padGap, closestSkin };
