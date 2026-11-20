import { pipelineAction, pipelineImage, pipelineList, pipelineRevision } from "../../../lib/bildpipeline-server";
import { errorResponse, LocalError, requireLocal } from "../../../lib/storage";

export const dynamic = "force-dynamic";

const json = (data: unknown) => Response.json(data, { headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  try {
    requireLocal(req);
    const params = new URL(req.url).searchParams;
    const id = params.get("id");
    const image = params.get("image");
    const original = params.get("original");
    if (image !== null || original !== null) {
      if (!id) throw new LocalError("Välj en sparad revision.");
      if (original !== null && (!/^\d{1,2}$/.test(original) || image !== null))
        throw new LocalError("Välj ett giltigt originalfoto.");
      return await pipelineImage(id, original === null ? image! : Number(original));
    }
    return json(id !== null ? await pipelineRevision(id) : await pipelineList());
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    requireLocal(req);
    const payload = await req.json().catch(() => { throw new LocalError("Beställningen måste vara giltig JSON."); });
    return json(await pipelineAction(payload));
  } catch (err) {
    return errorResponse(err);
  }
}
