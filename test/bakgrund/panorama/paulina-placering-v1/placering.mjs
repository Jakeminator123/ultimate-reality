import { AnimationMixer } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { drawCardAt } from "/bordsprov/rum3d/utdrag.mjs";

// LJUS-05 and this placement study share export E in table coordinates.
const frameIndex = 16;
const fps = 24;
const motionHash = "c05b66757319c3742c8700c637dd6f32939714960b9479c37736c3b48be5577b";
const cardPathHash = "711a8391cdf54fac06c09785f37891438a871be0dbc4206f140037e73c19543e";

async function readVersion(url, expectedHash, label) {
  const response = await fetch(url);
  if (!response.ok) throw Error("Kunde inte läsa " + label + ".");
  const bytes = await response.arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const hash = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== expectedHash) throw Error("Fel version av " + label + " för placeringsprovet.");
  return bytes;
}

export async function loadCardPath() {
  const bytes = await readVersion("/bordsprov/rum3d/bana.json", cardPathHash, "kortbanan");
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function placePaulina(scene, take, drawCard) {
  const bytes = await readVersion("/bordsprov/handljus/pose.glb", motionHash, "Paulinas rigg och kortdrag");
  const model = await new GLTFLoader().parseAsync(bytes, "/bordsprov/handljus/");
  const clip = model.animations[0];
  if (take.take !== "skoriktning-70-30-v1" || !clip || Math.abs(clip.duration - 32 / fps) > .002 ||
      !model.scene.getObjectByProperty("isSkinnedMesh", true)) {
    throw Error("Placeringsprovet kräver Paulinas v2-rigg och 70/30-tagningens 33 poser.");
  }
  model.scene.traverse(mesh => {
    if (mesh.isSkinnedMesh) mesh.frustumCulled = false;
  });
  const mixer = new AnimationMixer(model.scene);
  mixer.clipAction(clip).play();
  mixer.setTime(frameIndex / fps);
  drawCardAt(frameIndex, take, drawCard);
  scene.add(model.scene);
}
