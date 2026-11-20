import { hasReviewedSeatCameras, type DealerMaterial, type MotionRecord } from "./material-types.ts";

type Pose = NonNullable<DealerMaterial["films"][number]["poses"]>["start"];
export type BlackjackAction = {
  take: string; receipt: string; geometry: string; appearance: string | null; motion: string;
  filmUrl: string; motionUrl: string; card: string; startPose: Pose; endPose: Pose;
  appearanceStudy?: string;
  frames: number; fps: number; targetSeat: number; landingFrame: number; releaseFrame: number;
};
export type SequenceStep = BlackjackAction & {
  face?: string; cardInstance: number; firstFrame: number; lastFrame: number; startSeconds: number;
};
export type BlackjackSequence = {
  schema: 1; dealer: string; name: string; geometry: string; appearance: string | null;
  startPose: Pose; endPose: Pose; steps: SequenceStep[]; frames: number; durationSeconds: number;
};
export type SequenceSummary = Pick<BlackjackSequence, "name" | "endPose"> & { id: string; stepCount: number };
export class SequenceInputError extends Error {}

const sha = /^[a-f0-9]{64}$/;
const slug = /^[a-z0-9][a-z0-9-]*$/;
const cardFace = /^(?:[2-9]|10|[AJQK])[SHDC]$/;
type ReviewedAction = { film: DealerMaterial["films"][number]; animation: MotionRecord; receipt: string };

export function blackjackAction(dealer: string, { film, animation, receipt }: ReviewedAction): BlackjackAction | null {
  const { geometry, appearance, card, motion, take, poses, frames } = film;
  if (film.photoLayer || (film.appearanceStudy !== undefined && !sha.test(film.appearanceStudy)) ||
      !slug.test(dealer) || !slug.test(take) || !sha.test(receipt) || !sha.test(geometry) ||
      (appearance !== null && !sha.test(appearance)) || !motion || !sha.test(motion) || !card || !poses ||
      !["A1", "A2.3"].includes(poses.start) || !["A1", "A2.3"].includes(poses.end) ||
      motion !== animation.sha256 || animation.kind !== "motion" || animation.parent !== (appearance ?? geometry) ||
      animation.motion.geometry !== geometry || animation.motion.appearance !== appearance ||
      animation.motion.take !== take || animation.motion.card !== card ||
      !hasReviewedSeatCameras({ ...film, reviews: film.reviews.filter(review => review.film === receipt) })) return null;
  // Early receipts carry the destination and release in their signed Swedish frame labels.
  const landing = film.marks.find(mark => /^Landning på plats [1-9]\d*$/i.test(mark.label));
  const release = film.marks.find(mark => /^Höger hand lämnar kortet$/i.test(mark.label));
  const { targetSeat, landingFrame, releaseFrame } = film.deal ?? {
    targetSeat: Number(landing?.label.split(" ").at(-1)),
    landingFrame: landing?.frame ?? -1, releaseFrame: release?.frame ?? -1,
  };
  const [n, d = 1] = film.fps.split("/").map(Number);
  const fps = n / d;
  if (!Number.isSafeInteger(targetSeat) || targetSeat < 1 || !Number.isSafeInteger(frames) ||
      !Number.isSafeInteger(landingFrame) || !Number.isSafeInteger(releaseFrame) ||
      landingFrame < 0 || releaseFrame <= landingFrame || releaseFrame >= frames ||
      !Number.isFinite(fps) || fps <= 0 || animation.motion.start !== 0 ||
      Math.round(animation.motion.end * fps) !== frames - 1) return null;
  const base = "/api/material?dealer=" + encodeURIComponent(dealer);
  return { take, receipt, geometry, appearance, motion, filmUrl: base + "&film=" + receipt, motionUrl: base + "&model=" + motion,
    ...(film.appearanceStudy ? { appearanceStudy: film.appearanceStudy } : {}),
    card, startPose: poses.start, endPose: poses.end, frames, fps, targetSeat, landingFrame, releaseFrame };
}

export function composeBlackjackSequence(dealer: string, input: unknown, actions: readonly BlackjackAction[]): BlackjackSequence {
  const body = input as { name?: unknown; steps?: unknown } | null;
  if (!slug.test(dealer) || !body || typeof body.name !== "string" || !body.name.trim() || !Array.isArray(body.steps) || !body.steps.length)
    throw new SequenceInputError("Ge sekvensen ett namn och välj minst en granskad giv.");
  const available = new Map(actions.map(action => [action.receipt, action]));
  const steps: SequenceStep[] = [];
  let frames = 0, durationSeconds = 0;
  for (const requested of body.steps) {
    const action = available.get(requested?.receipt);
    if (!action) throw new SequenceInputError("Den valda givens granskade filmversion saknas.");
    const previous = steps.at(-1);
    if (previous && (previous.geometry !== action.geometry || previous.appearance !== action.appearance ||
        previous.appearanceStudy !== action.appearanceStudy))
      throw new SequenceInputError("Välj givningar med samma kropp och fotoyta i den här sekvensen.");
    if (previous && previous.endPose !== action.startPose)
      throw new SequenceInputError("Giv " + (steps.length + 1) + " börjar i " + action.startPose + ". Föregående giv slutar i " + previous.endPose + ".");
    let face: string | undefined;
    if (requested.face !== undefined) {
      if (typeof requested.face !== "string" || !cardFace.test(requested.face.toUpperCase()))
        throw new SequenceInputError("Ange kortets valör och färg, exempelvis 2S eller 10H.");
      face = requested.face.toUpperCase();
    }
    steps.push({ ...action, ...(face ? { face } : {}), cardInstance: steps.length + 1,
      firstFrame: frames, lastFrame: frames + action.frames - 1, startSeconds: durationSeconds });
    frames += action.frames;
    durationSeconds += action.frames / action.fps;
  }
  const first = steps[0], last = steps[steps.length - 1];
  return { schema: 1, dealer, name: body.name.trim(), geometry: first.geometry, appearance: first.appearance,
    startPose: first.startPose, endPose: last.endPose, steps, frames, durationSeconds };
}
