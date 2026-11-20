import assert from "node:assert/strict";
import test from "node:test";
import { panoramaDeals, samPanoramaDeal, samPanoramaTake } from "../lib/panorama-deals.ts";

test("SAM-scenprovet använder givens egen kropp, fotoyta och tidslinje", () => {
  const { take, geometry, appearance, motion } = samPanoramaTake;
  const film = { take, geometry, appearance, motion, card: "KORT-02", frames: 54, fps: "24", marks: [
    { frame: 4, label: "Utskjut ur skon" }, { frame: 9, label: "Höger tar emot kortkanten" },
    { frame: 16, label: "Höger vänder upp kortet" }, { frame: 22, label: "Landning på plats 4" },
    { frame: 46, label: "Ögonlockens slutningsmaximum" },
  ] };
  const animation = { sha256: motion, joints: 127, motion: { take, geometry, appearance, card: film.card, start: 0, end: 53/24 } };
  const [deal] = samPanoramaDeal({ film, animation });
  assert.equal(deal.motion, motion);
  assert.deepEqual(deal.jumps.map(j => j.frame), [4, 9, 16, 22, 46]);
  assert.deepEqual(samPanoramaDeal(), []);
  for (const change of [{ geometry: "annan kropp" }, { appearance: "tidigare fotoyta" }, { motion: "tidigare giv" }, { frames: 55 }]) {
    assert.deepEqual(samPanoramaDeal({ film: { ...film, ...change }, animation }), []);
  }
  assert.deepEqual(samPanoramaDeal({ film, animation: { ...animation, motion: { ...animation.motion, appearance: "annan fotoyta" } } }), []);
});

test("panoramat föredrar en styrkt ny giv och behåller den tidigare tagningen", () => {
  const rig = { geometry: "kropp", appearance: "fotoyta" };
  const first = { take: "samspel-v2-v1", motion: "a".repeat(64), movie: "b".repeat(64) };
  const second = { take: "samspel-v2-v2", motion: "c".repeat(64), movie: "d".repeat(64) };
  const studies = [first, second].map(row => ({ ...rig, takes: [row], handover: { frame: 15 } }));
  const material = {
    geometry: { sha256: rig.geometry }, appearance: { sha256: rig.appearance },
    motions: [first, second].map(row => ({
      joints: 127, sha256: row.motion, motion: { ...rig, take: row.take, card: "KORT-02", start: 0, end: 53 / 24 },
    })),
    films: [first, second].map(row => ({
      ...row, ...rig, card: "KORT-02", sha256: row.movie, frames: 54, fps: "24/1",
      cameras: [{ id: "Stol 4" }, { id: "Stol 1" }], reviews: [{ camera: "Stol 4" }, { camera: "Stol 1" }],
      marks: [{ label: "Landning på plats 4", frame: 26 }, { label: "Ögonlockens slutningsmaximum", frame: 46 }],
    })),
  };
  const choices = panoramaDeals(material, studies);
  assert.deepEqual(choices.map(c => c.motion), [second.motion, first.motion]);
  assert.deepEqual(choices[0].jumps.map(j => j.frame), [15, 26, 46]);
  const originalJumps = choices[0].jumps;
  const press = { label: "Utskjut ur skon", frame: 4 };
  const turn = { label: "Höger vänder upp kortet", frame: 21 };
  const timedStudy = { ...studies[1], draw: { pressFrame: press.frame }, turn: { frame: turn.frame } };
  function jumpsFor(study, extraMarks) {
    const film = { ...material.films[1], marks: [...material.films[1].marks, ...extraMarks] };
    return panoramaDeals({ ...material, films: [film] }, [study])[0].jumps;
  }
  const pushJump = { label: "Utskjut", frame: press.frame };
  const turnJump = { label: "Vändning", frame: turn.frame };
  assert.deepEqual(jumpsFor(timedStudy, [press, turn]), [pushJump, originalJumps[0], turnJump, ...originalJumps.slice(1)]);
  assert.deepEqual(jumpsFor(timedStudy, [turn, { ...press, frame: 5 }]), [originalJumps[0], turnJump, ...originalJumps.slice(1)]);
  assert.deepEqual(jumpsFor({ ...timedStudy, turn: undefined }, [press, turn]), [pushJump, ...originalJumps]);
  assert.deepEqual(jumpsFor(studies[1], [press, turn]), originalJumps);
  assert.deepEqual(jumpsFor(timedStudy, [{ ...turn, label: "Annan händelse" }]), originalJumps);
  for (const incomplete of [
    panoramaDeals(material, studies.slice(0, 1)),
    panoramaDeals({ ...material, motions: material.motions.slice(0, 1) }, studies),
    panoramaDeals({ ...material, films: material.films.slice(0, 1) }, studies),
    panoramaDeals({ ...material, films: [material.films[0], { ...material.films[1], reviews: [{ camera: "Stol 4" }] }] }, studies),
    panoramaDeals(material, [studies[0], { ...studies[1], appearance: "annan fotoyta" }]),
  ]) assert.deepEqual(incomplete.map(c => c.take), [first.take]);
  const later = { take: "samspel-v2-v10", motion: "e".repeat(64), movie: "f".repeat(64) };
  const laterMotion = { ...material.motions[0], sha256: later.motion, motion: { ...material.motions[0].motion, take: later.take } };
  const laterFilm = { ...material.films[0], ...later, sha256: later.movie };
  const withLater = panoramaDeals({
    ...material, motions: [...material.motions, laterMotion], films: [...material.films, laterFilm],
  }, [...studies, { ...studies[0], takes: [later] }]);
  assert.deepEqual(withLater.map(c => c.take), [later.take, second.take, first.take]);
});
