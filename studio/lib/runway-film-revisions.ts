import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { optionalJson, checkFolder, record } from "./bildpipeline-files";
import { rangedResponse } from "./byte-range";
import type { FilmOrder } from "./film-order";
import { probeFilm } from "./film-probe";
import { API_VERSION, ENDPOINT, isDraftModel, type Payload } from "./model";
import { fetchOutput, getTask, jobState, observeTask, submitTaskOnce, validTaskId } from "./runway-tasks";
import { folders, LocalError } from "./storage";

export function requestHash(payload: Payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

type FilmOrderScope = "giv-plats-4" | "rorelseprov-dans";

export async function filmRevisionFolder(scope: FilmOrderScope) {
  const { revisions } = await folders();
  if (scope === "giv-plats-4") return revisions;
  const dir = path.join(path.dirname(revisions), scope);
  await fs.mkdir(/* turbopackIgnore: true */ dir, { recursive: true });
  await checkFolder(dir);
  return dir;
}

async function orderFiles(version: number, scope: FilmOrderScope) {
  if (!Number.isSafeInteger(version) || version < 1) throw new LocalError("Välj en sparad filmversion.");
  const revisions = await filmRevisionFolder(scope);
  const file = path.join(revisions, `v${version}.json`);
  const saved = await fs.lstat(/* turbopackIgnore: true */ file).catch((error) => {
    if (error.code === "ENOENT") throw new LocalError("Filmversionen saknas.", 404);
    throw error;
  });
  if (!saved.isFile()) throw new LocalError("Filmversionens register är ogiltigt.", 409);
  return { file, dir: path.join(revisions, `v${version}-runway`) };
}

async function readOrder(version: number, dir: string): Promise<FilmOrder> {
  const exists = await fs.lstat(/* turbopackIgnore: true */ dir).catch((err) => {
    if (err.code !== "ENOENT") throw err;
    return null;
  });
  if (!exists) return { version, job: { status: "waiting" } };
  const job = await jobState(dir);
  const result = job.status === "succeeded" ? await optionalJson<FilmOrder["result"]>(dir, "output.json") : undefined;
  return { version, job, result };
}

export async function filmOrder(version: number, scope: FilmOrderScope = "giv-plats-4") {
  return readOrder(version, (await orderFiles(version, scope)).dir);
}

async function readPayload(file: string, version: number, expected: unknown) {
  const saved = JSON.parse(await fs.readFile(/* turbopackIgnore: true */ file, "utf8"));
  const request = saved?.request;
  if (saved?.draft?.version !== version || request?.endpoint !== ENDPOINT || request.method !== "POST" ||
      request.transport !== "runway-api" || request.headers?.["X-Runway-Version"] !== API_VERSION ||
      !isDraftModel(request.body?.model))
    throw new LocalError("Versionen saknar en giltig sparad Runway-filmbeställning.", 409);
  if (requestHash(request.body) !== expected)
    throw new LocalError("Den visade beställningen avviker från den sparade versionen. Öppna versionen på nytt.", 409);
  return request.body as Payload;
}

async function bindTask(taskId: string, version: number, scope: FilmOrderScope) {
  const name = "runway-jobb-" + taskId.toLowerCase() + ".json";
  const { revisions } = await folders();
  const owner = scope === "giv-plats-4" ? version : `${scope}/v${version}`;
  if (!(await record(revisions, name, owner)) && await optionalJson<number | string>(revisions, name) !== owner)
    throw new LocalError("Runway-jobbet hör redan till en annan filmversion.", 409);
}

async function readOriginal(dir: string) {
  const filename = path.join(dir, "original.mp4");
  const stat = await fs.lstat(/* turbopackIgnore: true */ filename).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!stat) return null;
  if (!stat.isFile() || !stat.size) throw new LocalError("Det sparade filmoriginalet är ogiltigt.", 409);
  return { filename, bytes: stat.size };
}

async function filmHash(filename: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(/* turbopackIgnore: true */ filename)) hash.update(chunk);
  return hash.digest("hex");
}

// Publish complete provider bytes once, then derive the receipt from that local file.
// A later status check can finish probing after a crash or a temporarily missing ffprobe.
async function receiveFilm(dir: string, taskId: string, url: string | undefined, remote: typeof fetch) {
  let original = await readOriginal(dir);
  if (!original) {
    const response = await fetchOutput(url, remote);
    const temp = path.join(dir, "." + randomUUID() + ".part");
    try {
      await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
        createWriteStream(/* turbopackIgnore: true */ temp, { flags: "wx" }));
      const stat = await fs.stat(/* turbopackIgnore: true */ temp);
      if (!stat.size) throw new LocalError("Runways filmoriginal var tomt. Kontrollera samma jobb igen.", 502);
      await fs.link(temp, path.join(dir, "original.mp4")).catch((err) => { if (err.code !== "EEXIST") throw err; });
    } finally {
      await fs.unlink(/* turbopackIgnore: true */ temp).catch((err) => { if (err.code !== "ENOENT") throw err; });
    }
    original = await readOriginal(dir);
  }
  if (!original) throw new LocalError("Filmoriginalet saknas efter hämtning.", 500);
  const sha256 = await filmHash(original.filename);
  let measured;
  try { measured = await probeFilm(original.filename); }
  catch { throw new LocalError("Filmoriginalet är sparat. Kontrollera att ffprobe kan läsa original.mp4 och hämta status igen.", 502); }
  await record(dir, "bildtider.json", measured.times);
  await record(dir, "output.json", { taskId, filename: "original.mp4", sha256, bytes: original.bytes,
    frames: measured.times.length, format: measured.format, receivedAt: new Date().toISOString() });
}

export async function actOnFilmOrder(body: unknown, remote: typeof fetch = fetch, scope: FilmOrderScope = "giv-plats-4") {
  if (!body || typeof body !== "object") throw new LocalError("Välj en filmversion och åtgärd.");
  const { action, version, requestSha256, taskId } = body as Record<string, unknown>;
  if (typeof version !== "number") throw new LocalError("Ogiltig filmversion.");
  const { file, dir } = await orderFiles(version, scope);
  if (action === "start") {
    const payload = await readPayload(file, version, requestSha256);
    await fs.mkdir(/* turbopackIgnore: true */ dir, { recursive: true });
    await checkFolder(dir);
    // The wire request is also the cross-process claim for this billable order.
    await submitTaskOnce(dir, ENDPOINT, payload, remote, (id) => bindTask(id, version, scope));
    return readOrder(version, dir);
  }
  const state = await readOrder(version, dir);
  if (action === "sync") {
    if (state.job.taskId && (state.job.status === "queued" || state.job.status === "running")) {
      const id = state.job.taskId;
      const task = await getTask(id, remote);
      await observeTask(dir, task, (url) => receiveFilm(dir, id, url, remote));
    }
  } else if (action === "reconcile") {
    if (!validTaskId(taskId)) throw new LocalError("Ange ett giltigt Runway-jobb-ID.");
    if (state.job.taskId === taskId) return state;
    if (state.job.status !== "unknown") throw new LocalError("Ett jobb-ID kan kopplas när Runways beställningssvar är osäkert.", 409);
    const task = await getTask(taskId, remote);
    await bindTask(taskId, version, scope);
    if (!(await record(dir, "task.json", taskId))) throw new LocalError("Versionen har redan ett Runway-jobb.", 409);
    await observeTask(dir, task, (url) => receiveFilm(dir, taskId, url, remote));
  } else throw new LocalError("Okänd åtgärd för filmversionen.");
  return readOrder(version, dir);
}

export async function filmOrderOriginal(version: number, range: string | null, scope: FilmOrderScope = "giv-plats-4") {
  const { dir } = await orderFiles(version, scope);
  const { result } = await readOrder(version, dir);
  if (!result) throw new LocalError("Detta filmoriginal är ännu inte klart.", 404);
  const original = await readOriginal(dir);
  if (!original || original.bytes !== result.bytes || await filmHash(original.filename) !== result.sha256)
    throw new LocalError("Filmoriginalet avviker från kvittot.", 409);
  return rangedResponse(original.bytes, "video/mp4", range, (start, end) =>
    Readable.toWeb(createReadStream(/* turbopackIgnore: true */ original.filename, { start, end })) as ReadableStream);
}
