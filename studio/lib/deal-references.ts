export type DealReference = {
  title: string; view: string; file: string; sha256: string; source?: string;
  draw: number; handover: number; release: number; push?: number; turn?: number; rest?: number;
};

// Times are relative to the local excerpts, whose cuts start at Howcast frame 4248 and VIP time 78.2 s.
export const dealReferences: readonly DealReference[] = [
  {
    title: "Howcast · spader två",
    view: "Ovanifrån · bar filt",
    file: "blackjack-rorelsereferenser/material/qd5oc9hLrXg/spader-tva-4248-4307.mp4",
    sha256: "eea1f5ebd5564864e22040de2d3b428726e8f9024f18f8f20def0b193b2e70fc",
    source: "https://www.youtube.com/watch?v=qd5oc9hLrXg&t=177s",
    draw: (4259 - 4248) * 1001 / 24000,
    handover: (4274 - 4248) * 1001 / 24000,
    release: (4300 - 4248) * 1001 / 24000,
  },
  {
    title: "VIP · klöver nio",
    view: "Snett framifrån · på knekten",
    file: "blackjack-rorelsereferenser/material/AZ2sb5B_JmA/klover-nio-spelarutdrag.mp4",
    sha256: "05b2d66334a8fabdeb827167eb4e1cd537d989853ba14b225c80514a392c49f0",
    source: "https://www.youtube.com/watch?v=AZ2sb5B_JmA&t=78s",
    draw: 0,
    handover: 0.7,
    release: 1.4,
  },
];

// Original pos4-v, first frame at t = 0. The clip has 39 frames at 24 fps.
export const placedCardReference: DealReference = {
  title: "Jakobs giv till plats 4", view: "Framifrån · pos4-v.mp4",
  file: "desk-v2-rorelsereferenser/material/pos4-v.mp4",
  sha256: "fbf7a8906d4062fedbab8911a94aa7d7778e0511982d414ce5fd5b38af03e883",
  draw: 0, push: 5 / 24, handover: 9 / 24, turn: 16 / 24, release: 25 / 24, rest: 38 / 24,
};

export function referencesForTake(timingSha?: string): readonly DealReference[] {
  if (timingSha === placedCardReference.sha256) return [placedCardReference];
  // The timing record for takes 1–3 points to the full Howcast source, before the review excerpt was cut.
  if (timingSha === "b58fd58f4aa6cac65d6b11b413154c00109550818a670ea14601e3a64bbaa1c5") return dealReferences;
  return [];
}
