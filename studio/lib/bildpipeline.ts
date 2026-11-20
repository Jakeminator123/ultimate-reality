import { bildrecept } from "../fotomall/bildrecept";
import { runwayBildprompt } from "../fotomall/runway-bildprompter";

export const PIPELINE_MODEL = "gpt_image_2_6_sunburst";
export const MAX_ORIGINAL = 14; // A hand shot also needs its parent view and the card texture.

export type PipelineRef = {
  tag: string;
  roll: "identitet" | "original" | "stafront" | "sittfront" | "handryggar" | "kort";
  source: "original" | "step" | "card";
  index?: number;
  step?: string;
};
export type PipelineStep = {
  id: string; namn: string; grupp: string; dependsOn: string[];
  ratio: string; credits: number; prompt: string; refs: PipelineRef[];
};
export type PipelineJob = {
  status: "waiting" | "submitting" | "queued" | "running" | "succeeded" | "failed" | "unknown";
  taskId?: string;
  error?: string;
};
export type PipelineRevision = {
  id: string; created: string; files: string[]; steps: PipelineStep[];
  jobs: Record<string, PipelineJob>; mode: "draft" | "front" | "series";
};

const front = "staende/front";
const basroller = {
  "staende/front": "stafront",
  "sittande/front": "sittfront",
  "hander/handryggar": "handryggar",
} as const;

// Runway's 4K high-quality PNG prices before the charge of one credit per input image.
const personformat = { ratio: "2448:3264", pris: 14 };
const handformat = { ratio: "3504:2336", pris: 13 };
const dragformat = { ratio: "3840:2160", pris: 11 };

export function bildpipelinePlan(files: string[]): PipelineStep[] {
  if (!Array.isArray(files) || !files.length || files.length > MAX_ORIGINAL)
    throw new Error(`Välj mellan 1 och ${MAX_ORIGINAL} foton av samma person.`);
  if (files.some((file) => typeof file !== "string" || !file.trim()) || new Set(files).size !== files.length)
    throw new Error("Välj en gång per originalfoto.");

  const original: PipelineRef[] = files.map((_, index) => ({
    source: "original", index, tag: "original" + (index + 1),
    roll: index === 0 ? "identitet" : "original",
  }));
  return bildrecept.map((recept) => {
    const bas = recept.id === front ? undefined : recept.basvy ?? front;
    const kortvy = recept.grupp === "Händer" || recept.grupp === "Rörelsereferens";
    const format = recept.id === "hander/kortdrag-vanster" ? dragformat : kortvy ? handformat : personformat;
    const refs: PipelineRef[] = [];
    if (bas) refs.push({ tag: basroller[bas], roll: basroller[bas], source: "step", step: bas });
    refs.push(...original);
    if (kortvy) refs.push({ source: "card", tag: "kort", roll: "kort" });
    return {
      id: recept.id, namn: recept.namn, grupp: recept.grupp,
      dependsOn: bas ? [bas] : [],
      ratio: format.ratio, credits: format.pris + refs.length,
      prompt: runwayBildprompt(recept.id, refs), refs,
    };
  });
}

export function runwayPayload(step: PipelineStep, uris: string[]) {
  if (uris.length !== step.refs.length) throw new Error("Antalet bildreferenser stämmer inte med revisionen.");
  return {
    model: PIPELINE_MODEL, quality: "high", reasoningEffort: "high", outputFormat: "png",
    background: "opaque", outputCount: 1, ratio: step.ratio, promptText: step.prompt,
    referenceImages: step.refs.map((ref, index) => ({ uri: uris[index], tag: ref.tag })),
  } as const;
}
