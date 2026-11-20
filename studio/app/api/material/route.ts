import { currentSeatedTrial, dealerMaterial, materialFile, materialMarkdown, materialStamp } from "../../../lib/dealer-material";
import type { TrialFilmSummary } from "../../../lib/material-types";
import { errorResponse, requireLocal } from "../../../lib/storage";

export const dynamic = "force-dynamic";
function filmSummary({ take, sha256, url, poses }: TrialFilmSummary): TrialFilmSummary {
  return { take, sha256, url, ...(poses && { poses }) };
}

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
    const candidate = await currentSeatedTrial(project);
    if (candidate) {
      project.seatedTrial = { id: candidate.id, name: candidate.name };
      if (candidate.film) project.seatedTrial.film = filmSummary(candidate.film);
      if (candidate.reviewedTakes?.length) project.seatedTrial.films = candidate.reviewedTakes.map(({ film }) => filmSummary(film));
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
