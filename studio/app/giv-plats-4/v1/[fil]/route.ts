import { serveTrialResource, type TrialResource } from "../../../../lib/local-trial-media";

const dir = "avatars/paulina/giv-plats-4/v1/visning";
const files = new Map<string, TrialResource>([
  ["front.mp4", [dir + "/front.mp4", "video/mp4"]],
  ["sida70.mp4", [dir + "/sida70.mp4", "video/mp4"]],
  ["jamforelse.mp4", [dir + "/jamforelse.mp4", "video/mp4"]],
  ["oversikt.jpg", [dir + "/oversikt.jpg", "image/jpeg"]],
  ["rendering.json", [dir + "/rendering.json", "application/json"]],
]);

async function respond(request: Request, context: { params: Promise<{ fil: string }> }) {
  const { fil } = await context.params;
  return serveTrialResource(request, files.get(fil));
}

export const GET = respond;
export const HEAD = respond;
