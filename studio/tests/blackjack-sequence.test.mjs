import assert from "node:assert/strict";
import test from "node:test";
import { blackjackAction, composeBlackjackSequence } from "../lib/blackjack-sequence.ts";

const receipt = "a".repeat(64), geometry = "b".repeat(64), appearance = "c".repeat(64), motion = "d".repeat(64);
function fixture() {
  const take = "giv-fran-sko-v1", card = "prokort", cameras = ["Stol 1", "Stol 4"];
  return { receipt, film: { take, card, motion, geometry, appearance, fps: "24", frames: 54,
    cameras: cameras.map(id => ({ id, samples: [{ frame: 0 }] })),
    reviews: cameras.map(camera => ({ film: receipt, schema: 1, camera, note: "Kontrollerad", frames: [9, 22] })),
    poses: { start: "A2.3", end: "A2.3" },
    marks: [{ label: "Landning på plats 2", frame: 22 }, { label: "Höger hand lämnar kortet", frame: 25 }] },
    animation: { kind: "motion", parent: appearance, sha256: motion,
      motion: { geometry, appearance, take, card, start: 0, end: 53 / 24 } } };
}

test("mål och kontaktrutor är bundna till granskad film, även i äldre kvitton", () => {
  const take = fixture();
  assert.equal(blackjackAction("mira", take).targetSeat, 2);
  assert.equal(blackjackAction("mira", { ...take, film: { ...take.film,
    photoLayer: { sourceFilm: receipt, sourceMotion: motion, parts: ["Hår"] } } }), null);
  take.film.deal = { targetSeat: 6, landingFrame: 14, releaseFrame: 15 };
  take.film.marks = [];
  assert.equal(blackjackAction("mira", take).targetSeat, 6);
  take.film.deal.releaseFrame = 14;
  assert.equal(blackjackAction("mira", take), null);
  take.film.deal.releaseFrame = 15;
  take.film.reviews[1].film = "f".repeat(64);
  assert.equal(blackjackAction("mira", take), null);
});

test("varje kort får en egen instans och bildrutor även när samma giv återanvänds", () => {
  const redo = blackjackAction("mira", fixture());
  const vila = { ...redo, receipt: "f".repeat(64), endPose: "A1" };
  const steps = [{ receipt: redo.receipt }, { receipt: redo.receipt, face: "7h" }, { receipt: vila.receipt }];
  const s = composeBlackjackSequence("mira", { name: "Tre kort", steps }, [redo, vila]);
  assert.equal(s.durationSeconds, 6.75);
  assert.deepEqual(s.steps.map(x => [x.cardInstance, x.firstFrame, x.lastFrame, x.face]),
    [[1, 0, 53, undefined], [2, 54, 107, "7H"], [3, 108, 161, undefined]]);
  assert.equal(s.endPose, "A1");
  assert.throws(() => composeBlackjackSequence("mira", { name: "Fel", steps: steps.reverse() }, [redo, vila]), /slutar i A1/);
  for (const changed of [{ geometry: "e".repeat(64) }, { appearance: null }, { appearanceStudy: "e".repeat(64) }]) {
    assert.throws(() => composeBlackjackSequence("mira", { name: "Fel kropp", steps: [{ receipt }, { receipt: vila.receipt }] },
        [redo, { ...vila, ...changed }]), /samma kropp/);
  }
  assert.throws(() => composeBlackjackSequence("mira", { name: "Fel kort", steps: [{ receipt, face: "15H" }] }, [redo]), /valör/);
  assert.throws(() => composeBlackjackSequence("mira", { name: "Okänt kvitto", steps: [{ receipt: "?" }] }, [redo]), /saknas/);
});
