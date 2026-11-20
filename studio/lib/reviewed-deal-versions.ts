import { blackjackAction } from "./blackjack-sequence.ts";
import { chooseDealVersions } from "./deal-versions.ts";

export function reviewedDealChoices(dealer: string, takes: readonly Parameters<typeof blackjackAction>[1][], preferredReceipt?: string) {
  const actions = takes.flatMap(take => {
    const action = blackjackAction(dealer, take);
    return action?.startPose === "A2.3" ? [action] : [];
  });
  return chooseDealVersions(actions, preferredReceipt);
}
