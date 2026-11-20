import type { GranskadVy } from "../fotomall/bildserie";
import type { ActiveDealerModel } from "./modeling";
import type { SeatedMeasurement } from "./seated-review";
import type { PhotoReview } from "./photo-review";

export type Size = [number, number];
export type Processing = {
  estimateSha256: string; original: Size; prepared: Size;
  crop: { body: Size; hand: Size; evidence: "saved-run" | "installed-config"; configSha256: string; estimatorSha256?: string } | null;
};
type Source = { photo: string; sha256: string; role: "geometry" | "posture" | "surface"; processing?: Processing | null };
export type ModelRecord = {
  schema: 1; sha256: string; kind: "geometry" | "appearance" | "motion"; parent: string | null;
  run: string | null; joints: number; atlas: Size | null; sources: Source[];
};
export type FilmRecord = {
  schema: 1; sha256: string; take: string; title: string; geometry: string; appearance: string | null;
  card: string | null; width: number; height: number; frames: number; fps: string; codec: string;
  cameras: { id: string; projection?: string; samples: { frame: number; azimuth?: number; elevation?: number; distance?: number; zoom?: number }[] }[];
  marks: { frame: number; label: string; seconds?: number }[];
  motion?: string;
  poses?: { start: "A1" | "A2.3"; end: "A1" | "A2.3" };
  deal?: { targetSeat: number; landingFrame: number; releaseFrame: number };
  photoLayer?: { sourceFilm: string; sourceMotion: string; parts: string[] };
  appearanceStudy?: string;
};
export type MotionRecord = ModelRecord & { motion: {
  geometry: string; appearance: string | null; take: string; card: string | null; pathSha256: string;
  start: number; end: number; keyframes: number; components?: string[];
  faceSurface?: { revision: string; baseAppearanceSHA256: string; sourceBodyAtlasSHA256: string;
    bodyAtlasSHA256: string; photos: Record<string, string> };
} };
export type FilmReview = { schema: 1; film: string; camera: string; frames: number[]; note: string };
export type Photo = {
  id: string; file: string; group: string; name: string; kind: string; sha256: string; url: string;
  width: number; height: number; format: string; targetAngle?: number; observed?: GranskadVy; seated?: SeatedMeasurement; review?: PhotoReview;
};
export type Edition = {
  schema: 1; id: string; name: string; edition: string; geometry: string; appearance: string | null;
  photoRegister: string; geometryRecord: string; appearanceRecord: string | null;
};
export type TrialFilmSummary = Pick<FilmRecord, "take" | "sha256" | "poses" | "photoLayer" | "appearanceStudy"> & { url: string };
export type DealerMaterial = {
  dealer: string; edition: string; revision: string | null; stamp: string; versions: { key: string; name: string }[];
  photos: Photo[]; issues: string[]; activeModel: ActiveDealerModel | null;
  motionTrialUrl?: string;
  seatedTrial?: { id: string; name: string; film?: TrialFilmSummary; films?: TrialFilmSummary[] };
  geometry: ModelRecord | null; appearance: ModelRecord | null; motions: (MotionRecord & { url: string })[];
  films: (FilmRecord & { url: string; reviews: FilmReview[] })[];
};

export function hasReviewedSeatCameras(film: DealerMaterial["films"][number]) {
  const validFrame = (frame: number) => Number.isInteger(frame) && frame >= 0 && frame < film.frames;
  return ["Stol 4", "Stol 1"].every(seat =>
    film.cameras?.some(camera => camera.id === seat && camera.samples?.some(sample => validFrame(sample.frame))) &&
    film.reviews?.some(review => review.schema === 1 && review.camera === seat && review.note?.trim() && review.frames?.some(validFrame)));
}

export const roleName = { geometry: "Kroppsgeometri", posture: "Hållningsreferens", surface: "Fotoyta" } as const;
export const cropSource = { "saved-run": "sparad med körningen", "installed-config": "lokal SAM-konfiguration, kontrollerad i efterhand" } as const;
export const dimensions = (size: Size) => size.join(" × ") + " px";
export function seriesCount(photos: Photo[]) {
  const basic = photos.filter(p => p.kind === "grundbild").length;
  return basic + " grundbilder" + (photos.length > basic ? " och " + (photos.length - basic) + " extra" : "");
}
