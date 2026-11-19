import { Vector3 } from "three";
import type { Blocking } from "./blocking.ts";
import { CONTACT, GRASP, RELEASE, SETTLED } from "./blocking.ts";

export const CARD = { width: 0.063, depth: 0.089, thickness: 0.0004 };
const start = new Vector3(-0.237, 0, -0.175);
const X = new Vector3(1, 0, 0);
const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
function smooth(frame: number, from: number, to: number) {
  const t = Math.max(0, Math.min(1, (frame - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

// Coordinates are metres, Y is up, positive Z is toward seat 4. The card
// touches down on its far short edge; its centre shifts as it rolls flat.
export function dealPose(s: Blocking) {
  const f = s.frame,
    carry = smooth(f, GRASP, CONTACT),
    settle = smooth(f, RELEASE, SETTLED);
  const tilt = ((s.tiltDeg * Math.PI) / 180) * (1 - settle);
  const target = v(s.landingXcm / 100, 0, s.landingZcm / 100);
  const center = start.clone().lerp(target, carry);
  center.z += (carry * CARD.depth * (1 - Math.cos(tilt))) / 2;
  center.y =
    0.032 * (1 - carry) +
    0.09 * Math.sin(carry * Math.PI) +
    (CARD.depth * Math.sin(tilt)) / 2 +
    (CARD.thickness * Math.cos(tilt)) / 2;
  const normal = v(0, 1, 0).applyAxisAngle(X, tilt);
  const onCard = (x: number, y: number, z: number) =>
    v(x, y, z).applyAxisAngle(X, tilt).add(center);
  const contact = onCard(s.edgeMm / 1000, 0, -CARD.depth / 2 + 0.006);
  const returning = smooth(f, RELEASE, 113);
  const waiting = 1 - smooth(f, 3, GRASP);
  const hold = contact
    .clone()
    .lerp(v(-0.16, 0.107, -0.28), Math.max(waiting, returning));
  hold.y += 0.055 * Math.sin(returning * Math.PI);
  const opening =
    s.gapMm / 1000 + 0.026 * Math.max(waiting, smooth(f, RELEASE, SETTLED));
  // Fingertip centres include their radii. Zero extra gap puts the surfaces
  // on opposite faces of the card. Lift both fingertips on release.
  hold.y += 0.023 * smooth(f, RELEASE, SETTLED) * (1 - returning);
  const thumb = hold
    .clone()
    .addScaledVector(normal, 0.008 + (CARD.thickness + opening) / 2);
  const index = hold
    .clone()
    .addScaledVector(normal, -0.007 - (CARD.thickness + opening) / 2);
  const palm = hold.clone().add(v(-0.018, 0.026, -0.06));
  const lean = 0.14 * carry * (1 - returning);
  const shoulder = v(-0.148, 0.337, -0.345 + lean);
  const wrist = palm.clone().add(v(-0.01, 0.005, -0.047));
  // Two-link IK with an outward elbow pole and fixed upper/forearm lengths.
  const axis = wrist.clone().sub(shoulder);
  const length = axis.length();
  axis.normalize();
  const along = (0.31 ** 2 - 0.3 ** 2 + length ** 2) / (2 * length);
  const pole = v(-1, -0.65, -0.1);
  pole.addScaledVector(axis, -pole.dot(axis)).normalize();
  const elbow = shoulder
    .clone()
    .addScaledVector(axis, along)
    .addScaledVector(pole, Math.sqrt(Math.max(0, 0.31 ** 2 - along ** 2)));
  return {
    center,
    tilt,
    target,
    thumb,
    index,
    palm,
    wrist,
    elbow,
    shoulder,
    lean,
    contact,
  };
}
