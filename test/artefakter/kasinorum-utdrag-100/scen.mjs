import * as T from "three";
import {GLTFLoader} from "/addons/loaders/GLTFLoader.js";
import {buildTable, textiles} from "../../bord/filtdjup-v1/bord.mjs";
import {buildDrawShoe} from "../../../studio/lib/card-shoe.mjs";
import {applyTableMaterials} from "../../bord/polyhaven-material-v1/material.mjs";
import {loadAppearance} from "./avatarutseende.mjs";

export async function renderTake({path, layout, original, cal, subdivisions, surfacesOnly, posePreview, appearance, wholeTableOnly = false, seatPair = false}) {
  const renderer = new T.WebGLRenderer({antialias:true});
  const width=wholeTableOnly?960:1280, height=720;
  renderer.setSize(width,height,false);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.05;
  const scene=new T.Scene();
  scene.background=new T.Color(0x282822);
  scene.add(new T.HemisphereLight(0xf4f4ed,0xaeaa98,1.05));
  const key=new T.DirectionalLight(0xffefda,1.75);
  key.position.set(-1.3,2.45,1.05);
  key.castShadow=true;
  Object.assign(key.shadow.camera,{left:-2.45,right:2.45,top:2.45,bottom:-2.45,near:.1,far:9});
  key.shadow.mapSize.set(2048,2048);
  key.shadow.normalBias=.001;
  key.shadow.bias=-.00012;
  scene.add(key);
  const loader=new GLTFLoader();
  const imported=await loader.loadAsync("/room.glb");
  imported.scene.traverse(obj=>{if(obj.isMesh)obj.receiveShadow=true;});
  scene.add(imported.scene);
  const reflections=new T.WebGLCubeRenderTarget(128,{type:T.HalfFloatType});
  const probe=new T.CubeCamera(.02,25,reflections);
  probe.position.set(0,.10,0);
  probe.update(renderer,scene);
  const pmrem=new T.PMREMGenerator(renderer), env=pmrem.fromCubemap(reflections.texture);
  scene.environment=env.texture;
  scene.environmentIntensity=.48;
  const largeTable=buildTable(layout,false,textiles(layout));
  const oldTable=buildTable(original,false,textiles(original));
  const plainTable=buildTable(layout,false,textiles(layout));
  const plainOldTable=buildTable(original,false,textiles(original));
  await applyTableMaterials(largeTable,layout,"/test/bord/polyhaven-material-v1/");
  await applyTableMaterials(oldTable,original,"/test/bord/polyhaven-material-v1/");
  scene.add(largeTable,oldTable,plainTable,plainOldTable);
  oldTable.visible=false;
  plainTable.visible=plainOldTable.visible=false;
  scene.updateMatrixWorld(true);
  for(const [table,expectedWidth,expectedDepth] of [[largeTable,1.92,1.296],[oldTable,1.60,1.08]]){
    const size=new T.Box3().setFromObject(table,true).getSize(new T.Vector3());
    if(Math.abs(size.x-expectedWidth)>1e-5 || Math.abs(size.z-expectedDepth)>1e-5)throw Error("Fel yttermått på bordet.");
  }
  const {shoe,draw}=buildDrawShoe(path.shoe);
  scene.add(shoe);
  const support=new T.Mesh(new T.BoxGeometry(.32,.045,.27), new T.MeshStandardMaterial({color:0x3b4b45,roughness:.9}));
  support.position.set(layout.dealerSeat.x,cal.floorY+.406-.045/2,layout.dealerSeat.z);
  scene.add(support);
  const detail=new T.Vector3(...path.mouth_xyz_m).addScaledVector(new T.Vector3(...path.outward_xyz),.05);
  detail.y=.051;
  const cameras={};
  for(const id of [4,1]){
    const ref=cal.cameras[id];
    for(const view of ["bord","hand"]){
      const cam=new T.PerspectiveCamera(view==="bord"?ref.fovVertical:12,16/9,.02,20);
      cam.position.fromArray(ref.eye);
      cam.lookAt(view==="bord"?new T.Vector3(...ref.aim):detail);
      cam.updateMatrixWorld();
      cameras[id+"-"+view]=cam;
    }
    const surfaceCam=new T.PerspectiveCamera(16,16/9,.02,20);
    surfaceCam.position.fromArray(ref.eye);
    surfaceCam.lookAt(-.48,-.006,.633);
    surfaceCam.updateMatrixWorld();
    cameras[id+"-material"]=surfaceCam;
  }
  const top=new T.OrthographicCamera(-.49,.49,.275625,-.275625,.02,4);
  top.position.set(.16,1.6,-.235);
  top.up.set(0,0,-1);
  top.lookAt(.16,0,-.235);
  cameras.topp=top;
  if(wholeTableOnly){
    const halfHeight=layout.table.radiusZ+.22;
    const halfWidth=halfHeight*width/height;
    const centerZ=layout.table.centerZ-.10;
    const plan=new T.OrthographicCamera(-halfWidth,halfWidth,halfHeight,-halfHeight,.02,4);
    plan.position.set(0,1.8,centerZ);
    plan.up.set(0,0,-1);
    plan.lookAt(0,0,centerZ);
    cameras.helbord=plan;
    imported.scene.visible=false;
    scene.background=new T.Color(0x39413f);
  }
  const arrow=new T.ArrowHelper(new T.Vector3(0,0,1),new T.Vector3(.058,.035,.052),.10,0xffd15a,.019,.014);
  shoe.add(arrow);
  const bodyMaterial=new T.MeshStandardMaterial({color:0xc0d2ce,roughness:.9,side:T.DoubleSide});
  const avatar=appearance ? await loadAppearance(loader) : null;
  // Bake each source mesh into world metres before interpolating. Rendering
  // and collision QA use the same three quarter-steps between each pose pair.
  const poses=[];
  let body;
  for(let index=0;index<path.frames.length;index++){
    const pose=(await loader.loadAsync("/drag-"+String(index).padStart(2,"0")+".glb")).scene;
    pose.updateMatrixWorld(true);
    const sources=[];
    pose.traverse(obj=>{
      if(!obj.isMesh)return;
      const g=obj.geometry.clone().applyMatrix4(obj.matrixWorld);
      sources.push(g);
    });
    if(avatar && sources.length!==1)throw Error("Utdragets SAM-kropp ska vara ett enda sammanhängande mesh.");
    const pieces=avatar ? avatar.pieces(sources[0]) : sources;
    if(!body){
      body=new T.Group();
      for(const [part,piece] of pieces.entries()){
        const m=new T.Mesh(piece.clone(),avatar ? avatar.materials[part] : bodyMaterial);
        m.castShadow=m.receiveShadow=true;
        m.frustumCulled=false;
        body.add(m);
      }
      scene.add(body);
    }
    if(pieces.length!==body.children.length)throw Error("Olika antal kroppsdelar mellan rutorna.");
    pieces.forEach((g,i)=>{
      const baseline=body.children[i].geometry, order=baseline.index?.array, candidate=g.index?.array;
      if(g.attributes.position.count!==baseline.attributes.position.count ||
         order?.length!==candidate?.length || order?.some((x,j)=>x!==candidate[j]))throw Error("Olika meshtopologi i poserna.");
    });
    poses.push(pieces);
  }
  const pixels=[];
  const last=path.frames.length-1;
  for(let f=0;f<=last*subdivisions;f++){
    if(surfacesOnly&&f>0)break;
    if(posePreview && ![0,last*subdivisions/2,last*subdivisions].includes(f))continue;
    const i=Math.floor(f/subdivisions), next=Math.min(i+1,last), t=f/subdivisions-i;
    body.children.forEach((m,j)=>{
      const dst=m.geometry.attributes.position, a=poses[i][j].attributes.position.array, b=poses[next][j].attributes.position.array;
      for(let k=0;k<a.length;k++)dst.array[k]=a[k]+(b[k]-a[k])*t;
      dst.needsUpdate=true;
      m.geometry.computeVertexNormals();
    });
    const a=path.frames[i].card_curve_zy_m, b=path.frames[next].card_curve_zy_m;
    draw(a.map(([z,y],k)=>[T.MathUtils.lerp(z,b[k][0],t),T.MathUtils.lerp(y,b[k][1],t)]));
    const shot={};
    for (const [name, camera] of Object.entries(cameras)){
      if(wholeTableOnly && name!=="helbord")continue;
      if((seatPair || (appearance && posePreview && !wholeTableOnly)) && !name.endsWith("-bord") && !name.endsWith("-hand"))continue;
      if (name.endsWith("-material") && f>0)continue;
      arrow.visible=name==="topp";
      renderer.render(scene,camera);
      shot[name]=renderer.domElement.toDataURL("image/webp",.88);
      if(seatPair || wholeTableOnly || (appearance && posePreview))continue;
      if(name!=="topp"){
        largeTable.visible=false;plainTable.visible=true;
        renderer.render(scene,camera);
        shot[name+"-skiss"]=renderer.domElement.toDataURL("image/webp",.88);
        plainTable.visible=false;largeTable.visible=true;
      }
      if(name.endsWith("-bord")){
        oldTable.visible=true;largeTable.visible=false;
        renderer.render(scene,camera);
        shot[name+"-original"]=renderer.domElement.toDataURL("image/webp",.88);
        oldTable.visible=false;plainOldTable.visible=true;
        renderer.render(scene,camera);
        shot[name+"-original-skiss"]=renderer.domElement.toDataURL("image/webp",.88);
        plainOldTable.visible=false;largeTable.visible=true;
      }
    }
    pixels.push(shot);
  }
  reflections.dispose();
  env.dispose();
  pmrem.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return pixels;
}
