import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HDRLoader } from "./HDRLoader.js";

const status = document.querySelector("#status");
async function start() {
  const canvas = document.querySelector("#panorama");
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  const camera = new T.PerspectiveCamera(63, 1, .01, 20);
  const scene = new T.Scene();
  const photo = await new HDRLoader().loadAsync(new URL("studio.hdr", import.meta.url).href);
  const geometry = new T.SphereGeometry(6, 96, 64).scale(-1, 1, 1);
  const globe = new T.Mesh(geometry, new T.MeshBasicMaterial({ map: photo }));
  scene.add(globe);
  const orbitEye = new T.PerspectiveCamera();
  const controls = new OrbitControls(orbitEye, canvas);
  controls.enableZoom = controls.enablePan = false;
  const render = () => {
    camera.quaternion.copy(orbitEye.quaternion);
    renderer.render(scene, camera);
  };
  controls.addEventListener("change", render);
  function reset() {
    orbitEye.position.set(1, .13, -1.05);
    controls.update();
  }
  function turn(yaw, pitch = 0) {
    const direction = new T.Spherical().setFromVector3(orbitEye.position);
    direction.theta += yaw;
    direction.phi += pitch;
    orbitEye.position.setFromSpherical(direction.makeSafe());
    controls.update();
  }
  document.querySelector("#left").onclick = () => turn(Math.PI / 4);
  document.querySelector("#right").onclick = () => turn(-Math.PI / 4);
  document.querySelector("#reset").onclick = reset;
  canvas.addEventListener("keydown", event => {
    const delta = { ArrowLeft:[.18,0], ArrowRight:[-.18,0], ArrowUp:[0,.14], ArrowDown:[0,-.14] }[event.key];
    if (delta) { event.preventDefault(); turn(...delta); }
  });
  const size = () => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    render();
  };
  reset();
  new ResizeObserver(size).observe(canvas);
  size();
  canvas.dataset.ready = "true";
  status.textContent = "";
}
start().catch(error => { status.textContent = "Panoramat kunde inte visas. " + error.message; });
