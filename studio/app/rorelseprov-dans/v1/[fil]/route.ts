import { serveTrialResource, type TrialResource } from "../../../../lib/local-trial-media";

const folder = "avatars/paulina/rorelseprov-dans/v1/";
const files = new Map<string, TrialResource>([
  ["paulina.png", [folder + "referenser/paulina.png", "image/png"]],
  ["rorelsereferens.mp4", [folder + "visning/rorelsereferens.mp4", "video/mp4"]],
  ["dans-med-blink.glb", [folder + "rigg/dans-med-blink.glb", "model/gltf-binary"]],
  ["resultat.mp4", [folder + "runway/resultat.mp4", "video/mp4"]],
  ["samma-tid.jpg", [folder + "granskning/samma-tid.jpg", "image/jpeg"]],
  ["blinkning.jpg", [folder + "granskning/blinkning.jpg", "image/jpeg"]],
]);

export async function GET(request: Request, context: { params: Promise<{ fil: string }> }) {
  return serveTrialResource(request, files.get((await context.params).fil));
}

export const HEAD = GET;
