import { danceAsset, danceDraft, saveDanceDraft } from "../../../lib/dance-order-server";
import { errorResponse, LocalError, requireLocal } from "../../../lib/storage";

export const dynamic = "force-dynamic";
const response = (value: unknown) => Response.json(value, { headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  try {
    requireLocal(req);
    const params = new URL(req.url).searchParams;
    const version = params.has("v") ? Number(params.get("v")) : null;
    if (version !== null && (!Number.isSafeInteger(version) || version < 0)) throw new LocalError("Ogiltig version.");
    const asset = params.get("asset");
    return asset ? await danceAsset(req, asset, version ?? 0) : response(await danceDraft(version));
  } catch (err) { return errorResponse(err); }
}
export const HEAD = GET;

export async function POST(req: Request) {
  try {
    requireLocal(req);
    const input = await req.json().catch(() => { throw new LocalError("Ogiltigt filmutkast."); });
    return response(await saveDanceDraft(input));
  } catch (err) { return errorResponse(err); }
}
