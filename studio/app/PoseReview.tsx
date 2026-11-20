"use client";
import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { resultUrl, type ActiveDealerModel, type SamPose, type PoseVersion as Version } from "../lib/modeling";
import { jawHinge, makeRigOverlay, measureRigJoint, initialRigLayers, type RigLayers } from "../lib/rig-overlay";
import type { Photo } from "../lib/material-types";
import { angleDifference, seatedStandard } from "../lib/seated-review";
import RigCamera, { eyeRows, frontCamera, type CameraAdjustment, type CameraValues } from "./RigCamera";

const poseJoints = [["l_lowarm", "Vänster armbåge"], ["r_lowarm", "Höger armbåge"],
  ["l_index1", "Vänster pekfinger"], ["l_middle1", "Vänster långfinger"],
  ["r_index1", "Höger pekfinger"], ["r_middle1", "Höger långfinger"]] as const;
type CameraDetail = "ansikte" | "händer";
type Viewport = {
  changePose: (version: Version) => void;
  showGrid: (visible: boolean) => void;
  showLayers: (layers: RigLayers) => void;
  adjustCamera: (values: CameraAdjustment) => void;
  measureJoint: () => void;
  face: (degrees: number) => void;
  detail: (part: CameraDetail, degrees?: number) => void;
  bend: (joint: string, degrees: number) => void;
  resetJoints: () => void;
};

type ReviewProps =
  | { model: ActiveDealerModel; cameraAngle?: number; cameraDetail?: CameraDetail; reference?: Photo; guides: boolean; onGuides: (value: boolean) => void; pose?: never; initialVersion?: "front" | "utseende" }
  | { model?: never; cameraAngle?: never; cameraDetail?: never; reference?: never; guides?: never; onGuides?: never; pose: SamPose; initialVersion: Version };

function framePhoto(viewport: Viewport, angle = 0, detail?: CameraDetail) {
  if (detail) viewport.detail(detail, angle);
  else viewport.face(angle);
}

export default function PoseReview(props: ReviewProps) {
  const { model, pose } = props;
  const initialVersion = props.initialVersion ?? "front";
  const surface = useRef<HTMLDivElement>(null);
  const viewport = useRef<Viewport | null>(null);
  const photoView = useRef({ angle: props.cameraAngle, detail: props.cameraDetail });
  const [version, selectVersion] = useState<Version>(initialVersion);
  const selectedVersion = useRef(initialVersion);
  const [grid, setGrid] = useState(true);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState<Version[]>([]);
  const [error, setError] = useState("");
  const [joint, setJoint] = useState<string>("l_lowarm");
  const selectedJoint = useRef(joint);
  const [jointReading, setJointReading] = useState<ReturnType<typeof measureRigJoint>>(null);
  const [angles, setAngles] = useState<Record<string, number>>({});
  const [canPose, setCanPose] = useState(false);
  const [jawVersions, setJawVersions] = useState<Version[]>([]);
  const [layers, setLayers] = useState<RigLayers>(initialRigLayers);
  const [rigCount, setRigCount] = useState<{ main: number; total: number } | null>(null);
  const [cameraValues, setCameraValues] = useState<CameraValues>(frontCamera);
  const frontUrl = pose ? resultUrl(pose, "front") : model.url;
  const tableUrl = pose?.hasTablePose ? resultUrl(pose, "bordsvila") : "";
  const lookUrl = pose?.hasAppearance ? resultUrl(pose, "utseende") : model?.appearanceUrl ?? "";
  const uprightUrl = pose?.hasUpright ? resultUrl(pose, "rak") : "";
  const activeRig = Boolean(model);
  useEffect(() => {
    photoView.current = { angle: props.cameraAngle, detail: props.cameraDetail };
    if (viewport.current) framePhoto(viewport.current, props.cameraAngle, props.cameraDetail);
  }, [props.cameraAngle, props.cameraDetail]);
  useEffect(() => {
    if (ready) viewport.current?.showLayers(layers);
  }, [layers, ready]);
  useEffect(() => {
    if (ready) viewport.current?.showGrid(grid);
  }, [grid, ready]);

  useEffect(() => {
    const host = surface.current;
    if (!host) return;
    setReady(false);
    setError("");
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
    renderer.domElement.setAttribute("aria-label", "Kroppsmodell med vridbar ortografisk kamera");
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI * 0.07;
    controls.maxPolarAngle = Math.PI * 0.89;
    controls.minZoom = 0.55;
    controls.maxZoom = 7;
    let overlay: ReturnType<typeof makeRigOverlay> = null;
    const offset = new T.Vector3();
    const orbit = new T.Spherical();
    let leftEye: T.Object3D | undefined, rightEye: T.Object3D | undefined;
    const eyePosition = new T.Vector3();
    const rounded = (value: number) => Math.round(value * 1000) / 1000 || 0;
    const eyeRow = (node?: T.Object3D) => node ? rounded((1 - node.getWorldPosition(eyePosition).project(camera).y) * 50) : null;
    function reportCamera() {
      if (!activeRig) return;
      orbit.setFromVector3(offset.subVectors(camera.position, controls.target));
      const next: CameraValues = {
        azimuth: rounded(T.MathUtils.radToDeg(orbit.theta)), elevation: rounded(90 - T.MathUtils.radToDeg(orbit.phi)),
        distance: rounded(orbit.radius), zoom: rounded(camera.zoom), cameraHeight: rounded(camera.position.y),
        targetHeight: rounded(controls.target.y), leftEye: eyeRow(leftEye), rightEye: eyeRow(rightEye),
      };
      setCameraValues(previous => (Object.keys(next) as (keyof CameraValues)[]).every(k => previous[k] === next[k]) ? previous : next);
    }
    function adjustCamera(update: CameraAdjustment) {
      orbit.setFromVector3(offset.subVectors(camera.position, controls.target));
      if (update.targetHeight !== undefined) controls.target.y = update.targetHeight;
      if (update.azimuth !== undefined) orbit.theta = T.MathUtils.degToRad(update.azimuth);
      if (update.elevation !== undefined) orbit.phi = T.MathUtils.degToRad(90 - update.elevation);
      if (update.distance !== undefined) orbit.radius = update.distance;
      if (update.zoom !== undefined) camera.zoom = update.zoom;
      camera.position.copy(controls.target).add(offset.setFromSpherical(orbit));
      camera.updateProjectionMatrix();
      controls.update();
      cameraMoved();
    }
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
      if (activeRig) {
        reportCamera();
        renderer.domElement.dataset.camera = JSON.stringify({
          azimuth: T.MathUtils.radToDeg(orbit.theta), elevation: 90 - T.MathUtils.radToDeg(orbit.phi),
          distance: orbit.radius, zoom: camera.zoom, position: camera.position.toArray(), target: controls.target.toArray(),
          frustum: [camera.left, camera.right, camera.bottom, camera.top, camera.near, camera.far],
        });
      }
    }
    function cameraMoved() { draw(); }
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
    function face(degrees: number) {
      controls.target.copy(wholeBodyTarget);
      camera.up.set(0, 1, 0);
      const radians = T.MathUtils.degToRad(degrees);
      camera.position.copy(controls.target).add(new T.Vector3(3 * Math.sin(radians), 0, 3 * Math.cos(radians)));
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      controls.update();
      cameraMoved();
    }
    const loader = new GLTFLoader();
    const bodies = new Map<Version, T.Group>();
    function detail(part: CameraDetail, degrees = 0) {
      const body = [...bodies.values()].find(model => model.visible);
      if (!body) return;
      const joint = (name: string) => body.getObjectByName(name)?.getWorldPosition(new T.Vector3());
      const left = joint(part === "ansikte" ? "l_eye" : "l_middle1");
      const right = joint(part === "ansikte" ? "r_eye" : "r_middle1");
      if (!left || !right) return;
      controls.target.copy(left).lerp(right, 0.5);
      if (part === "ansikte") controls.target.y -= 0.043;
      const yaw = T.MathUtils.degToRad(degrees);
      const direction = part === "ansikte" ? new T.Vector3(3 * Math.sin(yaw), 0, 3 * Math.cos(yaw)) : new T.Vector3(0, 2.7, 1.25);
      camera.position.copy(controls.target).add(direction);
      const span = part === "ansikte" ? 0.42 : Math.max(0.30, left.distanceTo(right) + 0.14);
      camera.zoom = Math.min(controls.maxZoom, 2 * Math.min(camera.top, camera.right) / span);
      camera.updateProjectionMatrix();
      controls.update();
      cameraMoved();
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
      leftEye = bodies.get(selected)?.getObjectByName("l_eye");
      rightEye = bodies.get(selected)?.getObjectByName("r_eye");
      if (activeRig) renderer.domElement.dataset.model = (selected === "utseende" ? lookUrl : frontUrl) || "";
      measureJoint();
      draw();
    }
    function measureJoint() {
      if (!activeRig) return;
      const body = bodies.get(selectedVersion.current);
      setJointReading(body ? measureRigJoint(body, selectedJoint.current) : null);
    }
    controls.addEventListener("change", cameraMoved);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const sources: [Version, string][] = [["front", frontUrl]];
    if (tableUrl) sources.push(["bordsvila", tableUrl]);
    if (lookUrl) sources.push(["utseende", lookUrl]);
    if (uprightUrl) sources.push(["rak", uprightUrl]);
    Promise.allSettled(sources.map(([key, url]) => load(key, url))).then(results => {
      if (abort.signal.aborted) return;
      if (results[0].status === "rejected") throw results[0].reason;
      setUnavailable(sources.filter(([key]) => !bodies.has(key)).map(([key]) => key));
      const box = new T.Box3();
      for (const body of bodies.values()) box.expandByObject(body);
      const size = box.getSize(new T.Vector3());
      height = size.y * (activeRig ? 1.08 : 1.16);
      width = Math.max(size.x, size.z) * 1.25;
      box.getCenter(wholeBodyTarget);
      if (!activeRig) wholeBodyTarget.set(0, (box.max.y + box.min.y) / 2, 0);
      controls.target.copy(wholeBodyTarget);
      for (const [key, body] of bodies) if (activeRig || key !== "front") prepareJoints(body);
      setCanPose(poseJoints.every(([name]) => joints.has(name)));
      if (activeRig) {
        const jawModels: Version[] = [];
        for (const [key, body] of bodies) {
          const hinge = jawHinge(body);
          if (hinge) { joints.set("c_jaw", [...(joints.get("c_jaw") ?? []), hinge]); jawModels.push(key); }
        }
        setJawVersions(jawModels);
        overlay = makeRigOverlay(bodies.get("front")!);
        if (overlay) scene.add(overlay.group);
        setRigCount(overlay ? { main: overlay.mainCount, total: overlay.total } : null);
      }
      viewport.current = {
        changePose, adjustCamera, measureJoint, showGrid: on => { guides.visible = on; draw(); }, face, detail,
        showLayers: next => {
          if (!overlay) return;
          bodies.forEach(body => body.traverse(object => { if (object instanceof T.Mesh) object.visible = next.surface; }));
          overlay.show(next);
          draw();
        },
        bend: (name, degrees) => {
          for (const j of joints.get(name) ?? []) j.bone.quaternion.copy(j.rest).multiply(new T.Quaternion().setFromAxisAngle(j.axis, T.MathUtils.degToRad(degrees)));
          overlay?.refresh();
          measureJoint();
          draw();
        },
        resetJoints: () => {
          for (const group of joints.values()) for (const j of group) j.bone.quaternion.copy(j.rest);
          overlay?.refresh(); measureJoint(); draw();
        },
      };
      const visible = bodies.has(selectedVersion.current) ? selectedVersion.current : "front";
      selectedVersion.current = visible;
      selectVersion(visible);
      changePose(visible);
      resize();
      framePhoto(viewport.current, photoView.current.angle, photoView.current.detail);
      setReady(true);
    }).catch((e: Error) => { if (!abort.signal.aborted) setError(e.message); });
    return () => {
      abort.abort();
      viewport.current = null;
      observer.disconnect();
      controls.removeEventListener("change", cameraMoved);
      controls.dispose();
      overlay?.dispose();
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
  }, [frontUrl, tableUrl, lookUrl, uprightUrl, initialVersion, activeRig]);

  function choose(v: Version) {
    if (!layers.surface) setLayers(state => ({ ...state, surface: true }));
    if (selectedJoint.current === "c_jaw" && !jawVersions.includes(v)) {
      selectedJoint.current = "l_lowarm"; setJoint("l_lowarm");
    }
    selectedVersion.current = v; selectVersion(v); viewport.current?.changePose(v);
  }
  const eye = props.cameraAngle !== undefined && angleDifference(cameraValues.azimuth, props.cameraAngle) <= seatedStandard.cameraDegrees
    ? eyeRows(cameraValues, props.reference) : null;
  return <div className="pose-review">
    <div className="pose-tools" aria-label="Kontroller för kroppsprov">
      {(activeRig || tableUrl || lookUrl || uprightUrl) && <span className="view-switch" role="group" aria-label={activeRig ? "Kroppsyta" : "Pose"}>
        <button disabled={!ready} aria-pressed={layers.surface && version === "front"} onClick={() => choose("front")}>{activeRig ? "Kroppsform" : "SAM-pose"}</button>
        {tableUrl && <button disabled={!ready || unavailable.includes("bordsvila")} aria-pressed={version === "bordsvila"} onClick={() => choose("bordsvila")}>Bordsvila</button>}
        {lookUrl && <button disabled={!ready || unavailable.includes("utseende")} aria-pressed={layers.surface && version === "utseende"} onClick={() => choose("utseende")}>{activeRig ? "Fotoutseende · prov" : "Med utseende"}</button>}
        {uprightUrl && <button disabled={!ready || unavailable.includes("rak")} aria-pressed={version === "rak"} onClick={() => choose("rak")}>Helt upprätad</button>}
        {activeRig && <button disabled={!ready || !rigCount} aria-pressed={!layers.surface} onClick={() => setLayers(state => ({
          ...state, surface: false, skeleton: true, joints: true,
        }))}>Endast rigg</button>}
      </span>}
      <span className="view-switch" role="group" aria-label="Kamera">
        <button disabled={!ready} onClick={() => viewport.current?.face(0)}>Framifrån</button>
        <button disabled={!ready} onClick={() => viewport.current?.face(45)}>Trekvart</button>
        <button disabled={!ready} onClick={() => viewport.current?.face(90)}>Från sidan</button>
        {(activeRig || version === "utseende" || version === "rak") && <><button disabled={!ready} onClick={() => viewport.current?.detail("ansikte")}>Ansikte</button>
          <button disabled={!ready} onClick={() => viewport.current?.detail("händer")}>Handryggar</button></>}
      </span>
      <div className="rig-layer-tools" role="group" aria-label="Visningslager">
        {activeRig && <>
          <button disabled={!ready || !rigCount || (!layers.surface && !layers.joints)} aria-pressed={layers.skeleton}
            onClick={() => setLayers(state => ({ ...state, skeleton: !state.skeleton }))}>Skelett</button>
          <button disabled={!ready || !rigCount || (!layers.surface && !layers.skeleton)} aria-pressed={layers.joints}
            onClick={() => setLayers(state => ({ ...state, joints: !state.joints }))}>Leder</button>
        </>}
        <button disabled={!ready} aria-pressed={grid} onClick={() => setGrid(!grid)}>Rutnät · 10 cm</button>
      </div>
      {rigCount && (layers.skeleton || layers.joints) && <div className="rig-legend">
        <label><input type="checkbox" checked={layers.all} onChange={e => setLayers(state => ({ ...state, all: e.target.checked }))}/>
          Alla {rigCount.total} leder</label>
        <span>{layers.all ? rigCount.total : rigCount.main} visas</span>
        <span className="rig-left">Vänster</span><span className="rig-right">Höger</span><span className="rig-centre">Mittlinje</span>
      </div>}
    </div>
    {props.model && <RigCamera ready={ready} values={cameraValues} adjust={v => viewport.current?.adjustCamera(v)}
      reference={props.reference} guides={props.guides} onGuides={props.onGuides}/>}
    {canPose && (activeRig || version !== "front") && <details className="pose-joints">
      <summary>Prova armar och fingrar{jawVersions.includes(version) && " samt käken"}</summary>
      <div>
        <select aria-label="Led att prova" value={joint} onChange={e => {
          selectedJoint.current = e.target.value; setJoint(e.target.value);
          if (e.target.value === "c_jaw") viewport.current?.detail("ansikte");
          viewport.current?.measureJoint();
        }}>
          {poseJoints.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          {jawVersions.includes(version) && <option value="c_jaw">Käköppning</option>}
        </select>
        <label>{joint === "c_jaw" ? "Käköppning" : "Böjning"} <input type="range" min={joint === "c_jaw" ? 0 : -25} max={joint === "c_jaw" ? 12 : 70} step="1" value={angles[joint] ?? 0} onChange={e => {
          const value = Number(e.target.value); setAngles(a => ({ ...a, [joint]: value })); viewport.current?.bend(joint, value);
        }}/> <output>{angles[joint] ?? 0}°</output></label>
        <button onClick={() => { viewport.current?.resetJoints(); setAngles({}); }}>Återställ leder</button>
      </div>
      {joint === "c_jaw" && <p>Käkprovet vrider den befintliga leden. För blinkningar och tal behövs styrning av ögonlock och läppar.</p>}
      {jointReading && <dl className="rig-joint-measurements">
        <div><dt>{jointReading.segments}</dt><dd>{Math.round(jointReading.angle)}°</dd></div>
        <div><dt>Led till {jointReading.target}</dt><dd>{jointReading.distance.toLocaleString("sv-SE", {maximumFractionDigits: 1})} cm</dd></div>
        <div><dt>Mot {jointReading.target} · vänster / upp / framåt</dt>
          <dd>{jointReading.offset.map(value => value.toLocaleString("sv-SE", {maximumFractionDigits: 1})).join(" / ")} cm</dd></div>
      </dl>}
    </details>}
    <div className="pose-canvas" ref={surface}>{ready && props.guides && <div className="rig-camera-guides" aria-hidden="true">
      <i className="rig-target"/>
      {eye && <><i className="rig-eye-photo" style={{ top: eye.photo + "%" }}/><i className="rig-eye-model" style={{ top: eye.model + "%" }}/></>}
    </div>}</div>
    {ready && unavailable.length > 0 && <p role="status">En alternativ modellfil kunde inte läsas på den här datorn.</p>}
    {!ready && <p role="status" className="pose-message">{error || "Läser kroppsmodellen…"} {error && pose?.hasSheet && <a href={resultUrl(pose, "sheet")}>Öppna bildarket</a>}</p>}
  </div>;
}
