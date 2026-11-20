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
import shoe from "../lib/card-shoe.json" with { type: "json" };
import { Euler, Vector3 } from "three";

const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);
test("kortet lämnar den lutande skon in mot bordets mitt och går fritt från filt och sidokanter", () => {
  const yaw = shoe.yawDegrees * Math.PI / 180;
  const feed = shoe.feedAngleDegrees * Math.PI / 180;
  const axis = new Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const origin = new Vector3(shoe.shoeCenterXZ[0],0,shoe.shoeCenterXZ[1]);
  assert.ok(axis.x < 0 && axis.z < 0);
  for (let frame=0; frame<=15; frame++) {
    const p = dealPose({...defaultBlocking,frame});
    const rotation = new Euler(p.tilt,p.yaw,0,"YXZ");
    for (const x of [-CARD.width/2,CARD.width/2]) for (const z of [-CARD.depth/2,CARD.depth/2]) {
      const corner = new Vector3(x,-CARD.thickness/2,z).applyEuler(rotation).add(p.center);
      const local = corner.clone().sub(origin).applyAxisAngle(new Vector3(0,1,0),-yaw);
      assert.ok(corner.y >= -1e-8 && Math.abs(local.x) < .034);
      if (local.z <= shoe.mouthZ)
        assert.ok(local.y >= shoe.cardTopY+(shoe.mouthZ-local.z)*Math.tan(feed)-.001);
      if (frame===15) assert.ok(local.z>shoe.mouthZ);
    }
  }
});
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
