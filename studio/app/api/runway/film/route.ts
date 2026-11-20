import { actOnFilmOrder, filmOrder, filmOrderOriginal } from "../../../../lib/film-order-server";
import { errorResponse, LocalError, requireLocal } from "../../../../lib/storage";

export const dynamic = "force-dynamic";
const respond = (data: unknown) => Response.json(data, { headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  try {
    requireLocal(req);
    const query = new URL(req.url).searchParams;
    const version = Number(query.get("v"));
    if (query.get("original") === "1") return await filmOrderOriginal(version, req.headers.get("range"));
    return respond(await filmOrder(version));
  } catch (err) { return errorResponse(err); }
}

export async function POST(req: Request) {
  try {
    requireLocal(req);
    const payload = await req.json().catch(() => { throw new LocalError("Filmåtgärden måste vara giltig JSON."); });
    return respond(await actOnFilmOrder(payload));
  } catch (err) { return errorResponse(err); }
}
