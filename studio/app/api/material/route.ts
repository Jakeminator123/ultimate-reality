import { dealerMaterial, materialFile, materialMarkdown, materialStamp, readSeatedProfileTrial, seatedTrialModel } from "../../../lib/dealer-material";
import { errorResponse, LocalError, requireLocal } from "../../../lib/storage";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    requireLocal(request);
    const location = new URL(request.url);
    const query = location.searchParams;
    if (query.get("stamp") === "1") return Response.json({ stamp: await materialStamp(query.get("dealer") ?? "paulina", query.get("revision")) },
      { headers: { "Cache-Control": "private, no-store" } });
    if (!query.has("report")) return await materialFile(query, request.headers.get("range"));
    const project = await dealerMaterial(query.get("dealer") ?? "paulina", query.get("revision"));
    const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
    if (project.dealer === "paulina" && project.edition === "fas-1/v1" && project.revision) {
      try {
        const trial = await readSeatedProfileTrial(project.dealer, project.edition);
        if (trial?.revision === project.revision && project.photos.some(p => p.id === "sittande/front" && p.sha256 === trial.frontSha256 && p.seated)) {
          const candidate = await seatedTrialModel(project, trial.photo, true);
          if (candidate) {
            project.seatedTrial = { id: candidate.id, name: candidate.name };
            if ("film" in candidate && candidate.film) {
              const { take, sha256, url } = candidate.film;
              project.seatedTrial.film = { take, sha256, url };
            }
          }
        }
      } catch (error) {
        if (!(error instanceof LocalError || error instanceof SyntaxError)) throw error;
        project.issues.push("SAM-provet med den nya sittprofilen kunde inte verifieras.");
      }
    }
    if (query.get("report") === "md") {
      const host = request.headers.get("host");
      if (host) location.host = host;
      return new Response(materialMarkdown(project, location.origin), {
        headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return Response.json(project, { headers });
  } catch (err) { return errorResponse(err); }
}
