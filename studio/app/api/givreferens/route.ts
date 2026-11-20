import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { rangedResponse } from "../../../lib/byte-range";
import { dealReferences } from "../../../lib/deal-references";
import { errorResponse, LocalError, requireLocal } from "../../../lib/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireLocal(request);
    const sha = new URL(request.url).searchParams.get("film");
    const clip = dealReferences.find(item => item.sha256 === sha);
    if (!clip) throw new LocalError("Okänt referensklipp.", 404);
    const file = path.resolve("..", "information", "random", "blackjack-rorelsereferenser", "material", clip.file);
    const data = await readFile(/* turbopackIgnore: true */ file);
    if (createHash("sha256").update(data).digest("hex") !== clip.sha256) {
      throw new LocalError("Referensklippet avviker från den granskade versionen.", 409);
    }
    return rangedResponse(data.length, "video/mp4", request.headers.get("range"),
      (start, end) => new Uint8Array(data.subarray(start, end + 1)), "private, no-store");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return errorResponse(new LocalError("Referensklippet saknas lokalt.", 404));
    return errorResponse(error);
  }
}
