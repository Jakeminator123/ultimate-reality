import { serveTrialResource, type TrialResource } from "../../../../../lib/local-trial-media";

const folder = "avatars/paulina/giv-plats-4/dashboardklipp/v1/";
const files = new Map<string, TrialResource>([
  ["original.mp4", [folder + "kalla/original.mp4", "video/mp4"]],
  ["overlay.mp4", [folder + "kalla/overlay.mp4", "video/mp4"]],
  ["sam-ruta-000.glb", [folder + "kalla/sam-ruta-000.glb", "model/gltf-binary"]],
  ["filmrorelse.glb", [folder + "rigg/filmrorelse.glb", "model/gltf-binary"]],
  ["rorelsematning.json", [folder + "rigg/rorelsematning.json", "application/json"]],
  ["v4-front.mp4", [folder + "visning/v4-front.mp4", "video/mp4"]],
]);

export async function GET(request: Request, context: { params: Promise<{ fil: string }> }) {
  return serveTrialResource(request, files.get((await context.params).fil));
}

export const HEAD = GET;
