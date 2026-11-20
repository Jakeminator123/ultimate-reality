import { serveTrialResource, type TrialResource } from "../../../../lib/local-trial-media";

function resource(segments: string[]): TrialResource | undefined {
  if (segments.length !== 1 && segments.length !== 2) return;
  const [version, file] = segments.length === 1 ? ["v2", segments[0]] : segments;
  if (version !== "v1" && version !== "v2") return;
  const folder = "avatars/paulina/giv-plats-4/filmrorelse/" + version + "/rigg/";
  if (file === "filmrorelse.glb") return [folder + file, "model/gltf-binary"];
  if (file === "rorelsematning.json") return [folder + file, "application/json"];
}

export async function GET(request: Request, context: { params: Promise<{ material: string[] }> }) {
  return serveTrialResource(request, resource((await context.params).material));
}

export const HEAD = GET;
