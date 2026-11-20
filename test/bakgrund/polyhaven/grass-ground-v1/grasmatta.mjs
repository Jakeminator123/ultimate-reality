import * as T from "three";

const scanWidthMetres = 2.51;

export async function applyGrassMat(table, markings, renderer) {
  const surface = table.children.find(mesh => mesh.geometry?.type === "ShapeGeometry");
  if (!surface) throw Error("Bordets spelyta saknas.");
  const loader = new T.TextureLoader();
  const [color, normal, roughness] = await Promise.all(["diff", "nor_gl", "rough"].map(kind => {
    return loader.loadAsync(new URL(`grass_ground_${kind}_2k.jpg`, import.meta.url).href);
  }));
  const repeats = markings.span / scanWidthMetres;
  for (const texture of [color, normal, roughness]) {
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(repeats, repeats);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  color.colorSpace = T.SRGBColorSpace;
  const material = new T.MeshStandardMaterial({
    map: color, normalMap: normal, roughnessMap: roughness, roughness: 1, metalness: 0,
  });
  // The grass repeats at scan scale. Printed marks follow the original table UVs.
  material.onBeforeCompile = shader => {
    shader.uniforms.tableInk = { value: markings.tex };
    shader.vertexShader = "varying vec2 vInkUv;\n" + shader.vertexShader.replace(
      "#include <uv_vertex>", "#include <uv_vertex>\nvInkUv = uv;"
    );
    shader.fragmentShader = "uniform sampler2D tableInk;\nvarying vec2 vInkUv;\n" + shader.fragmentShader.replace(
      "#include <map_fragment>",
      "#include <map_fragment>\nvec4 ink = texture2D(tableInk, vInkUv);\ndiffuseColor.rgb = mix(diffuseColor.rgb, ink.rgb, ink.a);"
    );
  };
  material.customProgramCacheKey = () => "grass-ground-markings-v1";
  surface.material = material;
}
