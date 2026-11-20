import { serveTrialResource, type TrialResource } from "../../../../lib/local-trial-media";

const base = "avatars/paulina/giv-plats-4/blick/v1/";
const files = new Map<string, TrialResource>([
  ["blick.glb", [base + "blick.glb", "model/gltf-binary"]],
  ["blick.json", [base + "blick.json", "application/json"]],
  ["jamforelse.jpg", [base + "granskning/blick-framifran.jpg", "image/jpeg"]],
]);

export async function GET(request: Request, { params }: { params: Promise<{ fil: string }> }) {
  const { fil } = await params;
  return serveTrialResource(request, files.get(fil));
}

export const HEAD = GET;
