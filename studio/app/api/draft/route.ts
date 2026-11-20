import { promises as fs } from "node:fs";
import path from "node:path";
import { requestHash } from "../../../lib/film-order-server";
import {
  API_VERSION,
  Draft,
  ENDPOINT,
  EXAMPLE,
  Frame,
  makePayload,
  MODEL,
  isDraftModel,
  draftSettings,
  filmSources,
  Payload,
} from "../../../lib/model";
import {
  assetFile,
  errorResponse,
  folders,
  requireLocal,
  LocalError,
  publishExclusive,
  revisionIds,
} from "../../../lib/storage";
export const dynamic = "force-dynamic";
import { validBlocking } from "../../../lib/blocking";

function validFrame(frame: Frame) {
  return (
    frame &&
    typeof frame.name === "string" &&
    frame.name.length > 0 &&
    [frame.x, frame.y].every((v) => Number.isFinite(v) && v >= 0 && v <= 1) &&
    Number.isFinite(frame.zoom) &&
    frame.zoom >= 1 &&
    frame.zoom <= 3
  );
}
const frameNumber = (v: number) => Number.isSafeInteger(v) && v >= 0;
export async function GET(req: Request) {
  try {
    requireLocal(req);
    const { revisions } = await folders();
    const ids = await revisionIds(revisions);
    const query = new URL(req.url).searchParams.get("v");
    const selected = query ? Number(query) : ids[0];
    if (query && !ids.includes(selected))
      throw new LocalError("Versionen finns inte.", 404);
    const record = selected
      ? JSON.parse(
          await fs.readFile(path.join(revisions, `v${selected}.json`), "utf8"),
        )
      : null;
    return Response.json(
      { record: record ? { ...record, requestSha256: requestHash(record.request.body) } : null, versions: ids },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request) {
  try {
    requireLocal(req);
    if (Number(req.headers.get("content-length")) > 14_000_000)
      throw new LocalError("Bildpaketet är för stort.", 413);
    const {
      draft,
      base,
      payload,
    }: { draft: Draft; base: number; payload: Payload } = await req.json();
    if (
      !draft ||
      (draft.clipName !== undefined && (typeof draft.clipName !== "string" || !draft.clipName.trim() || draft.clipName.length > 80)) ||
      (draft.scene !== undefined && !validBlocking(draft.scene)) ||
      !frameNumber(base) ||
      !validFrame(draft.first) ||
      (draft.last !== null && !validFrame(draft.last)) ||
      typeof draft.prompt !== "string" ||
      !draft.prompt.trim() ||
      draft.prompt.length > 1000 ||
      (draft.model !== undefined && !isDraftModel(draft.model)) ||
      (draft.quality !== undefined && (draft.model !== "kling_4" ||
        (draft.quality !== "720p" && draft.quality !== "1080p"))) ||
      !draftSettings(draft.model).model.durations.includes(draft.duration)
    )
      throw new LocalError("Kontrollera bilder, prompt och längd.");
    const review = draft.review;
    if (
      !review ||
      (review.source !== undefined && (typeof review.source !== "string" || !Object.hasOwn(filmSources, review.source))) ||
      typeof review.film !== "string" ||
      !frameNumber(review.start) ||
      (review.end !== null &&
        (!frameNumber(review.end) || review.end < review.start)) ||
      !Array.isArray(review.notes) ||
      !review.notes.every(
        (n) =>
          frameNumber(n.frame) &&
          typeof n.text === "string" &&
          n.text.length <= 1000,
      )
    )
      throw new LocalError("Ogiltig filmgranskning.");
    for (const frame of [draft.first, draft.last]) {
      if (
        frame &&
        frame.name !== EXAMPLE &&
        !(await assetFile(frame.name)).mime.startsWith("image/")
      )
        throw new LocalError("Referensen måste vara en bild.");
    }
    if (
      review.film &&
      !(await assetFile(review.film)).mime.startsWith("video/")
    )
      throw new LocalError("Välj en film för granskning.");
    const uris = payload?.promptImage?.map((p) => p.uri);
    if (
      !uris ||
      uris.length !== (draft.last && draftSettings(draft.model).last ? 2 : 1) ||
      uris.some(
        (uri) =>
          typeof uri !== "string" ||
          uri.length > 5_000_000 ||
          !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(uri),
      )
    )
      throw new LocalError("Beskärningen kunde inte paketeras.");
    const exact = makePayload(draft.prompt, draft.duration, uris[0], uris[1], draft.model ?? MODEL, draft.quality);
    if (JSON.stringify(exact) !== JSON.stringify(payload))
      throw new LocalError("Förhandsvisningen hör till ett äldre utkast.");
    const { revisions } = await folders();
    const [latest = 0] = await revisionIds(revisions);
    if (latest !== base)
      throw new LocalError(
        "En annan flik har sparat en ny version. Öppna den senaste versionen först.",
        409,
      );
    const record = {
      draft: { ...draft, version: base + 1 },
      parentVersion: draft.version || null,
      savedAt: new Date().toISOString(),
      request: {
        transport: "runway-api",
        state: "draft",
        method: "POST",
        endpoint: ENDPOINT,
        headers: {
          "Content-Type": "application/json",
          "X-Runway-Version": API_VERSION,
        },
        body: exact,
      },
    };
    await publishExclusive(
      revisions,
      `v${base + 1}.json`,
      JSON.stringify(record),
    );
    return Response.json({ version: base + 1, requestSha256: requestHash(exact) });
  } catch (e) {
    return errorResponse(e);
  }
}
