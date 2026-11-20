import type { DealingStudy } from "./dealer-material";
import type { DealerMaterial, FilmRecord, MotionRecord } from "./material-types";
import { hasReviewedSeatCameras } from "./material-types.ts";

// These takes use this registered 127-joint edition even when the studio selects another avatar.
export const seatedPaulina = "9ce142c1ab2ab640fc9d7e2559f6624da88bad5506eab0c15a82c6d9049cd4db";

export const samPanoramaTake = {
  take: "giv-sam-v4-v3",
  geometry: "fc3b1388104fed3ee82a9ac0f548e4cf36d9a71fdb98a43c4890fb4a879ac495",
  appearance: "5c30d34f2f5f4eece06af94d7477685a8608741f214e3caacd3a1757fd01296c",
  motion: "9fe46a6d7b8fc2fff684c0a7fd032c8ae28015e8d332374b7918601faf2905e8",
  receipt: "71d78d156fd0597d7c1818ad1d624910b3469a25c3e1fa8a41062cb6f68ca03e",
};

function playableDeal(film: FilmRecord, animation: MotionRecord, jumps: { label: string; frame?: number }[]) {
  const [numerator, denominator = 1] = film.fps.split("/").map(Number);
  const fps = numerator / denominator;
  const lastFrame = film.frames - 1;
  if (!Number.isFinite(fps) || fps <= 0 || !Number.isInteger(lastFrame) || lastFrame < 1 ||
      animation.motion.start !== 0 || Math.round(animation.motion.end * fps) !== lastFrame) return [];
  return [{ take: film.take, motion: animation.sha256, fps, lastFrame,
    jumps: jumps.filter(j => j.frame !== undefined && Number.isInteger(j.frame) && j.frame >= 0 && j.frame <= lastFrame) }];
}

type ReviewedSam = { film: DealerMaterial["films"][number]; animation: MotionRecord; receipt: string };

function samPanoramaDeal(reviewed: ReviewedSam | undefined) {
  if (!reviewed) return [];
  const { film, animation, receipt } = reviewed;
  if (!/^giv-sam-v4-v[1-9]\d*$/.test(film.take) || film.card !== "KORT-02" || film.geometry !== samPanoramaTake.geometry ||
      !film.appearance || animation.parent !== film.appearance ||
      animation.sha256 !== film.motion || animation.joints !== 127 || animation.motion.take !== film.take ||
      animation.motion.geometry !== film.geometry || animation.motion.appearance !== film.appearance || animation.motion.card !== film.card) return [];
  if (!hasReviewedSeatCameras({ ...film, reviews: film.reviews.filter(review => review.film === receipt) })) return [];
  const frameOf = (label: string) => film.marks.find(mark => mark.label === label)?.frame;
  return playableDeal(film, animation, [
    { label: "Utskjut", frame: frameOf("Utskjut ur skon") },
    { label: "Handbyte", frame: frameOf("Höger tar emot kortkanten") },
    { label: "Vändning", frame: frameOf("Höger vänder upp kortet") },
    { label: "Landning", frame: frameOf("Landning på plats 4") },
    { label: "Blinkning", frame: frameOf("Ögonlockens slutningsmaximum") },
  ]);
}

export function samPanoramaDeals(frozen?: ReviewedSam, current?: ReviewedSam) {
  const pinned = frozen?.receipt === samPanoramaTake.receipt && frozen.film.take === samPanoramaTake.take &&
    frozen.film.motion === samPanoramaTake.motion && frozen.film.appearance === samPanoramaTake.appearance
    ? samPanoramaDeal(frozen) : [];
  const currentVersion = current?.film.take.match(/^giv-sam-v4-v([1-9]\d*)$/)?.[1];
  return Number(currentVersion) > 3 ? [...samPanoramaDeal(current), ...pinned] : pinned;
}

export function panoramaDeals(material: DealerMaterial, studies: DealingStudy[]) {
  return material.films.flatMap(film => {
    const { take, geometry, appearance } = film;
    if (!/^samspel-v2-v[1-9]\d*$/.test(take) || film.card !== "KORT-02" ||
        geometry !== material.geometry?.sha256 || appearance !== material.appearance?.sha256) return [];
    const reviewed = ["Stol 4", "Stol 1"].every(id =>
      film.cameras.some(camera => camera.id === id) && film.reviews.some(review => review.camera === id));
    if (!reviewed) return [];
    const study = studies.find(s => s.geometry === geometry && s.appearance === appearance &&
      s.takes.some(row => row.take === take && row.movie === film.sha256 && row.motion === film.motion));
    if (!study) return [];
    const motion = material.motions.find(m => m.sha256 === film.motion && m.joints === 127 && m.motion.take === take &&
      m.motion.geometry === geometry && m.motion.appearance === appearance && m.motion.card === film.card);
    if (!motion) return [];
    return playableDeal(film, motion, [
      { label: "Utskjut", frame: film.marks.find(mark => mark.frame === study.draw?.pressFrame && /utskjut/i.test(mark.label))?.frame },
      { label: "Handbyte", frame: study.handover.frame },
      { label: "Vändning", frame: film.marks.find(mark => mark.frame === study.turn?.frame && /vänd(?:er|ning)/i.test(mark.label))?.frame },
      { label: "Landning", frame: film.marks.find(mark => /landning/i.test(mark.label))?.frame },
      { label: "Blinkning", frame: film.marks.find(mark => /slutningsmaximum|maximal blinkning/i.test(mark.label))?.frame },
    ]);
  }).sort((a, b) => b.take.localeCompare(a.take, "sv", { numeric: true }));
}
