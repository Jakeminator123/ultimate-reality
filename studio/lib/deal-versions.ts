import type { FilmRecord } from "./material-types";

export type DealPose = NonNullable<FilmRecord["poses"]>["end"];
export const poseNames: Record<DealPose, string> = { A1: "VILA A1", "A2.3": "REDO A2.3" };
export const versionRule = "Aktuell är den högsta granskade versionen i samma givserie för samma kropp, grundfotoyta, kort, målplats och övergång mellan poser.";

export function bodyLabel(name: string) {
  const match = /^(.+?) · sittmodell v(\d+)(?: \(prov\))?$/i.exec(name);
  if (!match) return name;
  const owner = /[sxz]$/i.test(match[1]) ? match[1] : match[1] + "s";
  return owner + " sittmodell " + match[2];
}

export function dealLabel(body: string, take: string, end?: DealPose) {
  const version = /-v([1-9]\d*)$/.exec(take)?.[1];
  const motion = version ? "givprov " + version : take.replaceAll("-", " ");
  return bodyLabel(body) + " · " + motion + (end ? " · " + poseNames[end] : "");
}

export type DealVersion = Pick<FilmRecord, "take" | "geometry" | "appearance" | "card"> & {
  receipt: string; targetSeat: number; startPose: DealPose; endPose: DealPose;
};

// Callers provide the dealer's receipt-verified actions. An unnumbered take is its own series.
export function chooseDealVersions<T extends DealVersion>(actions: readonly T[], preferredReceipt?: string) {
  const unique = new Map(actions.map(action => [action.receipt, action]));
  const ranked = [...unique.values()].map(action => {
    const suffix = /-v([1-9]\d*)$/.exec(action.take);
    const series = suffix ? action.take.slice(0, suffix.index) : action.take;
    const group = JSON.stringify([action.geometry, action.appearance, action.card, action.targetSeat, series, action.startPose, action.endPose]);
    return { action, group, version: suffix ? BigInt(suffix[1]) : BigInt(0) };
  }).sort((a, b) => {
    if (a.version !== b.version) return a.version > b.version ? -1 : 1;
    const preferred = Number(b.action.receipt === preferredReceipt) - Number(a.action.receipt === preferredReceipt);
    return preferred || a.action.take.localeCompare(b.action.take, "sv") || a.action.receipt.localeCompare(b.action.receipt);
  });
  const winners = new Map<string, T>();
  const previous: T[] = [];
  for (const { action, group } of ranked) {
    if (winners.has(group)) previous.push(action);
    else winners.set(group, action);
  }
  const current = [...winners.values()].sort((a, b) =>
    a.endPose.localeCompare(b.endPose) || a.take.localeCompare(b.take, "sv", { numeric: true }));
  const preferred = ranked.find(entry => entry.action.receipt === preferredReceipt);
  return { current, previous, defaultAction: (preferred && winners.get(preferred.group)) ?? current.at(0) };
}
