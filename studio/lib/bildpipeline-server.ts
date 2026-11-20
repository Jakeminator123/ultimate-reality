import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ENDPOINT } from "./model";
import { fetchOutput, getTask, jobState, observeTask, runwayOptions, submitTaskOnce, validTaskId } from "./runway-tasks";
import { LocalError, assetFile } from "./storage";
import { referenskort } from "../fotomall/kortstandard";
import {
  bildpipelinePlan, runwayPayload, type PipelineRevision, type PipelineStep,
} from "./bildpipeline";
import {
  checkFolder, dataUri, digest, imageMime, optionalJson, pipelineFolder, record,
} from "./bildpipeline-files";

const createUrl = new URL("/v1/text_to_image", ENDPOINT).href;
const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;

type SavedImage = { filename: string; mime: string; sha256: string };
type Manifest = Pick<PipelineRevision, "id" | "created" | "files" | "steps"> & {
  sources: SavedImage[];
  card: SavedImage;
  templates: ReturnType<typeof runwayPayload>[];
};

function stepDir(dir: string, manifest: Manifest, id: string) {
  const index = manifest.steps.findIndex((step) => step.id === id);
  if (index < 0) throw new LocalError("Okänt bildsteg.", 404);
  return path.join(dir, "step-" + (index + 1));
}

async function snapshot(dir: string, filename: string, bytes: Buffer): Promise<SavedImage> {
  const mime = await imageMime(bytes);
  await fs.writeFile(/* turbopackIgnore: true */ path.join(dir, filename), bytes, { flag: "wx" });
  return { filename, mime, sha256: digest(bytes) };
}

async function createDraft(names: unknown) {
  if (!Array.isArray(names) || !names.length || names.length > 14 ||
      !names.every((n) => typeof n === "string") || new Set(names).size !== names.length)
    throw new LocalError("Välj 1–14 olika foton ur bildinkorgen.");
  const files: string[] = names;
  const steps = bildpipelinePlan(files);
  const id = randomUUID();
  const base = await pipelineFolder();
  const staging = path.join(base, "." + id + ".pending");
  await fs.mkdir(staging);
  try {
    const sources: SavedImage[] = [];
    for (const [index, name] of files.entries()) {
      const source = await assetFile(name);
      if (!source.mime.startsWith("image/")) throw new LocalError("Välj en bild ur inkorgen.");
      sources.push(await snapshot(staging, "original-" + (index + 1), await fs.readFile(source.file)));
    }
    const card = await snapshot(staging, "card.png", await fs.readFile(path.join(process.cwd(), "public", referenskort.fil)));
    if (card.sha256 !== referenskort.sha256) throw new LocalError("Kontrollsumman för referenskortet stämmer inte.", 500);
    const manifest: Manifest = {
      id, created: new Date().toISOString(), files, steps, sources, card,
      templates: steps.map((step) => runwayPayload(step, step.refs.map((ref) => "local:" + ref.tag))),
    };
    await Promise.all(steps.map((s) => fs.mkdir(stepDir(staging, manifest, s.id))));
    await fs.writeFile(path.join(staging, "revision.json"), JSON.stringify(manifest, null, 2));
    const target = path.join(base, id);
    await fs.rename(staging, target);
    return revisionState(target, manifest);
  } catch (err) {
    // staging is a private UUID child created by this invocation.
    await fs.rm(staging, { recursive: true, force: true });
    throw err;
  }
}

async function loadRevision(id: string) {
  if (!uuid.test(id)) throw new LocalError("Ogiltigt revisions-ID.", 404);
  const dir = path.join(await pipelineFolder(), id);
  await checkFolder(dir);
  const manifest = await optionalJson<Manifest>(dir, "revision.json");
  if (!manifest || manifest.id !== id) throw new LocalError("Bildrevisionen saknas.", 404);
  return { dir, manifest };
}

export async function pipelineList() {
  const root = await pipelineFolder();
  const folders = await fs.readdir(/* turbopackIgnore: true */ root, { withFileTypes: true });
  const revisions: Pick<Manifest, "id" | "created" | "files">[] = [];
  for (const entry of folders) {
    if (!entry.isDirectory() || !uuid.test(entry.name)) continue;
    const saved = await optionalJson<Manifest>(path.join(root, entry.name), "revision.json");
    if (saved) revisions.push({ id: saved.id, created: saved.created, files: saved.files });
  }
  return { revisions: revisions.sort((a, b) => b.created.localeCompare(a.created)) };
}

async function revisionState(dir: string, m: Manifest): Promise<PipelineRevision> {
  const files = await fs.readdir(/* turbopackIgnore: true */ dir);
  const mode = files.includes("series.json") ? "series" : files.includes("front.json") ? "front" : "draft";
  const jobs = Object.fromEntries(await Promise.all(m.steps.map(async ({ id }) => [id, await jobState(stepDir(dir, m, id))])));
  return { id: m.id, created: m.created, files: m.files, steps: m.steps, jobs, mode };
}

export async function pipelineRevision(id: string) {
  const { dir, manifest } = await loadRevision(id);
  return revisionState(dir, manifest);
}

async function verifiedBytes(dir: string, image: SavedImage) {
  if (path.basename(image.filename) !== image.filename) throw new LocalError("Ogiltig referensfil.", 409);
  const filename = path.join(dir, image.filename);
  const stat = await fs.lstat(/* turbopackIgnore: true */ filename);
  if (!stat.isFile()) throw new LocalError("Den sparade referensen är inte en vanlig bildfil.", 409);
  const bytes = await fs.readFile(/* turbopackIgnore: true */ filename);
  if (digest(bytes) !== image.sha256) throw new LocalError("Bildreferensen har ändrats efter sparning.", 409);
  return bytes;
}

export async function pipelineImage(id: string, selection: string | number) {
  const { dir, manifest } = await loadRevision(id);
  const source = typeof selection === "number";
  const folder = source ? dir : stepDir(dir, manifest, selection);
  await checkFolder(folder);
  const image = source ? manifest.sources[selection] : await optionalJson<SavedImage>(folder, "received.json")
    ?? await optionalJson<SavedImage>(folder, "output.json");
  if (!image || !["image/png", "image/jpeg", "image/webp"].includes(image.mime))
    throw new LocalError("Den valda bilden saknas eller har ett format som inte kan visas i studion.", 404);
  return new Response(new Uint8Array(await verifiedBytes(folder, image)), { headers: {
    "Content-Type": image.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}

async function submit(dir: string, m: Manifest, step: PipelineStep, remote: typeof fetch) {
  const folder = stepDir(dir, m, step.id);
  const template = m.templates[m.steps.findIndex((s) => s.id === step.id)];
  const references = [];
  const referenceImages = [];
  for (const [index, ref] of step.refs.entries()) {
    let parent = dir;
    let image: SavedImage | undefined = ref.source === "card" ? m.card : m.sources[ref.index ?? -1];
    if (ref.source === "step") {
      parent = stepDir(dir, m, ref.step ?? "");
      await checkFolder(parent);
      image = await optionalJson<SavedImage>(parent, "output.json");
    }
    if (!image) throw new LocalError("En nödvändig referens saknas.", 409);
    const uri = await dataUri(await verifiedBytes(parent, image), image.mime);
    const delivered = Buffer.from(uri.slice(uri.indexOf(",") + 1), "base64");
    references.push({ ...ref, sourceSha256: image.sha256, sha256: digest(delivered), bytes: delivered.length });
    referenceImages.push({ ...template.referenceImages[index], uri });
  }
  const payload = { ...template, referenceImages };
  await record(folder, "references.json", references);
  // Large references can take time to prepare. A sibling might have received
  // an uncertain acknowledgement since these slots were reserved.
  if (Object.values((await revisionState(dir, m)).jobs).some((job) => job.status === "unknown")) return;
  await submitTaskOnce(folder, createUrl, payload, remote);
}

async function saveResult(folder: string, bytes: Buffer, step: PipelineStep) {
  const metadata = await sharp(bytes).metadata().catch(() => undefined);
  const format = metadata?.format ?? "okänt";
  const mime = ["png", "jpeg", "webp"].includes(format) ? "image/" + format : "application/octet-stream";
  const sha256 = digest(bytes);
  const filename = sha256 + "." + (mime.startsWith("image/") ? format : "bin");
  const tmp = path.join(folder, "." + randomUUID() + ".pending");
  await fs.writeFile(/* turbopackIgnore: true */ tmp, bytes, { flag: "wx" });
  try {
    await fs.link(tmp, path.join(/* turbopackIgnore: true */ folder, filename)).catch((err) => {
      if (err.code !== "EEXIST") throw err;
    });
  } finally {
    await fs.unlink(tmp);
  }
  const received = { filename, mime, sha256, format, width: metadata?.width ?? null, height: metadata?.height ?? null };
  if (!(await record(folder, "received.json", received))) {
    const first = (await optionalJson<typeof received>(folder, "received.json"))!;
    if (first.sha256 !== sha256) {
      // Concurrent reads may receive different bytes. Validate the first archived
      // result consistently even after a process exits before recording its verdict.
      bytes = await verifiedBytes(folder, first);
      Object.assign(received, first);
    }
  }
  const { width, height } = received;
  const matches = received.format === "png" && (width + ":" + height) === step.ratio;
  const decodes = matches && await sharp(bytes, { failOn: "warning" })
    .resize(1, 1).raw().toBuffer().then(() => true, () => false);
  if (!decodes) {
    const size = width && height ? width + " × " + height + " px" : "okända pixelmått";
    const error = "Runway levererade " + received.format.toUpperCase() + ", " + size + ". Beställt: PNG, " + step.ratio.replace(":", " × ") +
      " px." + (matches ? " Bilddata kunde inte avkodas." : "") + " Originalsvaret har sparats.";
    await record(folder, "failed.json", error);
    return;
  }
  await record(folder, "output.json", received);
}

async function observe(folder: string, step: PipelineStep, task: Awaited<ReturnType<typeof getTask>>, remote: typeof fetch) {
  return observeTask(folder, task, async (url) => {
    const response = await fetchOutput(url, remote);
    await saveResult(folder, Buffer.from(await response.arrayBuffer()), step);
  });
}

async function advance(dir: string, m: Manifest, remote: typeof fetch) {
  const before = await revisionState(dir, m);
  const polls = m.steps.flatMap((step) => {
    const job = before.jobs[step.id];
    if (!job.taskId || (job.status !== "running" && job.status !== "queued")) return [];
    return [getTask(job.taskId, remote).then((task) => observe(stepDir(dir, m, step.id), step, task, remote))];
  });
  // Keep all known jobs observable even when one provider read fails.
  const pollFailure = (await Promise.allSettled(polls)).find((result) => result.status === "rejected");
  if (pollFailure) throw pollFailure.reason;

  // Each immutable reservation names up to three steps. An unfinished step keeps
  // its slot in the successor reservation, even across concurrent server processes.
  const entries = await fs.readdir(/* turbopackIgnore: true */ dir);
  const generation = Math.max(0, ...entries.filter((n) => /^slots-\d+\.json$/.test(n)).map((n) => Number(n.slice(6, -5))));
  const previous = await optionalJson<string[]>(dir, "slots-" + generation + ".json") ?? [];
  const state = await revisionState(dir, m);
  if (state.mode === "draft" || Object.values(state.jobs).some((job) => job.status === "unknown")) return state;
  const selected = state.mode === "series" ? m.steps : m.steps.slice(0, 1);
  const slots = previous.filter((id) => !["succeeded", "failed"].includes(state.jobs[id].status));
  for (const step of selected) {
    if (slots.length >= 3) break;
    if (!slots.includes(step.id) && state.jobs[step.id].status !== "failed" && state.jobs[step.id].status !== "succeeded" &&
      step.dependsOn.every((id) => state.jobs[id].status === "succeeded")) slots.push(step.id);
  }
  let reserved = slots;
  if (slots.some((id) => !previous.includes(id))) {
    const next = "slots-" + (generation + 1) + ".json";
    if (!(await record(dir, next, slots))) reserved = (await optionalJson<string[]>(dir, next))!;
  }
  const sends = reserved.filter((id) => state.jobs[id].status === "waiting").map((id) =>
    submit(dir, m, m.steps.find((step) => step.id === id)!, remote));
  const sendFailure = (await Promise.allSettled(sends)).find((result) => result.status === "rejected");
  if (sendFailure) throw sendFailure.reason;
  return revisionState(dir, m);
}

export async function pipelineAction(body: unknown, remote: typeof fetch = fetch): Promise<PipelineRevision> {
  if (!body || typeof body !== "object") throw new LocalError("Ogiltig bildbeställning.");
  const payload = body as Record<string, unknown>;
  if (payload.action === "draft") return createDraft(payload.files);
  if (typeof payload.id !== "string") throw new LocalError("Välj en sparad revision.");
  const { dir, manifest } = await loadRevision(payload.id);
  switch (payload.action) {
    case "start":
      if (payload.mode !== "series" && payload.mode !== "front") throw new LocalError("Välj ståfront eller serie.");
      runwayOptions();
      await record(dir, payload.mode + ".json", { started: new Date().toISOString() });
      return advance(dir, manifest, remote);
    case "sync":
      return advance(dir, manifest, remote);
    case "reconcile": {
      if (typeof payload.step !== "string" || !validTaskId(payload.taskId)) throw new LocalError("Ange bildsteg och giltigt Runway-jobb-ID.");
      const folder = stepDir(dir, manifest, payload.step);
      const job = await jobState(folder);
      if (job.taskId === payload.taskId) return revisionState(dir, manifest);
      if (job.status !== "unknown") throw new LocalError("Jobb-ID kan kopplas när beställningssvaret är osäkert.", 409);
      const state = await revisionState(dir, manifest);
      if (Object.values(state.jobs).some((other) => other.taskId === payload.taskId))
        throw new LocalError("Detta jobb-ID används redan i revisionen.", 409);
      const task = await getTask(payload.taskId, remote);
      if (!(await record(folder, "task.json", task.id))) throw new LocalError("Bildsteget har redan ett jobb-ID.", 409);
      await observe(folder, manifest.steps.find((s) => s.id === payload.step)!, task, remote);
      return revisionState(dir, manifest);
    }
    default:
      throw new LocalError("Okänd åtgärd för bildrevisionen.");
  }
}
