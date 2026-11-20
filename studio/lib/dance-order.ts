export const danceSeries = "rorelseprov-dans";
export const danceSeconds = 4;
export const danceDraftUrl = "/api/rorelseprov-dans";
export const danceOrderUrl = "/api/rorelseprov-dans/order";
export const dancePrompt = "Film the woman in the starting photograph in one continuous, photorealistic four-second take. Preserve her face, blonde bob, tattoos, black suit and boots, and the pale studio background. Match the timing, scale and left-right direction of the movement in the reference video. She blinks naturally around 0.5 s. From about 0.8 to 2.0 s she steps side to side, alternates her feet and swings her arms in opposite directions. She bends her knees, makes a small two-foot jump with the apex around 2.67 s and lands softly before 3.0 s. She settles by 4.0 s. Follow her wrists and fingers as shown. Keep the front camera fixed with her head and both shoes in frame throughout.";

export type DanceRevision = {
  version: number;
  prompt: string;
  requestSha256: string;
  photoSha256: string;
  motionSha256: string;
  motionSeconds: number;
};

export type DanceDraftState = { versions: number[]; selected: DanceRevision | null };
