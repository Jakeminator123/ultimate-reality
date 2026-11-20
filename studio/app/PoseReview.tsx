"use client";
import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { resultUrl, type SamPose, type PoseVersion as Version } from "../lib/modeling";

const poseJoints = [["l_lowarm", "Vänster armbåge"], ["r_lowarm", "Höger armbåge"],
  ["l_index1", "Vänster pekfinger"], ["l_middle1", "Vänster långfinger"],
  ["r_index1", "Höger pekfinger"], ["r_middle1", "Höger långfinger"]] as const;
type Viewport = {
  changePose: (version: Version) => void;
  showGrid: (visible: boolean) => void;
  face: (side: boolean) => void;
  detail: (part: "ansikte" | "händer") => void;
  bend: (joint: string, degrees: number) => void;
  resetJoints: () => void;
};

export default function PoseReview({ pose, initialVersion }: { pose: SamPose; initialVersion: Version }) {
  const surface = useRef<HTMLDivElement>(null);
  const viewport = useRef<Viewport | null>(null);
  const [version, selectVersion] = useState<Version>(initialVersion);
  const [grid, setGrid] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [joint, setJoint] = useState<string>("l_lowarm");
  const [angles, setAngles] = useState<Record<string, number>>({});
  const [canPose, setCanPose] = useState(false);
  const frontUrl = resultUrl(pose, "front");
  const tableUrl = pose.hasTablePose ? resultUrl(pose, "bordsvila") : "";
  const lookUrl = pose.hasAppearance ? resultUrl(pose, "utseende") : "";
  const uprightUrl = pose.hasUpright ? resultUrl(pose, "rak") : "";

  useEffect(() => {
    const host = surface.current;
    if (!host) return;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true });
    } catch {
      setError("3D-visningen behöver WebGL.");
      return;
    }
    const abort = new AbortController();
    const scene = new T.Scene();
    scene.background = new T.Color(0xf9faf6);
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.02, 50);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.domElement.setAttribute("aria-label", "Kroppsmodell med lodrät kamera");
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI * 0.07;
    controls.maxPolarAngle = Math.PI * 0.89;
    controls.minZoom = 0.55;
    controls.maxZoom = 7;
    const light = new T.DirectionalLight(0xfff4e2, 2.1);
    light.position.set(-2.5, 4, 3);
    scene.add(light, new T.HemisphereLight(0xfffcf4, 0x718579, 1.65));
    const clay = new T.MeshStandardMaterial({ color: 0xaab7af, roughness: 0.9, side: T.DoubleSide });

    const guides = new T.Group();
    const wall = new T.Group();
    const vertical = new T.GridHelper(3, 30, 0x738578, 0xc9d1c9);
    vertical.rotation.x = Math.PI / 2;
    vertical.position.set(0, 1.5, -1);
    const plumb = new T.Line(
      new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, -0.999), new T.Vector3(0, 3, -0.999)]),
      new T.LineBasicMaterial({ color: 0x356c60 }),
    );
    wall.add(vertical, plumb);
    guides.add(wall, new T.GridHelper(3, 30, 0x819887, 0xd5dbd1));
    scene.add(guides);
    function draw() {
      // Keep the reference plane vertical and behind the body as the camera orbits.
      wall.rotation.y = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
      renderer.render(scene, camera);
    }
    let height = 1.8;
    let width = 1;
    const wholeBodyTarget = new T.Vector3();
    function resize() {
      if (!host) return;
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      const half = Math.max(height, width * h / w) * 0.5;
      camera.top = half; camera.bottom = -half;
      camera.right = half * w / h; camera.left = -camera.right;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      draw();
    }
    function face(side: boolean) {
      controls.target.copy(wholeBodyTarget);
      camera.up.set(0, 1, 0);
      camera.position.copy(controls.target).add(side ? new T.Vector3(3, 0, 0) : new T.Vector3(0, 0, 3));
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      controls.update();
      draw();
    }
    const loader = new GLTFLoader();
    const bodies = new Map<Version, T.Group>();
    function detail(part: "ansikte" | "händer") {
      const body = [...bodies.values()].find(model => model.visible);
      if (!body) return;
      const joint = (name: string) => body.getObjectByName(name)?.getWorldPosition(new T.Vector3());
      const left = joint(part === "ansikte" ? "l_eye" : "l_middle1");
      const right = joint(part === "ansikte" ? "r_eye" : "r_middle1");
      if (!left || !right) return;
      controls.target.copy(left).lerp(right, 0.5);
      if (part === "ansikte") controls.target.y -= 0.043;
      const direction = part === "ansikte" ? new T.Vector3(0, 0, 3) : new T.Vector3(0, 2.7, 1.25);
      camera.position.copy(controls.target).add(direction);
      const span = part === "ansikte" ? 0.42 : Math.max(0.30, left.distanceTo(right) + 0.14);
      camera.zoom = Math.min(controls.maxZoom, 2 * Math.min(camera.top, camera.right) / span);
      camera.updateProjectionMatrix();
      controls.update();
      draw();
    }
    const joints = new Map<string, { bone: T.Bone; rest: T.Quaternion; axis: T.Vector3 }[]>();
    function prepareJoints(body: T.Group) {
      body.updateMatrixWorld(true);
      const at = (name: string) => body.getObjectByName(name)?.getWorldPosition(new T.Vector3());
      for (const [name] of poseJoints) {
        const bone = body.getObjectByName(name), side = name[0];
        const wrist = at(side + "_wrist"), start = at(name);
        if (!(bone instanceof T.Bone) || !wrist || !start) continue;
        let axis: T.Vector3;
        if (name.endsWith("_lowarm")) {
          const shoulder = at(side + "_uparm");
          if (!shoulder) continue;
          axis = wrist.sub(start).cross(shoulder.sub(start));
        } else {
          const index = at(side + "_index1"), pinky = at(side + "_pinky1"), tip = at(name.slice(0, -1) + "_null");
          if (!index || !pinky || !tip) continue;
          const palm = index.sub(wrist).cross(pinky.sub(wrist));
          if (palm.y > 0) palm.negate();
          axis = tip.sub(start).cross(palm);
        }
        if (axis.lengthSq() < 1e-12) continue;
        axis.normalize().applyQuaternion(bone.getWorldQuaternion(new T.Quaternion()).invert());
        const corresponding = joints.get(name) ?? [];
        corresponding.push({ bone, rest: bone.quaternion.clone(), axis });
        joints.set(name, corresponding);
      }
    }
    function releaseBody(body: T.Group) {
      const materials = new Set<T.Material>();
      const textures = new Set<T.Texture>();
      body.traverse(obj => {
        if (obj instanceof T.Mesh) {
          obj.geometry.dispose();
          for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) {
            if (mat === clay) continue;
            materials.add(mat);
            for (const value of Object.values(mat)) if (value instanceof T.Texture) textures.add(value);
          }
        }
        if (obj instanceof T.SkinnedMesh) obj.skeleton.dispose();
      });
      textures.forEach(texture => texture.dispose());
      materials.forEach(material => material.dispose());
    }
    async function load(version: Version, url: string) {
      const response = await fetch(url, { signal: abort.signal });
      if (!response.ok) throw Error("Den sparade kroppsmodellen kunde inte läsas.");
      const { scene: body } = await loader.parseAsync(await response.arrayBuffer(), "");
      body.traverse(obj => {
        if (obj instanceof T.Mesh && (version === "front" || version === "bordsvila")) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach(material => material.dispose());
          obj.material = clay;
        }
      });
      if (abort.signal.aborted) { releaseBody(body); return; }
      bodies.set(version, body);
      body.visible = false;
      scene.add(body);
    }
    function changePose(selected: Version) {
      for (const [key, body] of bodies) body.visible = key === selected;
      draw();
    }
    controls.addEventListener("change", draw);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const assets = [load("front", frontUrl)];
    if (tableUrl) assets.push(load("bordsvila", tableUrl));
    if (lookUrl) assets.push(load("utseende", lookUrl));
    if (uprightUrl) assets.push(load("rak", uprightUrl));
    Promise.all(assets).then(() => {
      if (abort.signal.aborted) return;
      const box = new T.Box3();
      for (const body of bodies.values()) box.expandByObject(body);
      const size = box.getSize(new T.Vector3());
      height = size.y * 1.16;
      width = Math.max(size.x, size.z) * 1.25;
      wholeBodyTarget.set(0, (box.max.y + box.min.y) / 2, 0);
      controls.target.copy(wholeBodyTarget);
      for (const [key, body] of bodies) if (key !== "front") prepareJoints(body);
      setCanPose(joints.size === poseJoints.length);
      viewport.current = {
        changePose, showGrid: on => { guides.visible = on; draw(); }, face, detail,
        bend: (name, degrees) => {
          for (const j of joints.get(name) ?? []) j.bone.quaternion.copy(j.rest).multiply(new T.Quaternion().setFromAxisAngle(j.axis, T.MathUtils.degToRad(degrees)));
          draw();
        },
        resetJoints: () => { for (const group of joints.values()) for (const j of group) j.bone.quaternion.copy(j.rest); draw(); },
      };
      changePose(bodies.has(initialVersion) ? initialVersion : "front");
      resize();
      face(false);
      setReady(true);
    }).catch((e: Error) => { if (!abort.signal.aborted) setError(e.message); });
    return () => {
      abort.abort();
      viewport.current = null;
      observer.disconnect();
      controls.dispose();
      bodies.forEach(releaseBody);
      guides.traverse(obj => {
        if (obj instanceof T.Line) {
          obj.geometry.dispose();
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach(material => material.dispose());
        }
      });
      clay.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [frontUrl, tableUrl, lookUrl, uprightUrl, initialVersion]);

  function choose(v: Version) { selectVersion(v); viewport.current?.changePose(v); }
  return <div className="pose-review">
    <div className="pose-tools" aria-label="Kontroller för kroppsprov">
      {(tableUrl || lookUrl || uprightUrl) && <span className="view-switch" role="group" aria-label="Pose">
        <button disabled={!ready} aria-pressed={version === "front"} onClick={() => choose("front")}>SAM-pose</button>
        {tableUrl && <button disabled={!ready} aria-pressed={version === "bordsvila"} onClick={() => choose("bordsvila")}>Bordsvila</button>}
        {lookUrl && <button disabled={!ready} aria-pressed={version === "utseende"} onClick={() => choose("utseende")}>Med utseende</button>}
        {uprightUrl && <button disabled={!ready} aria-pressed={version === "rak"} onClick={() => choose("rak")}>Helt upprätad</button>}
      </span>}
      <span className="view-switch" role="group" aria-label="Kamera">
        <button disabled={!ready} onClick={() => viewport.current?.face(false)}>Framifrån</button>
        <button disabled={!ready} onClick={() => viewport.current?.face(true)}>Från sidan</button>
        {(version === "utseende" || version === "rak") && <><button disabled={!ready} onClick={() => viewport.current?.detail("ansikte")}>Ansikte</button>
          <button disabled={!ready} onClick={() => viewport.current?.detail("händer")}>Handryggar</button></>}
      </span>
      <button disabled={!ready} aria-pressed={grid} onClick={() => { setGrid(!grid); viewport.current?.showGrid(!grid); }}>Rutnät · 10 cm</button>
    </div>
    {canPose && version !== "front" && <details className="pose-joints">
      <summary>Prova armar och fingrar</summary>
      <div>
        <select aria-label="Led att prova" value={joint} onChange={e => setJoint(e.target.value)}>
          {poseJoints.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <label>Böjning <input type="range" min="-25" max="70" step="1" value={angles[joint] ?? 0} onChange={e => {
          const value = Number(e.target.value); setAngles(a => ({ ...a, [joint]: value })); viewport.current?.bend(joint, value);
        }}/> <output>{angles[joint] ?? 0}°</output></label>
        <button onClick={() => { viewport.current?.resetJoints(); setAngles({}); }}>Återställ leder</button>
      </div>
    </details>}
    <div className="pose-canvas" ref={surface}/>
    {!ready && <p role="status" className="pose-message">{error || "Läser kroppsmodellen…"} {error && pose.hasSheet && <a href={resultUrl(pose, "sheet")}>Öppna bildarket</a>}</p>}
  </div>;
}
