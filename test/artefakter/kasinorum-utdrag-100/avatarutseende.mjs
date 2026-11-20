import * as T from "three";

function headFrame(points) {
  const [left, right, top] = points;
  const x = right.clone().sub(left).normalize();
  const z = x.clone().cross(top.clone().sub(left)).normalize();
  const y = z.clone().cross(x);
  return new T.Matrix4().makeBasis(x, y, z).setPosition(left);
}

// A skin has independent UVs on both sides of a seam. The source indices
// map those duplicates back to the same moving vertex in the calibrated take.
export async function loadAppearance(loader) {
  return prepareAppearance(await loader.loadAsync("/avatar.glb"));
}

export function prepareAppearance(asset) {
  const info = asset.parser.json.asset.extras;
  let skin, hair;
  asset.scene.traverse(obj => {
    if (!obj.isMesh) return;
    if (obj.geometry.hasAttribute("_sam_index")) skin = obj;
    else if (obj.geometry.hasAttribute("uv")) hair = obj;
  });
  if (!skin || !hair || !info?.headAnchors || !info?.headOriginPoints)
    throw Error("Avatarens textur eller huvudfäste saknas.");
  const restInverse = headFrame(info.headOriginPoints.map(p => new T.Vector3(...p))).invert();
  const sourceIndex = skin.geometry.getAttribute("_sam_index");
  const garment = skin.geometry.getAttribute("_garment");
  const faceDelta = skin.geometry.getAttribute("_face_delta");
  return {
    materials: [skin.material, hair.material],
    pieces(source) {
      const from = source.getAttribute("position");
      if (from.count !== info.samVertexCount) throw Error("Avataren tillhör en annan kroppstopologi.");
      source.computeVertexNormals();
      const normal = source.getAttribute("normal");
      const transform = headFrame(info.headAnchors.map(i => new T.Vector3().fromBufferAttribute(from,i))).multiply(restInverse);
      const rotation = new T.Matrix3().setFromMatrix4(transform);
      const body = skin.geometry.clone(), out = body.getAttribute("position");
      const delta = new T.Vector3(), p = new T.Vector3(), n = new T.Vector3();
      for (let i=0;i<out.count;i++) {
        const sourceVertex=sourceIndex.getX(i);
        p.fromBufferAttribute(from,sourceVertex);
        n.fromBufferAttribute(normal,sourceVertex);
        delta.fromBufferAttribute(faceDelta,i).applyMatrix3(rotation);
        const clearance=T.MathUtils.smoothstep(p.y,.025,.065)+T.MathUtils.smoothstep(-p.y,.110,.15);
        p.add(delta).addScaledVector(n,garment.getX(i)*clearance);
        out.setXYZ(i,p.x,p.y,p.z);
      }
      body.computeVertexNormals();
      const bob = hair.geometry.clone().applyMatrix4(transform);
      return [body,bob];
    },
  };
}
