import * as T from "three";

// Provmått i meter. Markerna har sex inlägg som följer kanten runt varje skiva.
export function buildChips() {
  const group = new T.Group();
  const white = new T.MeshStandardMaterial({ color: 0xece6cc, roughness: .71 });
  const colors = [0x8d3837, 0x4c695b].map(color => new T.MeshStandardMaterial({ color, roughness: .76 }));
  const radius = .0195, height = .0033;
  const disc = new T.CylinderGeometry(radius, radius, height, 64);
  const ring = new T.RingGeometry(.012, .0127, 48);
  const insert = new T.CylinderGeometry(radius + .00005, radius + .00005, height * .91, 8, 1, false, 0, .22);
  for (let stack = 0; stack < 2; stack++) {
    const count = stack === 0 ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const chip = new T.Mesh(disc, colors[stack]);
      chip.position.set(stack * .048, height * (i + .5), 0);
      chip.rotation.y = i * .31;
      chip.castShadow = chip.receiveShadow = true;
      for (let k = 0; k < 6; k++) {
        const pip = new T.Mesh(insert, white);
        pip.rotation.y = k * Math.PI / 3;
        chip.add(pip);
      }
      if (i === count - 1) {
        const face = new T.Mesh(ring, white);
        face.rotation.x = -Math.PI / 2;
        face.position.y = height / 2 + .00008;
        chip.add(face);
      }
      group.add(chip);
    }
  }
  group.position.set(-.54, .0015, .17);
  return group;
}

export function buildGlass() {
  const profile = [[.0001,0],[.032,0],[.035,.003],[.0355,.013],[.037,.052],[.038,.060],[.040,.101],
    [.0399,.1035],[.0395,.104],[.0381,.104],[.0378,.1035],[.0375,.102],[.0315,.009],[.0001,.009]
  ].map(([r,y]) => new T.Vector2(r,y));
  const geometry = new T.LatheGeometry(profile, 160);
  // Shallow flutes in the outside of the base break up reflected light. The inner wall stays smooth.
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const level = i % profile.length;
    if (level < 2 || level > 4) continue;
    const x = positions.getX(i), z = positions.getZ(i);
    const flute = .0009 * (.5 + .5 * Math.cos(20 * Math.atan2(x, z)));
    const factor = 1 + flute / profile[level].x;
    positions.setXYZ(i, x * factor, positions.getY(i), z * factor);
  }
  geometry.computeVertexNormals();
  const cup = new T.Mesh(geometry, new T.MeshPhysicalMaterial({
    color: 0xffffff, roughness: .035, metalness: 0, transmission: 1, ior: 1.51, thickness: .006,
    envMapIntensity: 1.25, side: T.DoubleSide,
  }));
  cup.position.set(-.66, .0015, -.10);
  return cup;
}
