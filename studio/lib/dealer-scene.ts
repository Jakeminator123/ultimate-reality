import * as T from "three";
import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js";
import { Blocking, GRASP, limits } from "./blocking";
import { CARD, dealPose } from "./deal-pose";
import layout from "./table-layout.json";
import shoeLayout from "./card-shoe.json";
import { buildDrawShoe } from "./card-shoe.mjs";

export const seats = [4, 1] as const;
export type Seat = (typeof seats)[number];
const vec = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
const UP = vec(0, 1, 0);
const WIDTH = 960,
  HEIGHT = 540;

export function buildDealerScene(hosts: Record<Seat, HTMLDivElement>) {
  const scene = new T.Scene();
  scene.background = new T.Color("#cad4c9");
  const materials = new Map<string, T.MeshLambertMaterial>();
  const geometry = new Set<T.BufferGeometry>();
  const sphere = new T.SphereGeometry(1, 18, 14);
  const cylinder = new T.CylinderGeometry(1, 1, 1, 14);
  const cube = new T.BoxGeometry(1, 1, 1);
  function mesh(
    g: T.BufferGeometry,
    color: string,
    parent: T.Object3D = scene,
  ) {
    geometry.add(g);
    if (!materials.has(color))
      materials.set(color, new T.MeshLambertMaterial({ color }));
    const m = new T.Mesh(g, materials.get(color));
    parent.add(m);
    return m;
  }
  function solid(
    g: T.BufferGeometry,
    color: string,
    p: T.Vector3,
    scale: T.Vector3,
    parent: T.Object3D = scene,
  ) {
    const m = mesh(g, color, parent);
    m.position.copy(p);
    m.scale.copy(scale);
    return m;
  }
  const oval = (
    color: string,
    p: T.Vector3,
    scale: T.Vector3,
    parent?: T.Object3D,
  ) => solid(sphere, color, p, scale, parent);
  const box = (
    color: string,
    p: T.Vector3,
    scale: T.Vector3,
    parent?: T.Object3D,
  ) => solid(cube, color, p, scale, parent);
  function link(m: T.Mesh, a: T.Vector3, b: T.Vector3, r: number) {
    const delta = b.clone().sub(a);
    m.position.copy(a).lerp(b, 0.5);
    m.scale.set(r, delta.length(), r);
    m.quaternion.setFromUnitVectors(UP, delta.normalize());
  }
  const bone = (
    col: string,
    a: T.Vector3,
    b: T.Vector3,
    r: number,
    parent: T.Object3D = scene,
  ) => {
    const m = mesh(cylinder, col, parent);
    link(m, a, b, r);
    return m;
  };
  const skin = "#dbb68f",
    ivory = "#eeeade",
    vest = "#293f39",
    trim = "#c6a570",
    joint = "#9d8060";
  scene.add(new T.HemisphereLight("#fffbec", "#b9c2ae", 1.7));
  const key = new T.DirectionalLight("#fff2d9", 2.05);
  key.position.set(-1, 2, 1);
  key.castShadow = true;
  Object.assign(key.shadow.camera, {
    left: -0.92,
    right: 0.92,
    top: 0.8,
    bottom: -0.8,
    near: 0.1,
    far: 5,
  });
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.normalBias = 0.0006;
  scene.add(key);
  const rim = new T.DirectionalLight("#c3e3df", 0.8);
  rim.position.set(1, 0.7, -1);
  scene.add(rim);
  // Large floor triangles cross the camera plane. Paint the set behind the
  // rig in the vector fallback, where there is no hardware depth buffer.
  box("#aebdaf", vec(0, -0.75, 0), vec(12, 0.05, 12)).renderOrder = -12;
  box("#8ea397", vec(0, 1, -1.6), vec(10, 4, 0.06)).renderOrder = -11;
  for (let i = -4; i <= 4; i++)
    box(
      "#a9b8aa",
      vec(i * 0.36, 0.52, -1.55),
      vec(0.012, 2.6, 0.018),
    ).renderOrder = -10;
  solid(
    cylinder,
    "#493c30",
    vec(0, -0.055, layout.table.centerZ),
    vec(layout.table.radiusX, 0.09, layout.table.radiusZ),
  ).renderOrder = -5;
  solid(
    cylinder,
    trim,
    vec(0, -0.014, layout.table.centerZ),
    vec(layout.table.radiusX-0.015, 0.012, layout.table.radiusZ-0.015),
  ).renderOrder = -4;
  solid(
    cylinder,
    "#23644f",
    vec(0, -0.005, layout.table.centerZ),
    vec(layout.table.radiusX-0.03, 0.01, layout.table.radiusZ-0.03),
  ).renderOrder = -3;
  const { shoe } = buildDrawShoe(shoeLayout);
  scene.add(shoe);
  // Four corner marks keep the landing point visible under a flat card.
  const target = new T.Group();
  scene.add(target);
  for (const a of [-1, 1])
    for (const b of [-1, 1]) {
      box(
        "#e2bf79",
        vec(a * 0.035, 0.00045, b * 0.05),
        vec(0.019, 0.00035, 0.002),
        target,
      );
      box(
        "#e2bf79",
        vec(a * 0.044, 0.00045, b * 0.043),
        vec(0.002, 0.00035, 0.016),
        target,
      );
    }
  const body = new T.Group();
  scene.add(body);
  oval(vest, vec(0, 0.22, -0.37), vec(0.142, 0.173, 0.088), body);
  oval(ivory, vec(0, 0.304, -0.315), vec(0.068, 0.088, 0.047), body);
  solid(cylinder, skin, vec(0, 0.391, -0.355), vec(0.036, 0.07, 0.036), body);
  oval(skin, vec(0, 0.48, -0.35), vec(0.076, 0.098, 0.074), body);
  oval("#5d4940", vec(0, 0.546, -0.36), vec(0.074, 0.04, 0.071), body);
  oval(skin, vec(0, 0.478, -0.28), vec(0.015, 0.019, 0.015), body);
  for (const side of [-1, 1]) {
    oval(
      "#403c34",
      vec(side * 0.028, 0.501, -0.284),
      vec(0.006, 0.006, 0.004),
      body,
    );
    oval(vest, vec(side * 0.018, 0.369, -0.292), vec(0.022, 0.012, 0.01), body);
  }
  box("#42514b", vec(0, 0.15, -0.505), vec(0.32, 0.32, 0.04)).renderOrder = -8;
  box("#42514b", vec(layout.dealerSeat.x, layout.dealerSeat.y, layout.dealerSeat.z), vec(0.32, 0.045, 0.27)).renderOrder = -8;
  for (const x of [-0.077, 0.077]) {
    bone(vest, vec(x, -0.14, -0.38), vec(x, -0.22, -0.17), 0.06).renderOrder =
      -7;
    bone(vest, vec(x, -0.22, -0.17), vec(x, -0.61, -0.19), 0.045).renderOrder =
      -7;
  }
  // The resting hand and working arm are distinct limbs on the same figure.
  const fixedElbow = vec(0.21, 0.089, -0.28);
  const restingUpper = mesh(cylinder, ivory);
  for (const x of [-0.14, 0.14]) {
    bone(
      ivory,
      vec(x * 0.55, 0.323, -0.348),
      vec(x, 0.335, -0.345),
      0.037,
      body,
    );
    oval(ivory, vec(x, 0.335, -0.345), vec(0.036, 0.037, 0.036), body);
  }
  const leftForearm = mesh(cylinder, ivory);
  const leftHand = new T.Group();
  scene.add(leftHand);
  oval(skin, vec(0, 0.022, -0.049), vec(0.032, 0.016, 0.044), leftHand);
  for (let i = 0; i < 4; i++)
    oval(skin, vec((i - 1) * 0.012, 0.006, -0.012), vec(0.0055, 0.006, 0.022), leftHand);
  const upper = mesh(cylinder, ivory),
    fore = mesh(cylinder, ivory);
  const elbowJoint = mesh(sphere, joint),
    shoulderJoint = mesh(sphere, ivory),
    palm = mesh(sphere, skin);
  const digits = Array.from({ length: 5 }, (_, i) => ({
    proximal: mesh(cylinder, skin),
    distal: mesh(cylinder, i === 0 ? "#c58355" : i === 1 ? "#6390b4" : skin),
    knuckle: mesh(sphere, skin),
    tip: mesh(sphere, i === 0 ? "#ba612c" : i === 1 ? "#396da0" : skin),
  }));
  const card = new T.Group();
  scene.add(card);
  box(
    "#f6f2dc",
    vec(0, 0, 0),
    vec(CARD.width, CARD.thickness, CARD.depth),
    card,
  );
  const face = new T.Group();
  card.add(face);
  const back = box("#873c3a", vec(0, CARD.thickness / 2 + 0.00009, 0),
    vec(CARD.width - 0.004, 0.00014, CARD.depth - 0.004), card);
  const diamond = (x: number, z: number, size: number) => {
    const m = box(
      "#a32f29",
      vec(x, CARD.thickness / 2 + 0.00009, z),
      vec(size, 0.00014, size),
      face,
    );
    m.rotation.y = Math.PI / 4;
  };
  diamond(0, 0, 0.017);
  diamond(-0.021, -0.032, 0.006);
  diamond(0.021, 0.032, 0.006);

  const cameras = {
    4: new T.PerspectiveCamera(),
    1: new T.PerspectiveCamera(),
  };
  for (const seat of seats) cameras[seat].position.fromArray(layout.eyes[seat]);
  let gpu: T.WebGLRenderer | undefined;
  let fallback: SVGRenderer | undefined;
  try {
    gpu = new T.WebGLRenderer({ antialias: true, alpha: false });
    gpu.setSize(WIDTH, HEIGHT, false);
    gpu.shadowMap.enabled = true;
    scene.traverse((object) => {
      if (object instanceof T.Mesh) {
        object.castShadow =
          object.position.lengthSq() === 0 ||
          Math.max(object.scale.x, object.scale.y, object.scale.z) < 0.65;
        object.receiveShadow = true;
      }
    });
  } catch {
    fallback = new SVGRenderer();
    fallback.setSize(WIDTH, HEIGHT);
  }
  const canvases = {} as Record<Seat, HTMLCanvasElement>;
  for (const seat of seats) {
    if (gpu) {
      const canvas = document.createElement("canvas");
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      hosts[seat].replaceChildren(canvas);
      canvases[seat] = canvas;
    }
  }
  function draw(s: Blocking, close: boolean) {
    const p = dealPose(s);
    body.position.z = p.lean;
    target.position.copy(p.target);
    card.position.copy(p.center);
    card.rotation.set(p.tilt, p.yaw, 0, "YXZ");
    back.visible = s.frame < GRASP;
    face.visible = !back.visible;
    leftHand.position.copy(p.leftTip);
    leftHand.rotation.set(p.leftPitch, Math.atan2(p.leftDirection.x, p.leftDirection.z), 0, "YXZ");
    link(leftForearm, fixedElbow, leftHand.localToWorld(vec(0, 0.027, -0.08)), 0.028);
    link(restingUpper, vec(0.14, 0.335, -0.35 + p.lean), fixedElbow, 0.036);
    link(upper, p.shoulder, p.elbow, 0.038);
    link(fore, p.elbow, p.wrist, 0.028);
    elbowJoint.position.copy(p.elbow);
    elbowJoint.scale.setScalar(0.034);
    shoulderJoint.position.copy(p.shoulder);
    shoulderJoint.scale.setScalar(0.04);
    palm.position.copy(p.palm);
    palm.scale.set(0.029, 0.019, 0.054);
    digits.forEach((d, i) => {
      let base: T.Vector3, mid: T.Vector3, end: T.Vector3;
      if (i === 0) {
        base = p.palm.clone().add(vec(0.022, 0.004, 0.002));
        end = p.thumb;
        mid = end.clone().add(vec(0.022, 0.02, -0.015));
      } else if (i === 1) {
        base = p.palm.clone().add(vec(0.012, 0, 0.035));
        end = p.index;
        mid = end.clone().add(vec(0.003, -0.001, -0.027));
        mid.y = Math.max(0.0065, mid.y);
      } else {
        const dx = 0.01 - (i - 1) * 0.012;
        base = p.palm.clone().add(vec(dx, 0, 0.028));
        mid = base.clone().add(vec(-0.003, -0.004, 0.027));
        end = mid.clone().add(vec(-0.004, -0.012, 0.008));
      }
      const radius = i === 0 ? 0.008 : 0.007;
      link(d.proximal, base, mid, radius);
      link(d.distal, mid, end, radius);
      d.knuckle.position.copy(mid);
      d.knuckle.scale.setScalar(radius);
      d.tip.position.copy(end);
      d.tip.scale.setScalar(radius);
    });
    for (const seat of seats) {
      const cam = cameras[seat];
      cam.aspect = WIDTH / HEIGHT;
      cam.near = 0.02;
      cam.far = 10;
      cam.fov = close ? 10 : 36;
      cam.lookAt(
        close ? p.thumb.clone().lerp(p.index, 0.5) : vec(-0.025, 0.22, -0.145),
      );
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      const host = hosts[seat];
      if (gpu) {
        gpu.render(scene, cam);
        canvases[seat].getContext("2d")!.drawImage(gpu.domElement, 0, 0);
      } else if (fallback) {
        fallback.render(scene, cam);
        const svg = fallback.domElement.cloneNode(true) as SVGElement;
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        host.replaceChildren(svg);
      }
      host.dataset.frame = String(s.frame + 1);
      host.dataset.renderer = gpu ? "webgl" : "svg";
    }
  }
  function tablePoint(seat: Seat, x: number, y: number) {
    const ray = new T.Raycaster();
    ray.setFromCamera(new T.Vector2(x, y), cameras[seat]);
    const hit = ray.ray.intersectPlane(new T.Plane(UP, 0), new T.Vector3());
    if (!hit || (hit.x / (layout.table.radiusX-0.03)) ** 2 + ((hit.z-layout.table.centerZ) / (layout.table.radiusZ-0.03)) ** 2 > 1)
      return null;
    const clamp = (v: number, [min, max]: [number, number]) =>
      Math.max(min, Math.min(max, Math.round(v * 100)));
    return {
      landingXcm: clamp(hit.x, limits.landingXcm),
      landingZcm: clamp(hit.z, limits.landingZcm),
    };
  }
  async function image(seat: Seat): Promise<string> {
    if (gpu) return canvases[seat].toDataURL("image/png");
    const markup = new XMLSerializer().serializeToString(
      hosts[seat].firstElementChild!,
    );
    const url = URL.createObjectURL(
      new Blob([markup], { type: "image/svg+xml" }),
    );
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = WIDTH;
      c.height = HEIGHT;
      c.getContext("2d")!.drawImage(img, 0, 0, WIDTH, HEIGHT);
      return c.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return {
    draw,
    tablePoint,
    image,
    dispose() {
      for (const seat of seats) hosts[seat].replaceChildren();
      for (const g of geometry) g.dispose();
      for (const m of materials.values()) m.dispose();
      const shoeMaterials = new Set<T.Material>();
      shoe.traverse((child: T.Object3D) => {
        if (child instanceof T.Mesh) {
          child.geometry.dispose();
          for (const m of Array.isArray(child.material) ? child.material : [child.material]) shoeMaterials.add(m);
        }
      });
      for (const m of shoeMaterials) {
        if (m instanceof T.MeshStandardMaterial) m.map?.dispose();
        m.dispose();
      }
      gpu?.dispose();
      gpu?.forceContextLoss();
    },
  };
}
