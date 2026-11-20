import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dealReferences, placedCardReference, referencesForTake } from "../lib/deal-references.ts";

test("fingerreferens och tidsreferens kan vara olika filmer i samma tagning", async () => {
  const previous = JSON.parse(await readFile(new URL("../../information/paulina-rorelseunderlag-v3.json", import.meta.url), "utf8"));
  assert.equal(previous.handReference.sha256, placedCardReference.sha256);
  assert.deepEqual(referencesForTake(previous.timing.referenceSha256), dealReferences);
  const [original] = referencesForTake(placedCardReference.sha256);
  assert.equal(original.file.split("/").pop(), "pos4-v.mp4");
  assert.deepEqual([original.draw, original.push, original.handover, original.turn, original.release, original.rest].map(t => t * 24), [0, 5, 9, 16, 25, 38]);
  assert.equal(referencesForTake(placedCardReference.sha256).length, 1);
  assert.deepEqual(referencesForTake(), []);
  assert.deepEqual(referencesForTake("0".repeat(64)), []);
});
