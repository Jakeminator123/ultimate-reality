import { SequenceInputError } from "../../../lib/blackjack-sequence";
import { availableBlackjackActions, listBlackjackSequences, readBlackjackSequence, saveBlackjackSequence } from "../../../lib/blackjack-sequence-store";
import { errorResponse, LocalError, requireLocal } from "../../../lib/storage";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    requireLocal(request);
    const query = new URL(request.url).searchParams;
    const dealer = query.get("dealer") ?? "paulina";
    const id = query.get("id");
    if (id !== null) return Response.json(await readBlackjackSequence(dealer, id), { headers });
    const [actions, sequences] = await Promise.all([availableBlackjackActions(dealer), listBlackjackSequences(dealer)]);
    return Response.json({ actions, sequences }, { headers });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    requireLocal(request);
    const dealer = new URL(request.url).searchParams.get("dealer") ?? "paulina";
    const input = await request.json().catch(() => { throw new LocalError("Sekvensen ska skickas som JSON."); });
    return Response.json(await saveBlackjackSequence(dealer, input), { headers });
  } catch (error) {
    return errorResponse(error instanceof SequenceInputError ? new LocalError(error.message) : error);
  }
}
