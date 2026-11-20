import type { DealingStudy } from "./dealer-material";
import type { DealerMaterial } from "./material-types";

// These takes use this registered 127-joint edition even when the studio selects another avatar.
export const seatedPaulina = "9ce142c1ab2ab640fc9d7e2559f6624da88bad5506eab0c15a82c6d9049cd4db";

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
    const [numerator, denominator = 1] = film.fps.split("/").map(Number);
    const fps = numerator / denominator;
    const lastFrame = film.frames - 1;
    if (!Number.isFinite(fps) || fps <= 0 || !Number.isInteger(lastFrame) || lastFrame < 1 ||
        motion.motion.start !== 0 || Math.round(motion.motion.end * fps) !== lastFrame) return [];
    const jumps = [
      { label: "Handbyte", frame: study.handover.frame },
      { label: "Landning", frame: film.marks.find(mark => /landning/i.test(mark.label))?.frame },
      { label: "Blinkning", frame: film.marks.find(mark => /slutningsmaximum|maximal blinkning/i.test(mark.label))?.frame },
    ].filter(jump => jump.frame !== undefined && Number.isInteger(jump.frame) && jump.frame >= 0 && jump.frame <= lastFrame);
    return [{ take, motion: motion.sha256, fps, lastFrame, jumps }];
  }).sort((a, b) => b.take.localeCompare(a.take, "sv", { numeric: true }));
}
