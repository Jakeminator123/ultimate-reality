import { dealerMaterial, materialFile, materialMarkdown, materialStamp } from "../../../lib/dealer-material";
import { errorResponse, requireLocal } from "../../../lib/storage";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    requireLocal(request);
    const query = new URL(request.url).searchParams;
    if (query.get("stamp") === "1") return Response.json({ stamp: await materialStamp(query.get("dealer") ?? "paulina") },
      { headers: { "Cache-Control": "private, no-store" } });
    if (!query.has("report")) return await materialFile(query, request.headers.get("range"));
    const project = await dealerMaterial(query.get("dealer") ?? "paulina", query.get("revision"));
    const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
    return query.get("report") === "md" ? new Response(materialMarkdown(project), {
      headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
    }) : Response.json(project, { headers });
  } catch (err) { return errorResponse(err); }
}
