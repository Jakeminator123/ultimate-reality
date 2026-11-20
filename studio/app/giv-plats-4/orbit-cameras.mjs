// Bearing, X/Z centre and radius follow prov-ankare/v1/kameror/kameror.json.
export const positions = 120;
export const stepDeg = 360 / positions;
export const aspect = 16 / 9;

export function orbitIndex(value) {
  if (!Number.isFinite(value)) return 0;
  return ((Math.round(value) % positions) + positions) % positions;
}

// The taller crown matched to original 03 needs more headroom in the high side view.
export function sideFieldOfView(scene) {
  return scene?.hairOriginal03 ? 33 : 31;
}

export function tableView(index, sideFov = 31) {
  const azimuthDeg = orbitIndex(index) * stepDeg;
  const radians = azimuthDeg * Math.PI / 180;
  const t = Math.min(Math.min(azimuthDeg, 360 - azimuthDeg) / 70, 1);
  const blend = t * t * (3 - 2 * t);
  const heightM = 1.4 + .392 * blend;
  return {
    azimuthDeg, verticalFovDeg: 40 + (sideFov - 40) * blend, heightM,
    positionM: [.072 + 1.62 * Math.sin(radians), heightM, .233 + 1.62 * Math.cos(radians)],
    lookAtM: [.072, .82 + .042 * blend, .233]
  };
}
