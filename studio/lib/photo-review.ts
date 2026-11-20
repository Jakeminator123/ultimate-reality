import { bildformat } from "../fotomall/bildformat";
import { bildrecept } from "../fotomall/bildrecept";
import type { DealerMaterial, Photo } from "./material-types";

export type PhotoReview = {
  decision: "usable" | "limited";
  note: string;
  cardPrint?: string;
};

export function verifiedPhotoReview(record: unknown, edition: string, file: string, sha256: string): PhotoReview | undefined {
  if (!record || typeof record !== "object" || !("schema" in record) || record.schema !== 1 ||
    !("edition" in record) || record.edition !== edition || !("views" in record) || !Array.isArray(record.views)) return;
  const matches = record.views.filter(s => s?.file === file && s.sha256 === sha256);
  if (matches.length !== 1) return;
  const row = matches[0];
  if (!["usable", "limited"].includes(row.decision) || typeof row.note !== "string" || !row.note.trim() ||
    (row.cardPrint !== undefined && (typeof row.cardPrint !== "string" || !row.cardPrint.trim()))) return;
  return { decision: row.decision, note: row.note, cardPrint: row.cardPrint };
}

export function modelPhotoRoles(photo: Photo, project: DealerMaterial) {
  return [...(project.geometry?.sources ?? []), ...(project.appearance?.sources ?? [])]
    .filter(s => s.sha256 === photo.sha256).map(s => s.role);
}

export function reviewPhotoSeries(project: DealerMaterial) {
  return bildrecept.map(recipe => {
    const photo = project.photos.find(p => p.id === recipe.id);
    const target = bildformat[recipe.formatnyckel];
    const usesCard = recipe.grupp === "Händer" || recipe.grupp === "Rörelsereferens";
    return { recipe, photo, target, usesCard, roles: photo ? modelPhotoRoles(photo, project) : [],
      exactDelivery: !!photo && photo.format === "PNG" && photo.width + ":" + photo.height === target.ratio };
  });
}
