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

export const pinnedSamTakes = [
  { ...samPanoramaTake, take: "giv-sam-v4-v4",
    motion: "7e58f88f3329a9484533410f358efc482c4fc1dd0ebf381f5a652e79b6c4d0a2",
    receipt: "62c48d494a7367b8f1481bbd4b1711d8ef8e5b6f2e23aa87a9eb2c3db057c91c" },
  samPanoramaTake,
];

function playableDeal(film: FilmRecord, animation: MotionRecord, jumps: { label: string; frame?: number }[], label = film.take, receipt?: string) {
  const [numerator, denominator = 1] = film.fps.split("/").map(Number);
  const fps = numerator / denominator;
  const lastFrame = film.frames - 1;
  if (!Number.isFinite(fps) || fps <= 0 || !Number.isInteger(lastFrame) || lastFrame < 1 ||
      animation.motion.start !== 0 || Math.round(animation.motion.end * fps) !== lastFrame) return [];
  return [{ take: film.take, label, motion: animation.sha256, fps, lastFrame, receipt, appearance: film.appearance, end: film.poses?.end,
    jumps: jumps.filter(j => j.frame !== undefined && Number.isInteger(j.frame) && j.frame >= 0 && j.frame <= lastFrame) }];
}

type ReviewedSam = { film: DealerMaterial["films"][number]; animation: MotionRecord; receipt: string };

const poses = { A1: "VILA", "A2.3": "REDO" } as const;

function samPanoramaDeal(reviewed: ReviewedSam) {
  const { film, animation, receipt } = reviewed;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(film.take) || film.card !== "KORT-02" || animation.parent !== (film.appearance ?? film.geometry) ||
      animation.sha256 !== film.motion || animation.joints !== 127 || animation.motion.take !== film.take ||
      animation.motion.geometry !== film.geometry || animation.motion.appearance !== film.appearance || animation.motion.card !== film.card) return [];
  if (!hasReviewedSeatCameras({ ...film, reviews: film.reviews.filter(review => review.film === receipt) })) return [];
  const pinned = pinnedSamTakes.find(p => p.take === film.take);
  if (pinned && (receipt !== pinned.receipt || film.geometry !== pinned.geometry || film.motion !== pinned.motion || film.appearance !== pinned.appearance)) return [];
  const series = /^giv-sam-v(\d+)-v(\d+)$/.exec(film.take);
  let label = series ? "SAM-sittmodell v" + series[1] + " · givprov " + series[2] : film.take;
  if (film.poses) {
    const { start, end } = film.poses;
    if (!Object.hasOwn(poses, start) || !Object.hasOwn(poses, end)) return [];
    label += " · " + poses[start] + " → " + poses[end];
  } else if (!pinned) return [];
  const frameOf = (label: string) => film.marks.find(mark => mark.label === label)?.frame;
  return playableDeal(film, animation, [
    { label: "Utskjut", frame: frameOf("Utskjut ur skon") },
    { label: "Handbyte", frame: frameOf("Höger tar emot kortkanten") },
    { label: "Vändning", frame: frameOf("Höger vänder upp kortet") },
    { label: "Landning", frame: film.deal?.landingFrame ?? film.marks.find(mark => /^Landning på plats \d+$/.test(mark.label))?.frame },
    { label: "Släpp", frame: film.deal?.releaseFrame ?? frameOf("Höger hand lämnar kortet") },
    { label: "Blinkning", frame: frameOf("Ögonlockens slutningsmaximum") },
  ], label, receipt);
}

export function samPanoramaDeals(current: ReviewedSam | undefined, alternatives: readonly ReviewedSam[], history: readonly (ReviewedSam | undefined)[]) {
  const choices = new Map<string, ReturnType<typeof playableDeal>[number]>();
  const remaining = [...alternatives, ...history].filter(take => take !== undefined)
    .sort((a, b) => b.film.take.localeCompare(a.film.take, "sv", { numeric: true }));
  for (const reviewed of [current, ...remaining]) {
    if (!reviewed || choices.has(reviewed.receipt)) continue;
    const [deal] = samPanoramaDeal(reviewed);
    if (deal) choices.set(reviewed.receipt, deal);
  }
  return [...choices.values()];
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
