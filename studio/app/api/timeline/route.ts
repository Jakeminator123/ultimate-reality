import { probeFilm } from "../../../lib/film-probe";
import {
  assetFile,
  errorResponse,
  LocalError,
  requireLocal,
} from "../../../lib/storage";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    requireLocal(req);
    const { file, mime } = await assetFile(
      new URL(req.url).searchParams.get("name") || "",
    );
    if (!mime.startsWith("video/")) throw new LocalError("Välj en film.");
    const { times, format } = await probeFilm(file);
    return Response.json(
      new URL(req.url).searchParams.get("details") === "1" ? { times, format } : times,
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
