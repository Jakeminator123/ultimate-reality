import * as T from "three";

export function jawHinge(body: T.Group) {
  const bone = body.getObjectByName("c_jaw");
  const position = (name: string) => body.getObjectByName(name)?.getWorldPosition(new T.Vector3());
  const left = position("l_eye"), right = position("r_eye"), tip = position("c_jaw_null");
  if (!(bone instanceof T.Bone) || !left || !right || !tip) return null;
  let weighted = false;
  body.traverse(mesh => {
    if (weighted || !(mesh instanceof T.SkinnedMesh)) return;
    const index = mesh.skeleton.bones.indexOf(bone);
    const indices = mesh.geometry.getAttribute("skinIndex"), weights = mesh.geometry.getAttribute("skinWeight");
    if (index < 0 || !indices || !weights) return;
    for (let v = 0; v < indices.count && !weighted; v++) {
      for (let k = 0; k < indices.itemSize; k++) {
        if (indices.getComponent(v, k) === index && weights.getComponent(v, k) > 0) { weighted = true; break; }
      }
    }
  });
  if (!weighted) return null;
  const axis = left.sub(right), fromHinge = tip.sub(bone.getWorldPosition(new T.Vector3()));
  // Choose the rotation sign that initially lowers the jaw tip in model space.
  const vertical = axis.clone().cross(fromHinge).y;
  if (Math.abs(vertical) < 1e-8) return null;
  if (vertical > 0) axis.negate();
  axis.normalize().applyQuaternion(bone.getWorldQuaternion(new T.Quaternion()).invert());
  return { bone, axis, rest: bone.quaternion.clone() };
}

export type RigLayers = { surface: boolean; skeleton: boolean; joints: boolean; all: boolean };
export const initialRigLayers: RigLayers = { surface: true, skeleton: false, joints: false, all: false };

export function measureRigJoint(body: T.Group, name: string) {
  const elbow = name.endsWith("_lowarm");
  const side = name.slice(0, 2);
  const finger = name.slice(0, -1);
  const position = (id: string) => body.getObjectByName(id)?.getWorldPosition(new T.Vector3());
  const pivot = position(name);
  const proximal = position(side + (elbow ? "uparm" : "wrist"));
  const distal = position(elbow ? side + "wrist" : finger + "2");
  const target = elbow ? distal?.clone() : position(finger + "_null");
  if (!pivot || !proximal || !distal || !target) return null;
  const angle = T.MathUtils.radToDeg(proximal.sub(pivot).angleTo(distal.sub(pivot)));
  const delta = target.sub(pivot).multiplyScalar(100);
  return { angle, distance: delta.length(), offset: delta.toArray(), target: elbow ? "handled" : "fingertopp",
    segments: elbow ? "Axel–armbåge–handled" : "Handled–knoge–nästa fingerled" };
}

function mainJoint(bone: T.Bone) {
  return bone.name !== "body_world" && !/twist|_proc$|teeth|tongue|jaw_null|eye_null/.test(bone.name);
}

function fineJoint(bone: T.Bone) {
  return /thumb|index|middle|ring|pinky|eye|teeth|tongue|twist|tarsal|ball/.test(bone.name);
}

function jointColour(bone: T.Bone) {
  return new T.Color(bone.name.startsWith("l_") ? 0x147aa9 : bone.name.startsWith("r_") ? 0xbe531e : 0x10705b);
}

export function makeRigOverlay(body: T.Group) {
  let bones: T.Bone[] = [];
  body.traverse(object => {
    if (object instanceof T.SkinnedMesh && !bones.length) bones = object.skeleton.bones;
  });
  if (!bones.length) return null;
  const main = bones.filter(mainJoint);
  const group = new T.Group();
  const material = new T.MeshBasicMaterial({ depthTest: false, depthWrite: false, toneMapped: false });
  const segments = new T.InstancedMesh(new T.CylinderGeometry(1, 1, 1, 8), material, bones.length);
  const markers = new T.InstancedMesh(new T.SphereGeometry(1, 10, 8), material, bones.length);
  group.add(segments, markers);
  segments.frustumCulled = markers.frustumCulled = false;
  segments.renderOrder = 30;
  markers.renderOrder = 31;
  let shown: T.Bone[] = [];
  let links: [T.Bone, T.Bone][] = [];
  const matrix = new T.Matrix4(), rotation = new T.Quaternion(), zeroRotation = new T.Quaternion();
  const start = new T.Vector3(), end = new T.Vector3(), direction = new T.Vector3(), size = new T.Vector3();
  const up = new T.Vector3(0, 1, 0);

  function refresh(worldUnitsPerCssPixel: number) {
    if (!group.visible) return;
    body.updateWorldMatrix(true, true);
    shown.forEach((bone, i) => {
      end.setFromMatrixPosition(bone.matrixWorld);
      const radius = (fineJoint(bone) ? 2 : 2.75) * worldUnitsPerCssPixel;
      markers.setMatrixAt(i, matrix.compose(end, zeroRotation, size.setScalar(radius)));
    });
    links.forEach(([parent, child], i) => {
      start.setFromMatrixPosition(parent.matrixWorld);
      end.setFromMatrixPosition(child.matrixWorld);
      direction.subVectors(end, start);
      const length = direction.length();
      rotation.setFromUnitVectors(up, direction.normalize());
      const radius = (fineJoint(child) ? 0.55 : 0.75) * worldUnitsPerCssPixel;
      segments.setMatrixAt(i, matrix.compose(start.lerp(end, .5), rotation, size.set(radius, length, radius)));
    });
    markers.instanceMatrix.needsUpdate = segments.instanceMatrix.needsUpdate = true;
  }

  function show(layers: RigLayers) {
    group.visible = layers.skeleton || layers.joints;
    segments.visible = layers.skeleton;
    markers.visible = layers.joints;
    const next = layers.all ? bones : main;
    if (shown !== next) {
      shown = next;
      const included = new Set<T.Object3D>(shown);
      const linked = new Set<T.Bone>();
      links = [];
      shown.forEach((bone, i) => {
        markers.setColorAt(i, jointColour(bone));
        // Keep real parent segments through hidden joints, including each wrist twist.
        let child = bone;
        while (child.parent instanceof T.Bone && child.parent.name !== "body_world" && !linked.has(child)) {
          const parent = child.parent;
          segments.setColorAt(links.length, jointColour(child));
          links.push([parent, child]);
          linked.add(child);
          if (included.has(parent)) break;
          child = parent;
        }
      });
      segments.count = links.length;
      markers.count = shown.length;
      if (segments.instanceColor) segments.instanceColor.needsUpdate = true;
      if (markers.instanceColor) markers.instanceColor.needsUpdate = true;
    }
  }

  show(initialRigLayers);
  const head = bones.find(bone => bone.name === "c_head");
  const hasFaceRig = head?.parent?.name === "c_neck" &&
    ["c_head_null", "c_jaw", "l_eye", "r_eye"].every(name => head.children.some(child => child.name === name));
  return { group, show, refresh, hasFaceRig, mainCount: main.length, total: bones.length, dispose() {
    group.removeFromParent();
    segments.geometry.dispose(); markers.geometry.dispose();
    segments.dispose(); markers.dispose(); material.dispose();
  } };
}
