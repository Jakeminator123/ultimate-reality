import recipe from "../recept/giv-plats-4.json";
import type { Blocking } from "./blocking";
import { draftModelId, videoModels } from "./runway-prices";

export const EXAMPLE = "@bord";
export const ENDPOINT = "https://api.dev.runwayml.com/v1/image_to_video";
export const API_VERSION = "2024-11-06";
export const MODEL = draftModelId;
const imageDraftSettings = {
  [MODEL]: { quality: "Följer startbilden", ratio: null, last: true },
  kling_4: { quality: "1080p", ratio: "auto_1080p", last: true },
  wan3: { quality: "1080p", ratio: "auto_1080p", last: true },
  grok_imagine_1_5_lite: { quality: "720p", ratio: "auto_720p", last: false },
} as const;
export type DraftModel = keyof typeof imageDraftSettings;
export type FilmQuality = "720p" | "1080p";
export function isDraftModel(value: unknown): value is DraftModel {
  return typeof value === "string" && Object.hasOwn(imageDraftSettings, value);
}
export const draftModels = videoModels.filter((m) => isDraftModel(m.id));
export function draftSettings(id: DraftModel = MODEL, quality?: FilmQuality) {
  const settings = id === "kling_4" && quality === "720p"
    ? { ...imageDraftSettings[id], quality: "720p", ratio: "auto_720p" } as const
    : imageDraftSettings[id];
  const model = draftModels.find((m) => m.id === id)!;
  return { ...settings, model, rate: model.rates.find((r) => r.quality === settings.quality)! };
}
export type Asset = { name: string; kind: "image" | "video" };
export type Frame = { name: string; x: number; y: number; zoom: number };
export const filmSources = {
  unknown: "Ej angiven",
  "runway-api": "Runway API",
  "runway-mcp": "Runway MCP",
  other: "Egen film eller annan källa",
} as const;
export type FilmSource = keyof typeof filmSources;
export type Review = {
  film: string;
  source?: FilmSource;
  start: number;
  end: number | null;
  notes: { frame: number; text: string }[];
};
export type FilmFormat = {
  width: number | null;
  height: number | null;
  fps: number | null;
  codec: string;
  pixelFormat: string;
  container: string;
  bitrate: number | null;
};
export type Draft = {
  scene?: Blocking;
  clipName?: string;
  version: number;
  prompt: string;
  model?: DraftModel;
  quality?: FilmQuality;
  duration: number;
  first: Frame;
  last: Frame | null;
  review: Review;
};
export const newFrame = (name: string): Frame => ({
  name,
  x: 0.5,
  y: 0.5,
  zoom: 1,
});
export const emptyReview = (film = ""): Review => ({
  film,
  start: 0,
  end: null,
  notes: [],
});
export const initialDraft: Draft = {
  version: 0,
  prompt: recipe.promptDraft,
  duration: 5,
  first: newFrame(EXAMPLE),
  last: null,
  review: emptyReview(),
};
export const mediaUrl = (name: string) =>
  "/api/assets?name=" + encodeURIComponent(name);
export const displayName = (name: string) =>
  name === EXAMPLE
    ? "Bordstudie"
    : name.replace(/--[a-f0-9]{16}(?=\.[^.]+$)/, "");

export function makePayload(
  prompt: string,
  duration: number,
  first: string,
  last?: string,
  model: DraftModel = MODEL,
  quality?: FilmQuality,
) {
  const settings = draftSettings(model, quality);
  const promptImage = [{ uri: first, position: "first" }];
  if (last && settings.last) promptImage.push({ uri: last, position: "last" });
  return { model, promptImage, promptText: prompt, duration, ...(settings.ratio && { ratio: settings.ratio }) };
}
export type Payload = ReturnType<typeof makePayload>;
