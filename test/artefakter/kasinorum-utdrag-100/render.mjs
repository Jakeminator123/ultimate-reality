import fs from "node:fs/promises";
import nodePath from "node:path";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const here=fileURLToPath(new URL(".",import.meta.url)),root=nodePath.resolve(here,"../../..");
const require=createRequire(nodePath.join(root,"studio/package.json"));
const {chromium}=require("playwright-core");
const three=nodePath.dirname(require.resolve("three")),addons=nodePath.resolve(three,"../examples/jsm");
const read=async file=>JSON.parse(await fs.readFile(file,"utf8"));
const path=await read(process.argv[5] ?? nodePath.join(here,"bana.json"));
const poseDir=process.argv[2]?nodePath.resolve(process.argv[2]):nodePath.join(here,"handkandidat/mhr-arm");
const output=process.argv[3]?nodePath.resolve(process.argv[3]):nodePath.join(here,"utdrag.html");
const appearanceFile=process.argv[6] ? nodePath.resolve(process.argv[6]) : null;
const config={path,subdivisions:4,cal:await read(nodePath.join(root,"test/bord/filtdjup-v1/matt.json")),
  layout:await read(nodePath.join(root,"studio/lib/table-layout.json")),
  original:await read(nodePath.join(root,"test/bord/filtdjup-v1/layout-v1.json")),
  surfacesOnly:process.argv[4]==="--materialprov",posePreview:["--poseprov","--helvyprov"].includes(process.argv[4]),
  wholeTableOnly:process.argv[4]==="--helvyprov",seatPair:process.argv[4]==="--stolspar",appearance:!!appearanceFile};
const files=new Map();
for(const f of ["three.core.js","three.module.js"])files.set(f,nodePath.join(three,f));
for(const f of ["loaders/GLTFLoader.js","utils/BufferGeometryUtils.js","utils/SkeletonUtils.js"])files.set("addons/"+f,nodePath.join(addons,f));
for(const f of ["test/bakgrund/salong-v1.mjs","test/bord/filtdjup-v1/bord.mjs","studio/lib/card-shoe.mjs","test/artefakter/kasinorum-utdrag-100/scen.mjs"])files.set(f,nodePath.join(root,f));
files.set("test/artefakter/kasinorum-utdrag-100/avatarutseende.mjs",nodePath.join(here,"avatarutseende.mjs"));
const materialDir="test/bord/polyhaven-material-v1/";
files.set(materialDir+"material.mjs",nodePath.join(root,materialDir,"material.mjs"));
files.set(materialDir+"manifest.json",nodePath.join(root,materialDir,"manifest.json"));
for(const name of await fs.readdir(nodePath.join(root,materialDir,"maps"))){
  if(name.endsWith(".jpg"))files.set(materialDir+"maps/"+name,nodePath.join(root,materialDir,"maps",name));
}
const room=nodePath.join(root,"test/bakgrund/kasinorum-v1/Kasinorum.glb");
files.set("room.glb",room);
const hash=async file=>createHash("sha256").update(await fs.readFile(file)).digest("hex");
if(await hash(room)!=="6c6585a3f853aafd23761ba817f8e5b016d0a29fa36bcb331890d30ae092d73a")throw Error("Fel rumsoriginal.");
const poseHashes=[];
const frozen=new Map();
let appearanceHash;
if(appearanceFile){
  const bytes=await fs.readFile(appearanceFile);
  files.set("avatar.glb",appearanceFile);
  frozen.set(appearanceFile,bytes);
  appearanceHash=createHash("sha256").update(bytes).digest("hex");
}
for(let i=0;i<path.frames.length;i++){
  const key="drag-"+String(i).padStart(2,"0")+".glb", source=nodePath.join(poseDir,key);
  files.set(key,source);
  const bytes=await fs.readFile(source);
  frozen.set(source,bytes);
  poseHashes.push(createHash("sha256").update(bytes).digest("hex"));
}
if(new Set(poseHashes).size!==poseHashes.length)throw Error("Kroppens bildrutor är inte unika.");
const origin="http://paulinadrag.localhost/";
const browser=await chromium.launch({channel:"msedge",headless:true,args:["--enable-unsafe-swiftshader"]});
try{
  const page=await browser.newPage();
  await page.route("**/*",async route=>{
    const url=route.request().url();
    if(url===origin)return route.fulfill({contentType:"text/html",body:'<script type="importmap">{"imports":{"three":"/three.module.js"}}</script>'});
    const file=url.startsWith(origin)&&files.get(url.slice(origin.length));
    if(!file)return route.abort();
    const media={".glb":"model/gltf-binary",".jpg":"image/jpeg",".json":"application/json"};
    return route.fulfill({contentType:media[nodePath.extname(file)]??"text/javascript",body:frozen.get(file)??await fs.readFile(file)});
  });
  await page.goto(origin);
  const pixels=await page.evaluate(async cfg=>{
    const {renderTake}=await import("/test/artefakter/kasinorum-utdrag-100/scen.mjs");
    return renderTake(cfg);
  },config);
  if(config.surfacesOnly || config.posePreview || config.seatPair){
    await fs.mkdir(output,{recursive:true});
    for(const [i,image] of pixels.entries())for(const [view,data] of Object.entries(image)){
      const prefix=config.seatPair ? String(i+1).padStart(2,"0")+"-" : config.posePreview ? [1,17,33][i]+"-" : "";
      await fs.writeFile(nodePath.join(output,prefix+view+".webp"),Buffer.from(data.split(",")[1],"base64"));
    }
    if(config.seatPair){
      if(pixels.length!==33 || pixels.some(frame => Object.keys(frame).length!==4))throw Error("Ofullständigt kamerapar.");
      await fs.writeFile(nodePath.join(output,"tagning.json"),JSON.stringify({take:path.take,poseHashes,appearanceHash,frames:pixels.length,cameras:config.cal.cameras,layout:config.layout},null,2)+"\n");
    }
  }else{
    if(pixels.length!==33)throw Error("Ofullständig tagning.");
    let template=await fs.readFile(nodePath.join(here,"visare.mall.html"),"utf8");
    if (path.shoe.yawDegrees !== -100) {
      const yaw = path.shoe.yawDegrees.toLocaleString("sv-SE", {maximumFractionDigits: 1});
      template = template.replace("100° mot dealern", `kortskons öppning ${yaw}° från spelaraxeln +Z`);
    }
    if(appearanceFile){
      template=template.replace("<h1>Paulinas vänsterhandsutdrag</h1>","<h1>Paulina drar första kortet</h1>")
        .replace("<small>Det rödryggade", "<small>Ansikte, hår, kostym och handryggar från 01 och 03 på den upprätade riggen 08. Det rödryggade")
        .replace('<p><a id="room"', '<p><a href="/?pose=sam-20261119T231348Z-842dd17bd33b%2F1&amp;version=utseende#modellering">Vrid Paulinas 3D-modell</a> · <a href="/bordsprov/paulina-utdrag.html?avatar=rigg">Se tidigare rigg och skoplacering</a> · <a id="room"');
    }
    const roomHtml=nodePath.relative(nodePath.dirname(output),nodePath.join(root,"test/bakgrund/kasinorum-v1/referensvinkel.html")).split(nodePath.sep).join("/");
    template=template.replace("../../bakgrund/kasinorum-v1/referensvinkel.html",roomHtml);
    const html=template.replace("__TAKE__",JSON.stringify({pixels,travelMm:path.frames.at(-1).travel_mm,subdivisions:config.subdivisions,poseHashes,appearanceHash}));
    const previous=await fs.readFile(output,"utf8").catch(e=>{if(e.code!=="ENOENT")throw e;});
    if(previous&&previous!==html)throw Error("Ange en ny utfil för en ändrad tagning.");
    await fs.writeFile(output,html);
  }
  console.log(pixels.length,"rutor,",output);
}finally{
  await browser.close();
}
