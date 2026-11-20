import * as T from "three";

export function createContactShadows(table) {
  const shadows = new T.Group();
  const floorY = new T.Box3().setFromObject(table).min.y;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  // The darkest part lies under the brass foot. The soft edge falls onto the photo.
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(0,0,0,0.58)");
  gradient.addColorStop(0.42, "rgba(0,0,0,0.48)");
  gradient.addColorStop(0.57, "rgba(0,0,0,0.22)");
  gradient.addColorStop(0.8, "rgba(0,0,0,0.06)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const material = new T.MeshBasicMaterial({
    map: new T.CanvasTexture(canvas), transparent: true, depthWrite: false, toneMapped: false,
  });
  for (const mesh of table.children) {
    if (mesh.geometry?.type !== "CylinderGeometry") continue;
    const { height, radiusBottom } = mesh.geometry.parameters;
    if (Math.abs(mesh.position.y - height / 2 - floorY) > 0.0001) continue;
    const diameter = 2 * radiusBottom / 0.42;
    const shadow = new T.Mesh(new T.PlaneGeometry(diameter, diameter), material);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(mesh.position.x, floorY - 0.0001, mesh.position.z);
    shadows.add(shadow);
  }
  return shadows;
}
