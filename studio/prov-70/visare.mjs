import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const element = id => document.getElementById(id);
const canvas = element("scene");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(33, 1, .015, 16);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
scene.background = new THREE.Color(0x34443d);
scene.fog = new THREE.FogExp2(0x34443d, .11);

const target = new THREE.Vector3(0, .65, .14);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(14,14),
  new THREE.MeshStandardMaterial({ color:0x50473c, roughness:.88,
    polygonOffset:true, polygonOffsetFactor:1, polygonOffsetUnits:1 }));
floor.rotation.x=-Math.PI/2;
floor.receiveShadow=true;
scene.add(floor);
scene.add(new THREE.HemisphereLight(0xfff6e8,0xaeb8b1,1.58));
const key=new THREE.DirectionalLight(0xffe5ca,2.15);
key.position.set(-1.6,3.65,2.6);
key.castShadow=true;
key.shadow.mapSize.set(2048,2048);
Object.assign(key.shadow.camera,{left:-1.55,right:1.55,top:1.65,bottom:-1.65,near:.15,far:7.2});
key.shadow.normalBias=.001;
key.shadow.bias=-.00012;
scene.add(key);
const fill=new THREE.DirectionalLight(0xddeaff,.72);
fill.position.set(2,2.15,-1.25);
scene.add(fill);
const timeControl=element("time"), angleControl=element("angle");
let mixer, duration=0, playing=false, started=0, trackTime=0;

function showFrame(time=trackTime, angle=Number(angleControl.value)) {
  trackTime=Math.max(0,Math.min(duration,time));
  if (mixer) mixer.setTime(trackTime);
  const radians=THREE.MathUtils.degToRad(angle);
  camera.position.set(target.x+Math.sin(radians)*2.78,target.y+.56,target.z+Math.cos(radians)*2.78);
  camera.lookAt(target);
  element("degrees").value=angle+"°";
  element("seconds").value=trackTime.toLocaleString("sv-SE",{minimumFractionDigits:2,maximumFractionDigits:2})+" s";
  timeControl.value=trackTime;
  angleControl.value=angle;
  element("front").setAttribute("aria-pressed",String(angle===0));
  element("side").setAttribute("aria-pressed",String(angle===70));
  renderer.render(scene,camera);
}
function setPlaying(state) {
  playing=state;
  started=performance.now()-trackTime*1000;
  element("play").textContent=state?"Pausa":"Spela";
}
function resize() {
  const width=canvas.clientWidth,height=canvas.clientHeight;
  renderer.setSize(width,height,false);
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
  showFrame();
}
function initialView(report) {
  const query = new URLSearchParams(location.search);
  const frame = query.get("ruta")?.trim() ?? "";
  const index = report && /^\d+$/.test(frame) ? report.sourceFrameIndices.indexOf(Number(frame)) : -1;
  const time = index < 0 ? 0 : report.timesSeconds[index];
  const requested = query.get("kamera")?.trim() ?? "";
  const angle = /^[+-]?\d+$/.test(requested) ? Math.max(-90,Math.min(90,Number(requested))) : 0;
  return [time,angle];
}
new ResizeObserver(resize).observe(canvas);
element("angle").addEventListener("input",()=>showFrame());
element("front").addEventListener("click",()=>showFrame(trackTime,0));
element("side").addEventListener("click",()=>showFrame(trackTime,70));
timeControl.addEventListener("input",()=>{setPlaying(false);showFrame(Number(timeControl.value));});
element("play").addEventListener("click",()=>{
  if (trackTime>=duration) showFrame(0);
  setPlaying(!playing);
});
renderer.setAnimationLoop(()=>{
  if (!playing) return;
  const next=(performance.now()-started)/1000;
  showFrame(next);
  if (next>=duration) setPlaying(false);
});

try {
  const response=await fetch("/prov-70/v1/matning.json",{cache:"no-store"});
  if (!response.ok && response.status!==404) throw new Error("Mätningen svarade "+response.status);
  const report=response.ok ? await response.json() : null;
  const modelUrl="/prov-70/v1/"+(report?"modell.glb":"fotoyta.glb");
  const loader=new GLTFLoader();
  const [gltf,table]=await Promise.all([loader.loadAsync(modelUrl),
    report?null:loader.loadAsync("/prov-70/v1/bord-och-stol.glb")]);
  for (const group of [gltf,table]) {
    if (!group) continue;
    group.scene.traverse(obj=>{if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=true;}});
    scene.add(group.scene);
  }
  if (gltf.animations.length) {
    mixer=new THREE.AnimationMixer(gltf.scene);
    const clip=gltf.animations[0];
    duration=clip.duration;
    const action=mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce,1);
    action.clampWhenFinished=true;
    action.play();
    // Scrubbing back from a completed LoopOnce clip must re-enable its track.
    mixer.addEventListener("finished",()=>{action.paused=false;});
    timeControl.max=duration;
    timeControl.disabled=false;
    element("play").disabled=false;
  }
  element("model").href=modelUrl;
  element("model").textContent=report?"Hämta den animerade 3D-scenen":"Hämta sittande Paulina i 3D";
  element("model").download=report?"paulina-blackjack.glb":"paulina-sittande.glb";
  await Promise.all([...document.querySelectorAll("a[data-local]")].map(async link=>{
    const local=await fetch(link.href,{method:"HEAD",cache:"no-store"});
    link.hidden=!local.ok;
  }));
  element("status").textContent=report?
    "Kameran vrids runt samma kropp och bord. 70° visar Paulinas vänstra sida.":
    "Sittande Paulina, sits och filtbord i vila. 70° visar hennes vänstra sida.";
  resize();
  showFrame(...initialView(report));
  canvas.dataset.ready="true";
  window.paulinaTrial={showFrame,duration,report};
} catch (error) {
  element("status").textContent="Scenen kunde inte öppnas. "+error.message;
  canvas.dataset.error=error.message;
}
