import assert from "node:assert/strict";
import test from "node:test";
import { chooseDealVersions } from "../lib/deal-versions.ts";

const take = (n, patch = {}) => ({ take: "giv-v" + n, receipt: "r" + n, geometry: "kropp", appearance: "fotoyta",
  card: "KORT-02", targetSeat: 4, startPose: "A2.3", endPose: "A2.3", ...patch });

test("valt slutmål behålls när en nyare granskad giv registreras", () => {
  const six = take(6), ten = take(10), five = take(5, { endPose: "A1" });
  const result = chooseDealVersions([six, five, ten, ten], six.receipt);
  assert.equal(result.defaultAction, ten);
  assert.deepEqual(result.current, [five, ten]);
  assert.deepEqual(result.previous, [six]);
  assert.equal(chooseDealVersions([six, ten, five], five.receipt).defaultAction, five);
});

test("varje kropp, fotoyta, kort, plats, givserie och startpose har ett eget val", () => {
  const base = take(1);
  for (const patch of [{ geometry: "annan" }, { appearance: null }, { card: "KORT-03" }, { targetSeat: 1 },
    { take: "annan-v2" }, { startPose: "A1" }, { take: "annan" }]) {
    const next = take(2, patch);
    assert.deepEqual(new Set(chooseDealVersions([next, base]).current), new Set([base, next]));
  }
  const duplicate = { ...base, receipt: "tidigare" };
  assert.deepEqual(chooseDealVersions([base, duplicate], duplicate.receipt).previous, [base]);
});
