import { API_VERSION, ENDPOINT } from "../../../lib/model";
import { errorResponse, requireLocal } from "../../../lib/storage";

export const dynamic = "force-dynamic";

function status(state: string) {
  return Response.json({ state }, { headers: { "Cache-Control": "no-store" } });
}

export function GET(req: Request) {
  try {
    requireLocal(req);
    return status(process.env.RUNWAYML_API_SECRET?.trim() ? "configured" : "missing");
  } catch (error) {
    return errorResponse(error);
  }
}

// The user's connection check only reads the organization endpoint.
export async function POST(req: Request) {
  try {
    requireLocal(req);
  } catch (error) {
    return errorResponse(error);
  }
  const key = process.env.RUNWAYML_API_SECRET?.trim();
  if (!key) return status("missing");
  try {
    const response = await fetch(new URL("/v1/organization", ENDPOINT), {
      headers: { Authorization: "Bearer " + key, "X-Runway-Version": API_VERSION },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    await response.body?.cancel();
    if (response.ok) return status("verified");
    if (response.status === 401) return status("invalid");
    if (response.status === 403) return status("forbidden");
    if (response.status === 429) return status("limited");
  } catch {
    // Provider responses and headers may contain account data. Return only status.
  }
  return status("unavailable");
}
