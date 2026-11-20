import * as T from "three";
import { walnutTexture } from "../../bakgrund/salong-v1.mjs";

export const trimDepth = 0.12;
const shoulder = -0.21, railWidth = 0.062;
const paint = (color, roughness, metalness = 0) =>
  new T.MeshStandardMaterial({ color, roughness, metalness });

function textiles(layout, { onlyMarkings = false } = {}) {
  const size = 1536, span = Math.max(1.8, layout.table.radiusX * 2 + 0.20);
  const tile = document.createElement("canvas");
  tile.width = tile.height = size;
  const ctx = tile.getContext("2d");
  if (!onlyMarkings) {
    const pixels = ctx.createImageData(size, size);
    let seed = 108;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const grain = (seed / 4294967296 - 0.5) * 11;
      pixels.data[i] = 33 + grain;
      pixels.data[i + 1] = 83 + grain;
      pixels.data[i + 2] = 67 + grain;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  }
  ctx.translate(size / 2, size / 2);
  ctx.scale(size / span, size / span);
  ctx.strokeStyle = "#b7aa74";
  ctx.fillStyle = "#d3c49a";
  ctx.lineWidth = 0.00125;
  ctx.textAlign = "center";
  ctx.font = "0.031px Georgia";
  ctx.fillText("B L A C K J A C K", 0, -0.124);
  ctx.font = "0.009px Arial";
  ctx.fillText("P A Y S   3   T O   2", 0, -0.105);
  ctx.beginPath();
  ctx.ellipse(0, -0.31, 0.535, 0.29, 0, 0.33, Math.PI - 0.33);
  ctx.stroke();
  for (let i = -3; i <= 3; i++) {
    const a = i * 0.36;
    ctx.save();
    ctx.translate(0.59 * Math.sin(a), -0.176 + 0.413 * Math.cos(a));
    ctx.rotate(-a);
    ctx.beginPath();
    ctx.roundRect(-0.044, -0.028, 0.088, 0.056, 0.009);
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = "#e8ca84";
  ctx.lineWidth = 0.0021;
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const x = layout.landing.xCm / 100 + a * 0.035;
    const z = layout.landing.zCm / 100 + b * 0.048;
    ctx.beginPath();
    ctx.moveTo(x - a * 0.017, z);
    ctx.lineTo(x, z);
    ctx.lineTo(x, z - b * 0.014);
    ctx.stroke();
  }
  ctx.strokeStyle = "#c8e8d6";
  ctx.beginPath();
  const referenceZ = layout.table.referenceZ ?? layout.table.centerZ;
  ctx.moveTo(-0.012, referenceZ);
  ctx.lineTo(0.012, referenceZ);
  ctx.moveTo(0, referenceZ - 0.012);
  ctx.lineTo(0, referenceZ + 0.012);
  ctx.stroke();
  const tex = new T.CanvasTexture(tile);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 8;
  return { tex, span };
}

// Ett främre halvt ellipsvarv och en fast konkav dealerkant vid Z=−0,28.
function outline(radius, rear, front) {
  const shape = new T.Shape();
  shape.moveTo(radius, -shoulder);
  for (let i = 1; i <= 140; i++) {
    const t = i * Math.PI / 140;
    shape.lineTo(radius * Math.cos(t), -(shoulder + (front - shoulder) * Math.sin(t)));
  }
  shape.bezierCurveTo(-radius, -rear, -0.66, -rear, -0.5, -rear);
  shape.bezierCurveTo(-0.31, -rear, -0.25, 0.28, 0, 0.28);
  shape.bezierCurveTo(0.25, 0.28, 0.31, -rear, 0.5, -rear);
  shape.bezierCurveTo(0.66, -rear, radius, -rear, radius, -shoulder);
  shape.closePath();
  return shape;
}

function playerRail(radius, front, leather, stitch) {
  const pos = [], index = [], seam = [];
  const segments = 180, profile = 24;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments * Math.PI;
    const x = radius * Math.cos(t), z = shoulder + (front - shoulder) * Math.sin(t);
    const normal = new T.Vector2((front - shoulder) * Math.cos(t), radius * Math.sin(t)).normalize();
    for (let j = 0; j <= profile; j++) {
      const a = j * Math.PI * 2 / profile;
      const offset = railWidth / 2 * (Math.cos(a) - 1);
      pos.push(x + normal.x * offset, 0.009 + 0.024 * Math.sin(a), z + normal.y * offset);
      if (i < segments && j < profile) {
        const k = i * (profile + 1) + j, next = k + profile + 1;
        index.push(k, k + 1, next, k + 1, next + 1, next);
      }
    }
    if (i < segments) {
      for (const fraction of [0, 0.58]) {
        const angle = (i + fraction) / segments * Math.PI;
        const nx = new T.Vector2((front - shoulder) * Math.cos(angle), radius * Math.sin(angle)).normalize();
        seam.push(radius * Math.cos(angle) - nx.x * 0.052,
          0.0275, shoulder + (front - shoulder) * Math.sin(angle) - nx.y * 0.052);
      }
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const rail = new T.Mesh(geo, leather);
  rail.castShadow = rail.receiveShadow = true;
  const stitches = new T.BufferGeometry();
  stitches.setAttribute("position", new T.Float32BufferAttribute(seam, 3));
  rail.add(new T.LineSegments(stitches, stitch));
  // Close the two rounded roll ends at the dealer side.
  for (const side of [-1, 1]) {
    const cap = new T.Mesh(new T.SphereGeometry(1, 32, 16), leather);
    cap.scale.set(railWidth / 2, 0.024, 0.017);
    cap.position.set(side * (radius - railWidth / 2), 0.009, shoulder);
    rail.add(cap);
  }
  return rail;
}

export function buildTable(layout, shorter, cloth) {
  const { radiusX, radiusZ, centerZ } = layout.table;
  const front = centerZ + radiusZ - (shorter ? trimDepth : 0);
  const shape = outline(radiusX, centerZ - radiusZ, front);
  const group = new T.Group();
  const wood = new T.MeshStandardMaterial({ map: walnutTexture(), roughness: 0.39 });
  const brass = paint(0xc5a56a, 0.35, 0.7);
  function layer(y, thickness, material) {
    const m = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 40 }), material);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.receiveShadow = m.castShadow = true;
    group.add(m);
  }
  layer(-0.085, 0.079, wood);
  layer(-0.080, 0.0032, brass);
  layer(-0.008, 0.006, paint(0x26342a, 0.48));
  const top = new T.ShapeGeometry(shape, 40);
  const xy = top.attributes.position;
  const uv = [];
  for (let i = 0; i < xy.count; i++) uv.push(0.5 + xy.getX(i) / cloth.span, 0.5 + xy.getY(i) / cloth.span);
  top.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  const felt = new T.Mesh(top, new T.MeshStandardMaterial({ map: cloth.tex, roughness: 0.96, metalness: 0 }));
  felt.rotation.x = -Math.PI / 2;
  felt.receiveShadow = true;
  group.add(felt);
  const leather = paint(0x48342b, 0.40);
  group.add(playerRail(radiusX, front, leather, new T.LineBasicMaterial({ color: 0x8e7562 })));
  for (const x of [-0.48, 0.48]) {
    for (const [bottom, topRadius, height, y, material] of [
      [0.087, 0.101, 0.649, -0.4105, wood], [0.092, 0.092, 0.015, -0.7425, brass],
    ]) {
      const leg = new T.Mesh(new T.CylinderGeometry(topRadius, bottom, height, 48), material);
      leg.position.set(x, y, 0.01);
      leg.castShadow = leg.receiveShadow = true;
      group.add(leg);
    }
  }
  return group;
}

export { textiles };
