// The dimensions are the sizes of the scanned tiles, in metres.
const scans = {
  felt: {id:"scuba_suede", width:.285220, height:.278900},
  rail: {id:"brown_leather", width:.4, height:.4},
  wood: {id:"walnut_veneer", width:1.8, height:1.8},
};
const kinds = ["diff","nor_gl","rough"];
const mapFile = (id, kind) => `maps/${id}_${kind}_2k.jpg`;
export const materialFiles = Object.values(scans).flatMap(s => kinds.map(k => mapFile(s.id,k)));

// Use metre UVs so that the texture scale holds around the entire padded roll.
function railUV(T, geometry) {
  const pos = geometry.getAttribute("position");
  const point = i => new T.Vector3().fromBufferAttribute(pos,i);
  let row = 2;
  while (row < pos.count && point(row).distanceToSquared(point(0)) > 1e-14) row++;
  row++; // both seam vertices are present
  if (row > pos.count || pos.count % row !== 0) throw Error("Okänd profil på relingen.");
  const uv = [];
  let length = 0, previousCentre;
  for (let i = 0; i < pos.count; i += row) {
    const centre = point(i).lerp(point(i+Math.floor(row/2)),.5);
    if (previousCentre) length += centre.distanceTo(previousCentre);
    previousCentre = centre;
    let distance = 0;
    for (let j = 0; j < row; j++) {
      if (j) distance += point(i+j-1).distanceTo(point(i+j));
      uv.push(length,distance);
    }
  }
  geometry.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
}

function veneerUV(T, geometry) {
  const p = geometry.attributes.position, n = geometry.attributes.normal;
  const uv = [];
  if (geometry.type === "CylinderGeometry") {
    const original = geometry.attributes.uv;
    for (let i=0; i<p.count; i++) {
      const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
      if (Math.abs(n.getY(i))>.99) uv.push(x,z);
      else uv.push(original.getX(i)*2*Math.PI*Math.hypot(x,z),y);
    }
  } else {
    const {shapes, options} = geometry.parameters;
    const outline = shapes.getPoints(options.curveSegments);
    const key = (x,y) => Math.fround(x)+","+Math.fround(y);
    const stations = new Map();
    let perimeter = 0;
    for (let i=0; i<outline.length; i++) {
      const a=outline[i], b=outline[(i+1)%outline.length];
      if (!stations.has(key(a.x,a.y))) stations.set(key(a.x,a.y),perimeter);
      perimeter += a.distanceTo(b);
    }
    // Raw veneer grain runs along V. On the skirt V follows the outline,
    // while on the horizontal caps it follows the table's long X axis.
    for (let i=0; i<p.count; i+=3) {
      if (Math.abs(n.getZ(i))>.99) {
        for (let j=i;j<i+3;j++) uv.push(p.getY(j),p.getX(j));
      } else {
        const offsets=[i,i+1,i+2].map(j=>stations.get(key(p.getX(j),p.getY(j))));
        if (offsets.some(value => value === undefined)) throw Error("Fanerets kant saknar båglängd.");
        const crossesSeam=Math.max(...offsets)-Math.min(...offsets)>perimeter/2;
        for(let k=0;k<3;k++) uv.push(.34+p.getZ(i+k), offsets[k]+(crossesSeam && offsets[k]<perimeter/2 ? perimeter : 0));
      }
    }
  }
  geometry.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
}

export async function applyTableMaterials(table, layout, baseUrl) {
  const T = await import("three");
  const directory = new URL(baseUrl || "./", document.baseURI);
  if (!directory.pathname.endsWith("/")) directory.pathname += "/";
  const loader = new T.TextureLoader();
  const materials = [], geometries=[], loaded=[], changes=[];
  function replace(mesh, key, next) {
    changes.push([mesh,key,mesh[key]]);
    mesh[key]=next;
  }
  function revert() {
    for (const [mesh,key,previous] of changes.reverse()) mesh[key]=previous;
    for (const handle of [...materials,...geometries,...loaded]) handle.dispose();
    changes.length=0; materials.length=0; geometries.length=0; loaded.length=0;
  }
  try {
    const maps={felt:{},rail:{},wood:{}};
    const requests=Object.entries(scans).flatMap(([surface,spec]) =>
      kinds.map(async kind => {
        const tex=await loader.loadAsync(new URL(mapFile(spec.id,kind),directory).href);
        loaded.push(tex);
        tex.wrapS=tex.wrapT=T.RepeatWrapping;
        tex.colorSpace=kind==="diff" ? T.SRGBColorSpace : T.NoColorSpace;
        tex.anisotropy=8;
        tex.repeat.set(1/spec.width,1/spec.height);
        maps[surface][kind]=tex;
      }));
    const transfers=await Promise.allSettled(requests);
    for(const transfer of transfers) if(transfer.status==="rejected") throw transfer.reason;
    function material(key, tint, rough, normalStrength) {
      const mapsFor=maps[key];
      const mat=new T.MeshStandardMaterial({color:tint,map:mapsFor.diff,normalMap:mapsFor.nor_gl,
        normalScale:new T.Vector2(normalStrength,normalStrength),roughnessMap:mapsFor.rough,roughness:rough,metalness:0});
      materials.push(mat);
      return mat;
    }
    const felt=table.children.find(m=>m.geometry?.type==="ShapeGeometry");
    const rail=table.children.find(m=>m.isMesh && m.geometry.type==="BufferGeometry" && m.children.some(c=>c.isLineSegments));
    const skirt=table.children.find(m=>m.geometry?.type==="ExtrudeGeometry");
    if (!felt?.material.map || !rail || !skirt) throw Error("Filt, reling eller träskiva saknas i bordsmodellen.");
    const cloth=material("felt",0xffffff,1,.48), leather=material("rail",0xffffff,.85,.70);
    const veneer=material("wood",0xf5e7d8,.82,.46);
    // The old map contains the live card target, spots and lettering. Keep
    // their exact UV and ink. Apply the scan luminance only to the green cloth.
    cloth.map=felt.material.map;
    const span=Math.max(1.8,layout.table.radiusX*2+.20);
    for(const tex of [cloth.normalMap,cloth.roughnessMap]) tex.repeat.multiplyScalar(span);
    cloth.onBeforeCompile=shader=>{
      shader.uniforms.feltAlbedo={value:maps.felt.diff};
      shader.fragmentShader="uniform sampler2D feltAlbedo;\n"+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",`
        #include <map_fragment>
        vec3 weights = vec3(0.2126, 0.7152, 0.0722);
        float scanLuma = dot(texture2D(feltAlbedo, vNormalMapUv).rgb, weights);
        float field = 1.0 - smoothstep(0.11, 0.24, dot(diffuseColor.rgb, weights));
        diffuseColor.rgb *= mix(1.0, clamp(scanLuma / 0.093504, 0.58, 1.72), field);
      `);
    };
    cloth.customProgramCacheKey=()=>"scuba-suede-markings-v1";
    replace(felt,"material",cloth);
    const railShape=rail.geometry.clone(); geometries.push(railShape);
    railUV(T,railShape);
    replace(rail,"geometry",railShape); replace(rail,"material",leather);
    for(const cap of rail.children.filter(c=>c.isMesh)) {
      const geometry=cap.geometry.clone(); geometries.push(geometry);
      const uv=geometry.attributes.uv, circumference=2*Math.PI*Math.sqrt(Math.abs(cap.scale.x*cap.scale.z));
      for(let i=0;i<uv.count;i++) uv.setXY(i,uv.getX(i)*circumference,uv.getY(i)*Math.PI*Math.abs(cap.scale.y));
      replace(cap,"geometry",geometry); replace(cap,"material",leather);
    }
    const woodParts=table.children.filter(m=>m.isMesh && m.material===skirt.material);
    for(const part of woodParts) {
      const geometry=part.geometry.clone(); geometries.push(geometry);
      veneerUV(T,geometry);
      replace(part,"geometry",geometry); replace(part,"material",veneer);
    }
    return revert;
  } catch (err) {
    revert();
    throw err;
  }
}
