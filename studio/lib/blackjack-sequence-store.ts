import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { blackjackAction, composeBlackjackSequence, type BlackjackAction, type BlackjackSequence, type SequenceSummary } from "./blackjack-sequence";
import { currentSeatedTrial, dealerMaterial, reviewedTrialFilm } from "./dealer-material";
import { folders, LocalError, publishExclusive } from "./storage";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const sha = /^[a-f0-9]{64}$/;

export async function availableBlackjackActions(dealer: string): Promise<BlackjackAction[]> {
  const material = await dealerMaterial(dealer);
  const candidate = await currentSeatedTrial(material);
  const byMotion = new Map(material.motions.map(m => [m.sha256, m]));
  const active = material.films.flatMap(film => {
    const receipt = new URL(film.url, "http://localhost").searchParams.get("film");
    const animation = film.motion && byMotion.get(film.motion);
    return receipt && animation ? [{ film, animation, receipt }] : [];
  });
  const actions = new Map<string, BlackjackAction>();
  for (const reviewed of [...(candidate?.reviewedTakes ?? []), ...active]) {
    const action = blackjackAction(dealer, reviewed);
    if (action) actions.set(action.receipt, action);
  }
  return [...actions.values()].sort((a, b) => b.take.localeCompare(a.take, "sv", { numeric: true }));
}

async function sequenceFolder(dealer: string) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(dealer)) throw new LocalError("Ogiltig dealer.");
  const { root } = await folders();
  let folder = root;
  for (const part of ["saved", "blackjacksekvenser", dealer]) {
    folder = path.join(/* turbopackIgnore: true */ folder, part);
    await fs.mkdir(/* turbopackIgnore: true */ folder, { recursive: true });
    if (path.relative(folder, await fs.realpath(/* turbopackIgnore: true */ folder)) !== "")
      throw new LocalError("Sekvensmappen har bytt sökväg.", 409);
  }
  return folder;
}

async function readSnapshot(folder: string, id: string, dealer: string): Promise<BlackjackSequence> {
  if (!sha.test(id)) throw new LocalError("Ogiltig sekvensversion.");
  const file = path.join(folder, id + ".json");
  const entry = await fs.lstat(/* turbopackIgnore: true */ file).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") throw new LocalError("Sekvensversionen saknas.", 404);
    throw error;
  });
  if (!entry.isFile() || entry.isSymbolicLink()) throw new LocalError("Sekvensfilen avviker.", 409);
  const value = await fs.readFile(/* turbopackIgnore: true */ file, "utf8");
  if (hash(value) !== id) throw new LocalError("Den sparade sekvensens kontrollsumma avviker.", 409);
  const sequence: BlackjackSequence = JSON.parse(value);
  if (sequence.schema !== 1 || sequence.dealer !== dealer || !Array.isArray(sequence.steps) || !sequence.steps.length)
    throw new LocalError("Sekvensen saknar rörelseunderlag.", 409);
  return sequence;
}

export async function listBlackjackSequences(dealer: string): Promise<SequenceSummary[]> {
  const folder = await sequenceFolder(dealer);
  const files = await fs.readdir(/* turbopackIgnore: true */ folder, { withFileTypes: true });
  const summaries = await Promise.all(files.filter(f => f.isFile() && /^[a-f0-9]{64}\.json$/.test(f.name)).map(async f => {
    const id = f.name.slice(0, -5);
    const s = await readSnapshot(folder, id, dealer);
    return { id, name: s.name, stepCount: s.steps.length, endPose: s.endPose };
  }));
  return summaries.sort((a, b) => a.name.localeCompare(b.name, "sv") || a.id.localeCompare(b.id));
}

export async function saveBlackjackSequence(dealer: string, input: unknown) {
  const actions = await availableBlackjackActions(dealer);
  const sequence = composeBlackjackSequence(dealer, input, actions);
  const contents = JSON.stringify(sequence, null, 2) + "\n";
  const id = hash(contents);
  const folder = await sequenceFolder(dealer);
  try {
    await publishExclusive(folder, id + ".json", contents);
  } catch (error) {
    if (!(error instanceof LocalError) || error.status !== 409) throw error;
    await readSnapshot(folder, id, dealer);
  }
  return { id, sequence };
}

export async function readBlackjackSequence(dealer: string, id: string) {
  const sequence = await readSnapshot(await sequenceFolder(dealer), id, dealer);
  const steps = new Map(sequence.steps.map(step => [step.receipt, step]));
  const actions = await Promise.all([...steps.values()].map(async step => {
    const reviewed = await reviewedTrialFilm(dealer, sequence.geometry, sequence.appearance, step.motion, step.receipt);
    const action = reviewed && blackjackAction(dealer, reviewed);
    if (!action) throw new LocalError("En låst tagning eller dess stolgranskningar saknas.", 409);
    return action;
  }));
  const verified = composeBlackjackSequence(dealer, sequence, actions);
  if (JSON.stringify(verified) !== JSON.stringify(sequence))
    throw new LocalError("Sekvensens rörelser eller tidpunkter avviker från de granskade filmerna.", 409);
  return { id, sequence };
}
