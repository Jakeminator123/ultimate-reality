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
  const home = new T.Vector3().fromArray(canvas.dataset.eye ? canvas.dataset.eye.split(",").map(Number) : [1, .13, -1.05]);
  if (canvas.dataset.seat) {
    const placement = canvas.dataset.view === "paulina";
    status.textContent = placement ? "Läser Paulina, bordet och kortskon…" : "Läser bordet och kortskon…";
    const { placeTable } = await import("./bord.mjs");
    // Align the centre seat with the studio view Jakob chose.
    globe.rotation.y = -Math.atan2(home.x, home.z);
    const { seat, table, layout } = await placeTable(scene, renderer, canvas.dataset.seat, placement);
    camera.position.fromArray(seat.eye);
    globe.position.copy(camera.position);
    home.copy(camera.position).sub(new T.Vector3().fromArray(seat.aim));
    camera.fov = seat.fovVertical;
    const panel = document.querySelector("#bordsmaterial");
    if (panel) {
      const { bindTableFinishes } = await import("./materialval.mjs");
      await bindTableFinishes(panel, table, layout, renderer, () => renderer.render(scene, camera));
    }
    const shadowControl = document.querySelector("#kontaktskugga");
    if (shadowControl) {
      const { createContactShadows } = await import("./golv-v2.mjs");
      const shadows = createContactShadows(table);
      table.add(shadows);
      shadows.visible = shadowControl.checked;
      shadowControl.addEventListener("change", () => {
        shadows.visible = shadowControl.checked;
        renderer.render(scene, camera);
      });
      // Match the four downward arrow presses used for the panorama-v1 reference.
      const direction = new T.Spherical().setFromVector3(home);
      direction.phi -= 4 * .14;
      home.setFromSpherical(direction.makeSafe());
    }
  }
  const orbitEye = new T.PerspectiveCamera();
  const controls = new OrbitControls(orbitEye, canvas);
  controls.enableZoom = controls.enablePan = false;
  const render = () => {
    camera.quaternion.copy(orbitEye.quaternion);
    renderer.render(scene, camera);
  };
  const fovControl = document.querySelector("#synfalt");
  if (fovControl) {
    const defaultFov = camera.fov;
    const requested = new URL(location.href).searchParams.get("synfalt");
    fovControl.value = requested === "40" || requested === "75" ? requested : "";
    function setFov() {
      camera.fov = fovControl.value ? Number(fovControl.value) : defaultFov;
      camera.updateProjectionMatrix();
      function updateUrl(href) {
        const url = new URL(href, location.href);
        if (fovControl.value) url.searchParams.set("synfalt", fovControl.value);
        else url.searchParams.delete("synfalt");
        return url;
      }
      for (const link of document.querySelectorAll("nav a, footer a")) link.href = updateUrl(link.href).href;
      history.replaceState(history.state, "", updateUrl(location.href));
      render();
    }
    fovControl.addEventListener("change", setFov);
    setFov();
  }
  controls.addEventListener("change", render);
  function reset() {
    orbitEye.position.copy(home);
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
