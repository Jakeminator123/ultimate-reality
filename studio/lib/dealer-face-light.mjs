import { BufferAttribute } from "three";

/** Apply a take's recorded photo fill to the skinned head and eyelids in Three.js. */
export function applyDealerFaceLight(model) {
  const fill = model.parser.json.asset.extras?.faceSurface?.photoFill;
  if (!fill) return;
  model.scene.traverse(mesh => {
    if (!mesh.isSkinnedMesh || mesh.material.name !== fill.material) return;
    const indices = mesh.geometry.getAttribute("skinIndex");
    const weights = mesh.geometry.getAttribute("skinWeight");
    const boneWeight = mesh.skeleton.bones.map(bone => {
      if (/^(c_head|c_jaw|c_teeth|c_tongue|[lr]_eye)/.test(bone.name)) return 1;
      return bone.name.startsWith("c_neck") ? fill.neckWeight : 0;
    });
    const blend = new Float32Array(indices.count);
    for (let v = 0; v < blend.length; v++) {
      for (let k = 0; k < indices.itemSize; k++)
        blend[v] += boneWeight[indices.getComponent(v, k)] * weights.getComponent(v, k);
    }
    mesh.geometry.setAttribute("photoFaceWeight", new BufferAttribute(blend, 1));
    const material = mesh.material;
    material.onBeforeCompile = shader => {
      shader.uniforms.photoFill = { value: fill.amount };
      shader.uniforms.photoLevel = { value: fill.albedoLevel };
      shader.vertexShader = "attribute float photoFaceWeight; varying float vPhotoWeight;\n" +
        shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvPhotoWeight = photoFaceWeight;");
      shader.fragmentShader = "varying float vPhotoWeight; uniform float photoFill; uniform float photoLevel;\n" +
        shader.fragmentShader.replace("#include <opaque_fragment>",
          "outgoingLight = mix(outgoingLight, diffuseColor.rgb * photoLevel, photoFill * vPhotoWeight);\n#include <opaque_fragment>");
    };
    material.customProgramCacheKey = () => "dealer-photo-face-fill";
    material.needsUpdate = true;
  });
}
