import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultBlocking,
  CONTACT,
  GRASP,
  RELEASE,
  SETTLED,
  LAST_FRAME,
  validBlocking,
} from "../lib/blocking.ts";
import { CARD, dealPose } from "../lib/deal-pose.ts";

const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);
test("fingerytorna följer kortet under greppet, även med ändrade mått", () => {
  for (const edgeMm of [-20, 20])
    for (const gapMm of [0, 18])
      for (const tiltDeg of [20, 60]) {
        for (const frame of [GRASP, 48, CONTACT, RELEASE]) {
          const p = dealPose({
            ...defaultBlocking,
            frame,
            gapMm,
            tiltDeg,
            edgeMm,
          });
          near(
            p.thumb.distanceTo(p.index) - 0.008 - 0.007,
            CARD.thickness + gapMm / 1000,
          );
          near(p.contact.x - p.center.x, edgeMm / 1000);
          near(p.shoulder.distanceTo(p.elbow), 0.31);
          near(p.elbow.distanceTo(p.wrist), 0.3);
        }
      }
});
test("framkanten vilar på filten och kortet stannar vid alla tillåtna mål", () => {
  for (const landingXcm of [-19, 19])
    for (const landingZcm of [-3, 22])
      for (const tiltDeg of [20, 60]) {
        const s = { ...defaultBlocking, tiltDeg, landingXcm, landingZcm };
        for (let frame = CONTACT; frame <= LAST_FRAME; frame++) {
          const p = dealPose({ ...s, frame });
          near(
            p.center.y -
              (CARD.depth * Math.sin(p.tilt)) / 2 -
              (CARD.thickness * Math.cos(p.tilt)) / 2,
            0,
          );
          near(
            p.center.z + (CARD.depth * Math.cos(p.tilt)) / 2,
            landingZcm / 100 + CARD.depth / 2,
          );
          if (frame >= SETTLED) {
            near(p.tilt, 0);
            near(p.center.x, landingXcm / 100);
            near(p.center.z, landingZcm / 100);
          }
          near(p.shoulder.distanceTo(p.elbow), 0.31);
          near(p.elbow.distanceTo(p.wrist), 0.3);
        }
      }
});
test("scenrevisionens gränser", () => {
  assert.equal(validBlocking(defaultBlocking), true);
  assert.equal(validBlocking({ ...defaultBlocking, gapMm: 999 }), false);
  assert.equal(validBlocking({ ...defaultBlocking, frame: 1.2 }), false);
});
