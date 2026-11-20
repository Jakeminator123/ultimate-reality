import assert from "node:assert/strict";
import test from "node:test";
import { angleDifference, bodyPixels, checkSeatedFrame, floorSpread, readSeatedMeasurement } from "../lib/seated-review.ts";

const identity = { file: "sittande/front.png", sha256: "a".repeat(64), width: 1083, height: 1452 };
const row = { file: identity.file, width: 1083, height: 1452, sourceSha256: identity.sha256 };
const edition = "fas-1/v1";
const scale = { release: edition, views: [{ ...row, crownY: 56, soleY: 1395, seatX: 343, seatY: 953 }] };
const marks = { schema: 1, release: edition, views: [{ ...row, uncertaintyPx: 2, eye: { x: 540, y: 185, landmark: "midpoint" },
  feet: [1279, 1279, 1341, 1341].map((y, i) => ({ x: 300 + 100 * i, y, visible: "centre" })) }] };

test("mätpunkter följer bildfilens hash, utgåva och originalstorlek", () => {
  const data = readSeatedMeasurement(identity, edition, scale, marks);
  assert.equal(data.marks.eye.y, 185);
  assert.equal(floorSpread(data.marks).pixels, 62);
  assert.equal(readSeatedMeasurement({ ...identity, width: 1080 }, edition, scale, marks), undefined);
  assert.equal(readSeatedMeasurement({ ...identity, sha256: "b".repeat(64) }, edition, scale, marks), undefined);
  assert.equal(readSeatedMeasurement(identity, "fas-1/v2", scale, marks), undefined);
  const stale = { ...marks, views: [{ ...marks.views[0], sourceSha256: "b".repeat(64) }] };
  assert.equal(readSeatedMeasurement(identity, edition, scale, stale).marks, undefined);
  const outside = { ...marks, views: [{ ...marks.views[0], eye: { ...data.marks.eye, y: identity.height } }] };
  assert.equal(readSeatedMeasurement(identity, edition, scale, outside).marks, undefined);
  assert.equal(floorSpread({ ...data.marks, feet: data.marks.feet.map((p, i) => i === 1 ? { ...p, visible: "edge" } : p) }), null);
  assert.equal(floorSpread(), null);
});

test("sittkontrollen använder original, skiljer skala från höjdläge och varnar på olika raster", () => {
  const front = { ...identity, seated: scale.views[0] };
  const profile = { ...front, seated: { ...front.seated, crownY: 72, soleY: 1359 } };
  assert.equal(bodyPixels(front), 1340);
  assert.equal(bodyPixels(profile), 1288);
  const check = checkSeatedFrame(profile, front);
  assert.equal(check.scaleDiffers, true);
  assert.equal(check.centreDiffers, false);
  assert.ok(Math.abs(check.scaleDelta - (-3.880597)) < 1e-5);
  assert.equal(checkSeatedFrame(profile, front, 4).review, false);
  assert.equal(checkSeatedFrame(front, front, 0).review, false);
  const shifted = { ...front, seated: { ...front.seated, crownY: 76, soleY: 1415 } };
  assert.equal(checkSeatedFrame(shifted, front).centreDiffers, true);
  assert.equal(checkSeatedFrame(shifted, front).scaleDiffers, false);
  assert.equal(checkSeatedFrame({ ...front, width: 1080 }, front, 5).formatDiffers, true);
  assert.equal(angleDifference(-180, 179), 1);
});
