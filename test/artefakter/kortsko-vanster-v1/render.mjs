import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".",import.meta.url)), root = path.resolve(here,"../../..");
const require = createRequire(path.join(root,"studio/package.json"));
const { chromium } = require("playwright-core");
const three = path.dirname(require.resolve("three")), addons = path.resolve(three,"../examples/jsm");
const origin = "http://skoprov.localhost/";
const files = new Map();
for (const name of ["three.module.js","three.core.js"]) files.set(name,path.join(three,name));
for (const name of ["loaders/GLTFLoader.js","utils/BufferGeometryUtils.js","utils/SkeletonUtils.js"]) files.set("addons/"+name,path.join(addons,name));
for (const file of ["test/bakgrund/salong-v1.mjs","test/bord/filtdjup-v1/bord.mjs","test/artefakter/kortsko-v1.mjs"]) files.set(file,path.join(root,file));
files.set("original.glb",path.join(root,"test/dealer/paulina/filtdjup-v1-sits406/paulina-sits406.glb"));
files.set("sankt-arm.glb",path.join(here,"sankt-arm.glb"));
files.set("vanster-hand.glb",path.join(here,"vanster-hand-lag.glb"));
const readJSON = async file => JSON.parse(await fs.readFile(file,"utf8"));
const layout = await readJSON(path.join(root,"studio/lib/table-layout.json"));
const cameras = await readJSON(path.join(root,"test/bord/filtdjup-v1/matt.json"));
const metrics = await readJSON(path.join(here,"matt.json"));
const reach = await readJSON(path.join(here,"rackvidd-lag.json"));
const browser = await chromium.launch({channel:"msedge",headless:true,args:["--enable-unsafe-swiftshader"]});
let images;
try {
  const page = await browser.newPage();
  await page.route("**/*",async route=>{
    const url = route.request().url();
    if (url === origin) return route.fulfill({contentType:"text/html",body:'<script type="importmap">{"imports":{"three":"/three.module.js"}}</script>'});
    const file = url.startsWith(origin) && files.get(url.slice(origin.length));
    if (!file) return route.abort();
    return route.fulfill({contentType:file.endsWith(".glb")?"model/gltf-binary":"text/javascript",body:await fs.readFile(file)});
  });
  await page.goto(origin);
  images = await page.evaluate(async ({layout, cal, metrics})=>{
    const T = await import("three");
    const {GLTFLoader} = await import("/addons/loaders/GLTFLoader.js");
    const {buildSalon} = await import("/test/bakgrund/salong-v1.mjs");
    const {buildTable,textiles} = await import("/test/bord/filtdjup-v1/bord.mjs");
    const {addShoe} = await import("/test/artefakter/kortsko-v1.mjs");
    const scene=new T.Scene(), renderer=new T.WebGLRenderer({antialias:true});
    renderer.setSize(cal.width,cal.height,false);
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFShadowMap;
    renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
    buildSalon(scene);
    const cube=new T.WebGLCubeRenderTarget(128,{type:T.HalfFloatType});
    const probe=new T.CubeCamera(.02,20,cube);
    probe.position.set(0,.10,0); probe.update(renderer,scene);
    const pmrem=new T.PMREMGenerator(renderer), reflection=pmrem.fromCubemap(cube.texture);
    scene.environment=reflection.texture; scene.environmentIntensity=.48;
    scene.add(buildTable(layout,false,textiles(layout)));
    const seat=new T.Mesh(new T.BoxGeometry(.32,.045,.27),new T.MeshStandardMaterial({color:0x3b4b45,roughness:.9}));
    seat.position.set(layout.dealerSeat.x,cal.floorY+.406-.045/2,layout.dealerSeat.z);
    scene.add(seat);
    const bodyMaterial=new T.MeshStandardMaterial({color:0xc0d2ce,roughness:.9,side:T.DoubleSide});
    const loader=new GLTFLoader(), bodies={};
    for (const file of ["original.glb","sankt-arm.glb","vanster-hand.glb"]) {
      const body=(await loader.loadAsync("/"+file)).scene;
      body.traverse(m=>{
        if (!m.isMesh) return;
        m.geometry.computeVertexNormals();
        m.material=bodyMaterial; m.castShadow=true; m.receiveShadow=true;
      });
      bodies[file]=body;
    }
    const output={};
    for (const [mode, file, position] of [
      ["original","original.glb", metrics.old_shoe_xz],["flyttad","original.glb",metrics.new_shoe_xz],
      ["sankt","sankt-arm.glb",metrics.new_shoe_xz],["rackvidd","vanster-hand.glb",metrics.new_shoe_xz],
    ]) {
      const body=bodies[file], shoeGroup=new T.Group();
      addShoe(shoeGroup,{...layout.shoe,x:position[0],z:position[1]});
      scene.add(body,shoeGroup);
      output[mode]={};
      for (const id of [4,1]) {
        const c=cal.cameras[id], camera=new T.PerspectiveCamera(c.fovVertical,cal.width/cal.height,.02,20);
        camera.position.fromArray(c.eye); camera.lookAt(new T.Vector3(...c.aim));camera.updateMatrixWorld();
        for (const anchor of ["kortmal","mittkryss"]) {
          const p=new T.Vector3(...cal.points[anchor]).project(camera);
          if (Math.round((1+p.x)*cal.width/2)!==c.pixels[anchor][0]||Math.round((1-p.y)*cal.height/2)!==c.pixels[anchor][1]) throw Error("Kameran avviker.");
        }
        renderer.render(scene,camera);
        output[mode][id]=renderer.domElement.toDataURL("image/webp",.94);
      }
      scene.remove(body,shoeGroup);
    }
    pmrem.dispose();cube.dispose();reflection.dispose();renderer.dispose();renderer.forceContextLoss();
    return output;
  },{layout,cal:cameras,metrics});
} finally {await browser.close();}
assert.equal(new Set(Object.values(images).flatMap(v=>Object.values(v))).size,8);
const html=(await fs.readFile(path.join(here,"visare.mall.html"),"utf8"))
  .replace("__RESULT__", JSON.stringify({images, metrics, reach}));
const target=process.argv[2] ? path.resolve(process.argv[2]) : path.join(here,"skoprov.html");
const prior=await fs.readFile(target,"utf8").catch(e=>{if(e.code!=="ENOENT")throw e;});
if (prior && prior!==html) throw Error("Välj en ny fil för nästa version.");
await fs.writeFile(target,html);
console.log("Åtta bilder med verifierade mål- och mittkoordinater:",target);
