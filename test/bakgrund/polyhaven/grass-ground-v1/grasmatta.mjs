export function printGrassMarkings(material, markings) {
  for (const texture of [material.map, material.normalMap, material.roughnessMap]) {
    texture.repeat.multiplyScalar(markings.span);
  }
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
}
