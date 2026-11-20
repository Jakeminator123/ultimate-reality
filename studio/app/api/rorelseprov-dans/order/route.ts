import { actOnFilmOrder, filmOrder, filmOrderOriginal } from "../../../../lib/runway-film-revisions";
import { danceSeries } from "../../../../lib/dance-order";
import { errorResponse, LocalError, requireLocal } from "../../../../lib/storage";

export const dynamic = "force-dynamic";
const response = (value: unknown) => Response.json(value, { headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  try {
    requireLocal(req);
    const params = new URL(req.url).searchParams;
    const version = Number(params.get("v"));
    if (params.get("original") === "1") return await filmOrderOriginal(version, req.headers.get("range"), danceSeries);
    return response(await filmOrder(version, danceSeries));
  } catch (err) { return errorResponse(err); }
}

export async function POST(req: Request) {
  try {
    requireLocal(req);
    const input = await req.json().catch(() => { throw new LocalError("Ogiltig filmåtgärd."); });
    return response(await actOnFilmOrder(input, fetch, danceSeries));
  } catch (err) { return errorResponse(err); }
}
