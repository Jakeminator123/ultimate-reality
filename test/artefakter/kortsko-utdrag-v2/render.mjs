import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here=fileURLToPath(new URL(".",import.meta.url)), root=path.resolve(here,"../../..");
const require=createRequire(path.join(root,"studio/package.json"));
const {chromium}=require("playwright-core");
const three=path.dirname(require.resolve("three")), addons=path.resolve(three,"../examples/jsm");
const files=new Map();
for (const f of ["three.core.js","three.module.js"]) files.set(f,path.join(three,f));
for (const f of ["loaders/GLTFLoader.js","utils/BufferGeometryUtils.js","utils/SkeletonUtils.js"]) files.set("addons/"+f,path.join(addons,f));
for (const f of ["studio/lib/card-shoe.mjs","test/bakgrund/salong-v1.mjs","test/bord/filtdjup-v1/bord.mjs","test/artefakter/kortsko-utdrag-v2/sko.mjs"]) files.set(f,path.join(root,f));
const json=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const results=path.join(here,"drag-mot-filt");
const cfg=await json(path.join(here,"scen.json")), report=await json(path.join(results,"matt-utdrag.json"));
const cal=await json(path.join(root,"test/bord/filtdjup-v1/matt.json")), layout=await json(path.join(root,"test/bord/filtdjup-v1/layout-v1.json"));
const poseFile=i=>"drag-"+String(i).padStart(2,"0")+".glb";
for (let i=0;i<cfg.frames;i++) files.set(poseFile(i),path.join(results,poseFile(i)));
const origin="http://utdragsprov.localhost/";
const browser=await chromium.launch({channel:"msedge",headless:true,args:["--enable-unsafe-swiftshader"]});
let photos;
try {
  const page=await browser.newPage();
  await page.route("**/*",async route=>{
    const url=route.request().url();
    if(url===origin)return route.fulfill({contentType:"text/html",body:'<script type="importmap">{"imports":{"three":"/three.module.js"}}</script>'});
    const file=url.startsWith(origin)&&files.get(url.slice(origin.length));
    if(!file)return route.abort();
    return route.fulfill({contentType:file.endsWith(".glb")?"model/gltf-binary":"text/javascript",body:await fs.readFile(file)});
  });
  await page.goto(origin);
  photos=await page.evaluate(async ({cfg,cal,layout,report})=>{
    const T=await import("three");
    const {GLTFLoader}=await import("/addons/loaders/GLTFLoader.js");
    const {buildSalon}=await import("/test/bakgrund/salong-v1.mjs");
    const {buildTable,textiles}=await import("/test/bord/filtdjup-v1/bord.mjs");
    const {buildDrawShoe}=await import("/test/artefakter/kortsko-utdrag-v2/sko.mjs");
    const scene=new T.Scene(), renderer=new T.WebGLRenderer({antialias:true});
    renderer.setSize(cal.width,cal.height,false);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    buildSalon(scene);
    const cube=new T.WebGLCubeRenderTarget(128,{type:T.HalfFloatType});
    const probe=new T.CubeCamera(.02,20,cube);probe.position.set(0,.10,0);probe.update(renderer,scene);
    const pmrem=new T.PMREMGenerator(renderer), env=pmrem.fromCubemap(cube.texture);
    scene.environment=env.texture;scene.environmentIntensity=.48;
    scene.add(buildTable(layout,false,textiles(layout)));
    const {shoe,draw}=buildDrawShoe(cfg);scene.add(shoe);
    const seat=new T.Mesh(new T.BoxGeometry(.32,.045,.27),new T.MeshStandardMaterial({color:0x3b4b45,roughness:.9}));
    seat.position.set(layout.dealerSeat.x,cal.floorY+.406-.045/2,layout.dealerSeat.z);scene.add(seat);
    const detail=shoe.localToWorld(new T.Vector3(0,.053,.100));
    const cameras={};
    for (const id of [4,1]) {
      const c=cal.cameras[id]; cameras[id]={};
      for (const view of ["bord","hand"]) {
        const camera=new T.PerspectiveCamera(view==="bord"?c.fovVertical:12,cal.width/cal.height,.02,20);
        camera.position.fromArray(c.eye);camera.lookAt(view==="bord"?new T.Vector3(...c.aim):detail);camera.updateMatrixWorld();
        cameras[id][view]=camera;
        if(view==="bord")for(const anchor of ["kortmal","mittkryss"]){
          const p=new T.Vector3(...cal.points[anchor]).project(camera);
          if(Math.round((1+p.x)*cal.width/2)!==c.pixels[anchor][0]||Math.round((1-p.y)*cal.height/2)!==c.pixels[anchor][1])throw Error("Kameran avviker");
        }
      }
    }
    const loader=new GLTFLoader(), output=[];
    const bodyMaterial=new T.MeshStandardMaterial({color:0xc0d2ce,roughness:.9,side:T.DoubleSide});
    for(let frame=-1;frame<cfg.frames;frame++){
      let body;
      if(frame>=0){
        body=(await loader.loadAsync("/drag-"+String(frame).padStart(2,"0")+".glb")).scene;
        body.traverse(m=>{if(m.isMesh){m.geometry.computeVertexNormals();m.material=bodyMaterial;m.receiveShadow=m.castShadow=true;}});
        scene.add(body);
      }
      draw(report.frames[Math.max(frame,0)].card_curve_zy_m);
      const shot={};
      for(const id of [4,1])for(const view of ["bord","hand"]){
        renderer.render(scene,cameras[id][view]);
        shot[id+"-"+view]=renderer.domElement.toDataURL("image/webp",.91);
      }
      output.push(shot);
      if(body){scene.remove(body);body.traverse(m=>{if(m.isMesh)m.geometry.dispose();});}
    }
    env.dispose();pmrem.dispose();cube.dispose();renderer.dispose();renderer.forceContextLoss();
    return output;
  },{cfg,cal,layout,report});
} finally {await browser.close();}
assert.equal(photos.length,cfg.frames+1);
const template=await fs.readFile(path.join(here,"visare.mall.html"),"utf8");
const html=template.replace("__DATA__",JSON.stringify({photos,report}));
const dst=process.argv[2]?path.resolve(process.argv[2]):path.join(results,"skoprov.html");
const existing=await fs.readFile(dst,"utf8").catch(e=>{if(e.code!=="ENOENT")throw e;});
if(existing&&existing!==html)throw Error("Denna resultatversion finns redan. Ange en ny HTML-sökväg.");
await fs.writeFile(dst,html);
console.log(dst,photos.length*4,"bilder");
