import * as T from "three";

export const floorY = -0.75;
export const columnPosition = [0.76, -1.35]; // X, Z i meter från filten

// Drawn from a fixed seed so the same walnut grain appears in every camera.
export function walnutTexture() {
  const w = 512, h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d"), img = ctx.createImageData(w, h);
  let seed = 43217;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w * 2 * Math.PI, v = y / h * 2 * Math.PI;
    const growth = v + 0.12 * Math.sin(u + 2 * v) + 0.035 * Math.cos(3 * u - v);
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const grain = 6 * Math.cos(26 * growth) + 3 * Math.cos(68 * growth) + 5 * Math.sin(4 * growth) + 3 * (seed / 4294967296 - 0.5);
    const i = (y * w + x) * 4;
    img.data[i] = 112 + grain;
    img.data[i + 1] = 83 + grain * 0.77;
    img.data[i + 2] = 62 + grain * 0.58;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new T.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Egen salong. Båda kamerorna delar även armaturer, skuggor och reflexbild.
export function buildSalon(scene) {
  scene.background = new T.Color(0x282822);
  const paint = (color, roughness = 0.72, metalness = 0) =>
    new T.MeshStandardMaterial({ color, roughness, metalness });
  const plaster = paint(0x919b92), dark = paint(0x353c36);
  const walnut = new T.MeshStandardMaterial({ map: walnutTexture(), color: 0xd1c2ac, roughness: 0.56 });
  const bronze = paint(0x99764c, 0.36, 0.55), inset = paint(0x526963);
  const glass = new T.MeshStandardMaterial({ color: 0xffeacd, emissive: 0xffdbaf, emissiveIntensity: 0.75 });
  const cube = new T.BoxGeometry(1, 1, 1);
  function piece(parent, geometry, material, x, y, z) {
    const m = new T.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function block(parent, material, x, y, z, w, h, d) {
    const m = piece(parent, cube, material, x, y, z);
    m.scale.set(w, h, d);
    return m;
  }
  const tile = document.createElement("canvas");
  tile.width = tile.height = 256;
  const ctx = tile.getContext("2d");
  ctx.fillStyle = "#544b40";
  ctx.fillRect(0, 0, 256, 256);
  const planks = ["#74695c", "#6e6256", "#7d7061", "#756859"];
  for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
    ctx.save();
    ctx.translate(col * 128 + 64, row * 128 + 64);
    if ((col + row) % 2) ctx.rotate(Math.PI / 2);
    for (let n = 0; n < 4; n++) {
      ctx.fillStyle = planks[(n + row + col) % 4];
      ctx.fillRect(-63, -64 + n * 32 + 1, 126, 30);
      ctx.fillStyle = "rgba(54,32,18,.09)";
      for (let i = 0; i < 6; i++) ctx.fillRect(-60 + (n * 3 + i * 19) % 34, -60 + n * 32 + i * 4, 65 + i * 3, 1);
    }
    ctx.restore();
  }
  const pattern = new T.CanvasTexture(tile);
  pattern.wrapS = pattern.wrapT = T.RepeatWrapping;
  pattern.repeat.set(15, 15);
  pattern.colorSpace = T.SRGBColorSpace;
  const floor = piece(scene, new T.PlaneGeometry(12, 12), new T.MeshStandardMaterial({ map: pattern, roughness: 0.68 }), 0, floorY, 0);
  floor.rotation.x = -Math.PI / 2;
  function wall(x, z, yaw) {
    const w = new T.Group();
    scene.add(w);
    w.position.set(x, floorY, z);
    w.rotation.y = yaw;
    block(w, plaster, 0, 1.8, -0.08, 7.4, 3.6, 0.16);
    block(w, walnut, 0, 0.39, 0.025, 7.4, 0.78, 0.05);
    block(w, bronze, 0, 0.79, 0.055, 7.4, 0.014, 0.018);
    block(w, dark, 0, 0.055, 0.055, 7.4, 0.11, 0.04);
    for (let i = -2; i <= 2; i++) {
      const cx = i * 1.43;
      // Arched upholstered panels with bronze reveals.
      function arch(radius, material, zFace) {
        const shape = new T.Shape();
        shape.moveTo(-radius, 0);
        shape.lineTo(radius, 0);
        shape.lineTo(radius, 1.12);
        shape.absarc(0, 1.12, radius, 0, Math.PI, false);
        shape.closePath();
        piece(w, new T.ShapeGeometry(shape, 48), material, cx, 0.82, zFace);
      }
      arch(0.574, bronze, 0.02);
      arch(0.552, dark, 0.023);
      arch(0.516, inset, 0.026);
      block(w, dark, cx, 0.40, 0.058, 1.16, 0.52, 0.014);
      block(w, walnut, cx, 0.40, 0.069, 1.13, 0.49, 0.012);
      if (i % 2 === 0) {
        block(w, bronze, cx, 1.48, 0.085, 0.055, 0.28, 0.10);
        const shade = piece(w, new T.SphereGeometry(0.112, 32, 22), glass, cx, 1.60, 0.18);
        shade.scale.y = 1.12;
        const lamp = new T.PointLight(0xffe5c8, 1.6, 4, 2);
        lamp.position.set(cx, 1.60, 0.30);
        w.add(lamp);
      }
    }
  }
  wall(0, -3, 0);
  wall(3.55, 0.5, -Math.PI / 2);
  wall(-3.55, 0.5, Math.PI / 2);
  const [cx, cz] = columnPosition;
  const column = new T.Group();
  column.position.set(cx, floorY, cz);
  scene.add(column);
  function drum(radius, height, y, material) {
    return piece(column, new T.CylinderGeometry(radius, radius, height, 64), material, 0, y, 0);
  }
  drum(0.137, 3.0, 1.5, walnut).castShadow = true;
  for (let i = 0; i < 24; i++) {
    const angle = Math.PI * 2 * i / 24;
    piece(column, new T.CylinderGeometry(0.012, 0.012, 2.78, 10), walnut,
      0.138 * Math.cos(angle), 1.49, 0.138 * Math.sin(angle));
  }
  drum(0.159, 0.10, 0.05, dark);
  drum(0.152, 0.018, 0.11, bronze);
  drum(0.152, 0.022, 2.88, bronze);
  scene.add(new T.HemisphereLight(0xf4f4ed, 0xaeaa98, 1.05));
  const key = new T.DirectionalLight(0xffefda, 1.75);
  key.position.set(-1.3, 2.45, 1.05);
  key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -2.45, right: 2.45, top: 2.45, bottom: -2.45, near: 0.1, far: 9 });
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.normalBias = 0.001;
  key.shadow.bias = -0.00012;
  scene.add(key);
}
