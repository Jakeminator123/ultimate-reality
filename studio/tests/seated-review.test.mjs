import assert from "node:assert/strict";
import test from "node:test";
import { hasReviewedSeatCameras } from "../lib/material-types.ts";
import { angleDifference, bodyPixels, checkSeatedFrame, floorSpread, readSeatedMeasurement } from "../lib/seated-review.ts";

const identity = { file: "sittande/front.png", sha256: "a".repeat(64), width: 1083, height: 1452 };
const row = { file: identity.file, width: 1083, height: 1452, sourceSha256: identity.sha256 };
const edition = "fas-1/v1";

test("en giv kräver kameraunderlag och giltiga granskningsrutor från båda stolarna", () => {
  const seats = ["Stol 4", "Stol 1"];
  const film = {
    frames: 54,
    cameras: seats.map(id => ({ id, samples: [{ frame: 0 }] })),
    reviews: seats.map(camera => ({ schema: 1, camera, note: "Kortet ligger på filten.", frames: [22, 53] })),
  };
  assert.equal(hasReviewedSeatCameras(film), true);
  assert.equal(hasReviewedSeatCameras({ ...film, reviews: [film.reviews[0], film.reviews[0]] }), false);
  assert.equal(hasReviewedSeatCameras({ ...film, cameras: [film.cameras[0], { id: "Stol 1" }] }), false);
  assert.equal(hasReviewedSeatCameras({ ...film, reviews: [film.reviews[0], { ...film.reviews[1], frames: [54] }] }), false);
  assert.equal(hasReviewedSeatCameras({ ...film, reviews: [film.reviews[0], { ...film.reviews[1], note: "" }] }), false);
});

const scale = { release: edition, views: [{ ...row, crownY: 56, soleY: 1395, seatX: 343, seatY: 953 }] };
const marks = { schema: 1, release: edition, views: [{ ...row, uncertaintyPx: 2, eye: { x: 540, y: 185, landmark: "midpoint" },
  feet: [1279, 1279, 1341, 1341].map((y, i) => ({ x: 300 + 100 * i, y, visible: "centre" })) }] };

test("mätpunkter följer bildfilens hash, utgåva och originalstorlek", () => {
  const data = readSeatedMeasurement(identity, edition, scale, marks);
  assert.equal(data.marks.eye.y, 185);
  assert.equal(floorSpread(data.marks).pixels, 62);
  assert.equal(floorSpread(data.marks).widthPixels, 300);
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

test("stolens spann i x och y använder bara synliga mittpunkter", () => {
  const profileMarks = { ...marks.views[0], feet: [
    { x: 384, y: 1306, visible: "edge" }, { x: 390, y: 1358, visible: "centre" },
    { x: 798, y: 1305, visible: "edge" }, { x: 819, y: 1356, visible: "centre" },
  ] };
  assert.equal(floorSpread(profileMarks), null);
  assert.deepEqual(floorSpread(profileMarks, 2), {
    left: 390, right: 819, top: 1356, bottom: 1358, widthPixels: 429, pixels: 2, centres: 2,
  });
  assert.equal(floorSpread({ ...profileMarks, feet: profileMarks.feet.slice(0, 3) }, 2), null);
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
