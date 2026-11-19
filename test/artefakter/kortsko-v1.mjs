import * as T from "three";

// Filtkontakt Y=0. Öppningen mot +Z ligger på samma sida som studions kortbana.
export function addShoe(scene, anchor) {
  const shoe = new T.Group();
  shoe.position.set(anchor.x, 0, anchor.z);
  scene.add(shoe);
  const wood = new T.MeshStandardMaterial({ color: 0x483028, roughness: 0.34 });
  const edge = new T.MeshStandardMaterial({ color: 0xa58146, metalness: 0.62, roughness: 0.29 });
  const cards = new T.MeshStandardMaterial({ color: 0xf2e9d5, roughness: 0.83 });
  const box = new T.BoxGeometry(1, 1, 1);
  function block(mat, x, y, z, w, h, d) {
    const mesh = new T.Mesh(box, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    shoe.add(mesh);
    return mesh;
  }
  block(wood, 0, 0.005, 0, anchor.width, 0.01, anchor.depth);
  for (const side of [-1, 1]) {
    const profile = new T.Shape();
    const half = anchor.depth / 2;
    // Local X becomes world +Z; local extrusion points toward world -X.
    profile.moveTo(-half, 0.008);
    profile.lineTo(half, 0.008);
    profile.lineTo(half, 0.018);
    profile.lineTo(-0.032, 0.078);
    profile.lineTo(-half, 0.078);
    profile.closePath();
    const mesh = new T.Mesh(new T.ExtrudeGeometry(profile, { depth: 0.005, bevelEnabled: false }), wood);
    mesh.rotation.y = -Math.PI / 2;
    mesh.position.x = side < 0 ? -anchor.width / 2 + 0.005 : anchor.width / 2;
    mesh.castShadow = mesh.receiveShadow = true;
    shoe.add(mesh);
  }
  block(wood, 0, 0.042, -0.071, 0.073, 0.070, 0.007);
  const deck = block(cards, 0, 0.028, -0.004, 0.063, 0.029, 0.095);
  deck.rotation.x = 0.27;
  for (let i = 0; i < 7; i++) {
    const line = block(edge, 0, 0.011 + i * 0.0024, 0.040 + i * 0.0005, 0.062, 0.00034, 0.00035);
    line.castShadow = false;
  }
  block(edge, 0, 0.013, 0.071, 0.069, 0.005, 0.005);
}
