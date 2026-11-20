import { promises as fs } from "node:fs";
import path from "node:path";
import type { PipelineJob } from "./bildpipeline";
import { checkFolder, optionalJson, record } from "./bildpipeline-files";
import { API_VERSION, ENDPOINT } from "./model";
import { LocalError } from "./storage";

const timeout = 30_000;
const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;

export async function jobState(dir: string): Promise<PipelineJob> {
  await checkFolder(dir);
  const entries = new Set(await fs.readdir(/* turbopackIgnore: true */ dir));
  const taskId = entries.has("task.json") ? await optionalJson<string>(dir, "task.json") : undefined;
  if (entries.has("output.json")) return { status: "succeeded", taskId };
  if (entries.has("failed.json")) return { status: "failed", taskId, error: await optionalJson<string>(dir, "failed.json") };
  if (taskId) return { status: entries.has("running.json") ? "running" : "queued", taskId };
  if (!entries.has("request.json")) return { status: "waiting" };
  const stat = await fs.stat(/* turbopackIgnore: true */ path.join(dir, "request.json"));
  if (entries.has("unknown.json") || Date.now() - stat.mtimeMs > timeout + 10_000)
    return { status: "unknown", error: "Runway kan ha tagit emot beställningen. Koppla jobb-ID från Runway." };
  return { status: "submitting" };
}

export function runwayOptions() {
  const key = process.env.RUNWAYML_API_SECRET?.trim();
  if (!key) throw new LocalError("Runway-nyckeln saknas på servern.", 503);
  return {
    headers: { Authorization: "Bearer " + key, "X-Runway-Version": API_VERSION, "Content-Type": "application/json" },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(timeout),
  } satisfies RequestInit;
}

export function validTaskId(id: unknown): id is string {
  return typeof id === "string" && uuid.test(id);
}

export async function getTask(id: string, remote: typeof fetch) {
  if (!validTaskId(id)) throw new LocalError("Ange ett giltigt Runway-jobb-ID.");
  const opts = runwayOptions();
  const response = await remote(new URL("/v1/tasks/" + id, ENDPOINT).href, opts)
    .catch(() => { throw new LocalError("Runways jobbstatus kunde inte hämtas. Kontrollera samma jobb igen.", 502); });
  if (!response.ok) throw new LocalError("Runways jobbstatus kunde inte hämtas (HTTP " + response.status + ").", 502);
  const task = await response.json();
  if (task.id !== id || typeof task.status !== "string")
    throw new LocalError("Runways svar matchar inte det valda jobbet.", 502);
  return task as { id: string; status: string; output?: string[]; failureCode?: string };
}

// The only external asset URL accepted here comes from a verified Runway task response.
export async function fetchOutput(rawUrl: string | undefined, remote: typeof fetch) {
  const url = rawUrl ? URL.parse(rawUrl) : null;
  if (url?.protocol !== "https:" || url.username || url.password)
    throw new LocalError("Runway saknar en giltig resultatlänk. Kontrollera samma jobb igen.", 502);
  try {
    const response = await remote(url.href, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(timeout) });
    if (!response.ok || !response.body) throw new Error();
    return response;
  } catch {
    throw new LocalError("Resultatfilen kunde inte hämtas. Kontrollera samma jobb igen.", 502);
  }
}

export async function submitTaskOnce(folder: string, endpoint: string, payload: unknown, remote: typeof fetch,
  beforeAttach?: (id: string) => Promise<void>) {
  const opts = runwayOptions();
  // Publishing the exact wire payload is also the permanent claim for this billable call.
  if (!(await record(folder, "request.json", payload))) return;
  try {
    const response = await remote(endpoint, { ...opts, method: "POST", body: JSON.stringify(payload) });
    if (!response.ok) {
      await response.body?.cancel();
      const definite = response.status >= 400 && response.status < 500 && response.status !== 408;
      await record(folder, definite ? "failed.json" : "unknown.json", "Runway svarade HTTP " + response.status + ".");
      return;
    }
    const { id } = await response.json();
    if (!validTaskId(id)) throw new Error();
    await beforeAttach?.(id);
    await record(folder, "task.json", id);
  } catch {
    await record(folder, "unknown.json", true);
  }
}

export async function observeTask(folder: string, task: Awaited<ReturnType<typeof getTask>>,
  receive: (url: string | undefined) => Promise<void>) {
  switch (task.status) {
    case "PENDING":
    case "THROTTLED":
      return;
    case "RUNNING":
      await record(folder, "running.json", true);
      return;
    case "FAILED":
    case "CANCELED":
    case "CANCELLED":
      await record(folder, "failed.json", "Runway avslutade jobbet med " + task.status + ".");
      return;
    case "SUCCEEDED": {
      await receive(task.output?.[0]);
      return;
    }
    default:
      throw new LocalError("Runway returnerade ett okänt jobbläge. Kontrollera samma jobb igen.", 502);
  }
}
