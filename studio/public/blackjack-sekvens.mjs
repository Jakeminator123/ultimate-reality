import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "/bordsprov/panorama/gothic-manor/HDRLoader.js";
import { placeTable } from "/bordsprov/panorama/gothic-manor/bord.mjs";
import { applyDealerFaceLight } from "/bordsprov/panorama/gothic-manor/dealer-face-light.mjs";

const el = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const meshes = root => {
  const result = [];
  root.traverse(item => { if (item.isMesh) result.push(item); });
  return result;
};

function mirroredPrintUV(geometry) {
  const uv = geometry.getAttribute("uv");
  for (let i=0; i<(geometry.index?.count ?? uv.count); i+=3) {
    const [a,b,c] = [i,i+1,i+2].map(index => geometry.index?.getX(index) ?? index);
    const winding = (uv.getX(b)-uv.getX(a))*(uv.getY(c)-uv.getY(a))
                  - (uv.getY(b)-uv.getY(a))*(uv.getX(c)-uv.getX(a));
    if (Math.abs(winding)>=1e-10) return winding>0;
  }
  return false;
}

function faceTexture(code) {
  const rank = code.slice(0,-1), suit = code.at(-1);
  const symbol = { S:"♠", H:"♥", D:"♦", C:"♣" }[suit];
  if (!symbol || !/^(?:[2-9]|10|[AJQK])$/.test(rank)) throw Error("Kortets valör saknar tryck.");
  const sheet = document.createElement("canvas");
  sheet.width = 252; sheet.height = 356;
  const ctx = sheet.getContext("2d");
  ctx.fillStyle = "#fff8e5"; ctx.fillRect(0,0,252,356);
  ctx.fillStyle = suit === "H" || suit === "D" ? "#a62532" : "#221e23";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  function corner() {
    ctx.font = "bold 35px Arial"; ctx.fillText(rank,27,28);
    ctx.font = "31px 'Segoe UI Symbol', sans-serif"; ctx.fillText(symbol,27,60);
  }
  corner(); ctx.save(); ctx.translate(252,356); ctx.rotate(Math.PI); corner(); ctx.restore();
  const positions = {
    A:[[0,0]], 2:[[0,-1],[0,1]], 3:[[0,-1],[0,0],[0,1]],
    4:[[-1,-1],[1,-1],[-1,1],[1,1]], 5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],
    6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]],
    7:[[-1,-1],[1,-1],[0,-.5],[-1,0],[1,0],[-1,1],[1,1]],
    8:[[-1,-1],[1,-1],[0,-.5],[-1,0],[1,0],[0,.5],[-1,1],[1,1]],
    9:[[-1,-1],[1,-1],[-1,-.35],[1,-.35],[0,0],[-1,.35],[1,.35],[-1,1],[1,1]],
    10:[[-1,-1],[1,-1],[0,-.67],[-1,-.33],[1,-.33],[-1,.33],[1,.33],[0,.67],[-1,1],[1,1]],
  };
  if (positions[rank]) {
    ctx.font = (rank === "A" ? "105" : "46") + "px 'Segoe UI Symbol', sans-serif";
    for (const [x,y] of positions[rank]) {
      ctx.save(); ctx.translate(126+42*x,178+104*y);
      if (y>0) ctx.rotate(Math.PI);
      ctx.fillText(symbol,0,0); ctx.restore();
    }
  } else {
    ctx.font = "bold 96px Georgia"; ctx.fillText(rank,126,147);
    ctx.font = "67px 'Segoe UI Symbol', sans-serif"; ctx.fillText(symbol,126,227);
  }
  const texture = new T.CanvasTexture(sheet);
  texture.colorSpace = T.SRGBColorSpace;
  texture.flipY = false; // Match the signed GLB front-face UVs.
  return texture;
}

async function loadMotion(step, loader) {
  const model = await loader.loadAsync(step.motionUrl);
  const extras = model.parser.json.asset.extras;
  const clip = model.animations.find(item => item.name === step.take);
  if (!clip || Math.round(clip.duration*step.fps) !== step.frames-1 ||
      extras.geometrySHA256 !== step.geometry || extras.card !== step.card) throw Error("Rörelsen avviker från givens kvitto.");
  const nodes = model.parser.json.nodes;
  const cardIndex = nodes.findIndex(node => node.mesh !== undefined && node.name?.startsWith(step.card + " ·"));
  if (cardIndex < 0) throw Error("Givens separata kort saknas i modellen.");
  const card = await model.parser.getDependency("node",cardIndex);
  card.visible = false;
  applyDealerFaceLight(model);
  model.scene.traverse(item => { if (item.isSkinnedMesh) item.frustumCulled = false; });
  const mixer = new T.AnimationMixer(model.scene);
  const action = mixer.clipAction(clip).setLoop(T.LoopOnce,1);
  action.clampWhenFinished = true; action.play();
  return {
    root:model.scene, card, parts:meshes(card), face:extras.cardFace,
    sample(frame) {
      action.paused = false;
      mixer.setTime(Math.min(frame/step.fps,clip.duration));
      model.scene.updateMatrixWorld(true);
    },
  };
}

function copyPose(instance, layer) {
  const { body, card, parts } = instance;
  body.card.matrixWorld.decompose(card.position,card.quaternion,card.scale);
  card.position.y += layer;
  for (let i=0;i<parts.length;i++) {
    const weights = body.parts[i].morphTargetInfluences;
    if (weights) for (let k=0;k<weights.length;k++) parts[i].morphTargetInfluences[k] = weights[k];
  }
  card.updateMatrixWorld(true);
}

let inspector;
// Verification reads the transforms of the objects actually attached to the renderer.
export function readPlaybackState() { return inspector?.(); }

async function start() {
  const response = await fetch("/api/blackjack-sequence?" + new URLSearchParams({
    dealer:params.get("dealer") ?? "paulina", id:params.get("id") ?? "",
  }));
  const payload = await response.json();
  if (!response.ok) throw Error(payload.error ?? "Sekvensen kunde inte läsas.");
  const sequence = payload.sequence;
  el("name").textContent = sequence.name;
  const canvas = el("scene");
  const renderer = new T.WebGLRenderer({ canvas, antialias:true });
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  const scene = new T.Scene();
  const image = await new HDRLoader().loadAsync("/bordsprov/panorama/gothic-manor/studio.hdr");
  const globe = new T.Mesh(new T.SphereGeometry(6,96,64).scale(-1,1,1),new T.MeshBasicMaterial({map:image}));
  const direction = canvas.dataset.roomEye.split(",").map(Number);
  globe.rotation.y = -Math.atan2(direction[0],direction[2]);
  scene.add(globe);
  const { cameras } = await placeTable(scene,renderer,"4","sequence");
  const loader = new GLTFLoader(), motions = new Map(), layerHeights = new Map(), instances = [];
  for (const step of sequence.steps) {
    if (!motions.has(step.motion)) motions.set(step.motion,await loadMotion(step,loader));
    const body = motions.get(step.motion);
    const card = body.card.clone(true), parts = meshes(card);
    const front = parts.find(part => part.material.name?.includes("värdetryck"));
    if (step.face || (step.card === "KORT-02" && front?.material.map)) {
      if (!front) throw Error("Givens separata värdesida kunde inte identifieras.");
      front.material = front.material.clone();
      const print = step.face ? faceTexture(step.face) : front.material.map.clone();
      // KORT-02's front primitive uses the back's UV order. Preserve the master artwork.
      if (mirroredPrintUV(front.geometry)) {
        print.offset.x += print.repeat.x;
        print.repeat.x *= -1;
      }
      print.anisotropy = renderer.capabilities.getMaxAnisotropy();
      print.needsUpdate = true;
      front.material.map = print;
      front.material.needsUpdate = true;
    }
    const layer = layerHeights.get(step.targetSeat) ?? 0;
    const instance = { step,body,card,parts,layer,face:step.face ?? body.face ?? step.card };
    body.sample(step.landingFrame);
    copyPose(instance,layer);
    instance.landedMatrix = card.matrixWorld.clone();
    instance.landedWeights = parts.map(part => part.morphTargetInfluences?.slice());
    const box = new T.Box3().setFromObject(card,true);
    layerHeights.set(step.targetSeat,layer+box.max.y-box.min.y);
    instances.push(instance);
    card.visible = false; scene.add(card);
  }

  const camera = new T.PerspectiveCamera(48,16/9,.018,25);
  const cardCenter = new T.Vector3(), cardBox = new T.Box3();
  let active, frame = 0, tick = null, seat = params.get("stol") === "1" ? "1" : "4";
  function render() {
    camera.clearViewOffset();
    if (el("detail").checked && active) {
      camera.updateMatrixWorld(true);
      cardBox.setFromObject(active.card,true).getCenter(cardCenter).project(camera);
      const width = canvas.clientWidth, height = canvas.clientHeight;
      const cropWidth = width/10, cropHeight = height/10;
      const left = T.MathUtils.clamp((cardCenter.x+1)*width/2-cropWidth/2,0,width-cropWidth);
      const top = T.MathUtils.clamp((1-cardCenter.y)*height/2-cropHeight/2,0,height-cropHeight);
      camera.setViewOffset(width,height,left,top,cropWidth,cropHeight);
    }
    renderer.render(scene,camera);
  }
  function changeSeat(value) {
    seat = value; el("seat").value = seat;
    const calibration = cameras[seat];
    camera.position.fromArray(calibration.eye); camera.lookAt(...calibration.aim);
    camera.fov = calibration.fovVertical; camera.updateProjectionMatrix();
    globe.position.copy(camera.position);
    render();
  }
  function show(next) {
    frame = Math.max(0,Math.min(sequence.frames-1,next));
    const selected = instances.find(entry => frame <= entry.step.lastFrame);
    if (active !== selected) {
      if (active) scene.remove(active.body.root);
      active = selected; scene.add(active.body.root);
    }
    active.body.sample(frame-active.step.firstFrame);
    let placed = 0;
    for (const entry of instances) {
      const local = frame-entry.step.firstFrame;
      const visible = local>=0;
      entry.card.visible = visible;
      if (!visible) continue;
      if (local>=entry.step.landingFrame) {
        placed++;
        if (!entry.frozen) {
          entry.landedMatrix.decompose(entry.card.position,entry.card.quaternion,entry.card.scale);
          entry.parts.forEach((part,i) => {
            if (entry.landedWeights[i]) part.morphTargetInfluences.splice(0,part.morphTargetInfluences.length,...entry.landedWeights[i]);
          });
          entry.card.updateMatrixWorld(true);
          entry.frozen = true;
        }
      } else {
        // The next card climbs by the thickness of the cards already on this spot.
        const approach = T.MathUtils.smoothstep(local,Math.max(0,entry.step.landingFrame-4),entry.step.landingFrame);
        copyPose(entry,entry.layer * approach);
        entry.frozen = false;
      }
    }
    el("cards").textContent = placed + " lagda kort · Giv " + active.step.cardInstance + " av " + instances.length;
    el("frame").value = String(frame); el("number").value = String(frame);
    render();
  }
  const seconds = n => {
    const step = instances.find(entry => n<=entry.step.lastFrame).step;
    return step.startSeconds+(n-step.firstFrame)/step.fps;
  };
  function pause() {
    if (tick !== null) cancelAnimationFrame(tick);
    tick=null; el("play").textContent="Spela";
  }
  function seek(n) { if (Number.isInteger(n)) { pause(); show(n); } }
  el("play").onclick = () => {
    if (tick !== null) { pause();return; }
    if (frame === sequence.frames-1) show(0);
    const since = performance.now(), origin = seconds(frame);
    el("play").textContent="Pausa";
    function advance(now) {
      const t=origin+(now-since)/1000;
      if (t>=sequence.durationSeconds) { show(sequence.frames-1);pause();return; }
      const step = instances.findLast(entry => t>=entry.step.startSeconds).step;
      const n = Math.min(step.lastFrame,step.firstFrame+Math.floor((t-step.startSeconds)*step.fps));
      if (frame!==n) show(n);
      tick = requestAnimationFrame(advance);
    }
    tick=requestAnimationFrame(advance);
  };
  for (const entry of instances) {
    const button = document.createElement("button");
    button.textContent = "Landning " + entry.step.cardInstance + " · plats " + entry.step.targetSeat;
    button.onclick = () => seek(entry.step.firstFrame+entry.step.landingFrame);
    el("landings").append(button);
  }
  for (const key of ["frame","number"]) el(key).max=String(sequence.frames-1);
  el("frame").oninput=event=>seek(event.target.valueAsNumber);
  el("number").onchange=event=>seek(event.target.valueAsNumber);
  el("last").textContent="/ " + (sequence.frames-1);
  el("seat").onchange=event=>changeSeat(event.target.value);
  el("detail").onchange=render;
  const resize = () => {
    renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);
    camera.aspect=canvas.clientWidth/canvas.clientHeight; camera.updateProjectionMatrix();
    render();
  };
  new ResizeObserver(resize).observe(canvas);
  document.addEventListener("visibilitychange",()=>{ if(document.hidden) pause(); });
  window.addEventListener("pagehide",pause);
  inspector=()=>({
    frame,seat,take:active.step.take,localFrame:frame-active.step.firstFrame,
    bodies:[...motions.values()].filter(model=>model.root.parent===scene&&model.root.visible).length,
    activeJoints:Object.fromEntries(["l_wrist","r_wrist","c_head"].flatMap(name=>{
      const joint=active.body.root.getObjectByName(name);
      return joint?[[name,joint.getWorldPosition(new T.Vector3()).toArray()]]:[];
    })),
    sourceCardPosition:active.body.card.getWorldPosition(new T.Vector3()).toArray(),
    visibleCards:instances.filter(entry=>entry.card.visible).map(entry=>({
      instance:entry.step.cardInstance,uuid:entry.card.uuid,face:entry.face,layer:entry.layer,
      position:entry.card.position.toArray(),rotation:entry.card.quaternion.toArray(),
      morph:entry.parts[0].morphTargetInfluences?.slice(),frontMaterial:entry.parts.find(p=>p.material.name?.includes("värdetryck"))?.material.uuid,
    })),
  });
  changeSeat(seat); resize();
  const initial = Number(params.get("ruta")); show(Number.isInteger(initial)?initial:0);
  el("player").disabled=false; el("status").textContent="";
}
start().catch(error=>{ el("status").textContent="Sekvensen kunde inte spelas. " + error.message; });
