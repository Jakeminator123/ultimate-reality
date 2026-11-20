import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { errorResponse, folders, listAssets, LocalError, requireLocal } from "../../../lib/storage";
import type { ModelingInventory, SamPose } from "../../../lib/modeling";
import { modelFile } from "../../../lib/current-model";
import { dealerMaterial } from "../../../lib/dealer-material";

export const dynamic = "force-dynamic";
const execute = promisify(execFile);
const runId = /^sam-\d{8}T\d{6}Z-[a-f0-9]{12}$/;

async function readPoses(saved: string, run: string): Promise<SamPose[]> {
  if (!runId.test(run)) return [];
  const dir = path.join(saved, run);
  const stat = await fs.lstat(/* turbopackIgnore: true */ dir).catch(() => null);
  if (!stat?.isDirectory() || stat.isSymbolicLink()) return [];
  const files = new Set((await fs.readdir(/* turbopackIgnore: true */ dir, { withFileTypes: true }))
    .filter(file => file.isFile()).map(file => file.name));
  if (!files.has("run.json")) return [];
  const record = JSON.parse(await fs.readFile(/* turbopackIgnore: true */ path.join(dir, "run.json"), "utf8"));
  if (record.schema !== "ultimate-reality-lab/v1" || record.id !== run || record.state !== "complete" || !Array.isArray(record.inputs)) return [];
  return record.inputs.flatMap((input: { path?: string } | null, i: number) => {
    if (typeof input?.path !== "string") return [];
    const source = path.win32.basename(input.path);
    const base = String(i + 1).padStart(2, "0") + "-" + path.parse(source).name;
    return [{ run, index: i + 1, source, hasViewer: files.has(base + ".html"), hasSheet: files.has(base + ".png"),
      hasComparison: files.has(base + "-jamforelse.png"), hasFront: files.has(base + "-front.glb"),
      hasTablePose: files.has(base + "-bordsvila.glb"), hasAppearance: files.has(base + "-utseende.glb"),
      hasUpright: files.has(base + "-rak.glb") }];
  });
}

async function graphicsCard() {
  try {
    const { stdout } = await execute("nvidia-smi", ["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
      { windowsHide: true, timeout: 3000 });
    return stdout.trim().split(/\r?\n/).map(line => {
      const [name, mib] = line.split(", ");
      return name.replace(/^NVIDIA /, "") + " · " + (Number(mib) / 1024).toLocaleString("sv-SE", { maximumFractionDigits: 1 }) + " GiB";
    }).join(" / ");
  } catch {
    return null;
  }
}

async function localWeights() {
  const root = process.env.SAM3D_ROOT || path.resolve("..", "..", "sam-3d-body");
  const models = [["dinov3", "DINOv3"], ["vith", "ViT-H"]];
  const available = await Promise.all(models.map(async ([id, label]) => {
    const dir = path.join(root, "checkpoints", "sam-3d-body-" + id);
    const found = await Promise.all(["model.ckpt", "model_config.yaml", "assets/mhr_model.pt"]
      .map(file => fs.stat(/* turbopackIgnore: true */ path.join(dir, file)).then(s => s.isFile() && s.size > 0).catch(() => false)));
    return found.every(Boolean) ? [label] : [];
  }));
  return available.flat();
}

export async function GET(req: Request) {
  try {
    requireLocal(req);
    const query = new URL(req.url).searchParams;
    if (query.size === 1 && query.get("current") === "1")
      return Response.json({ activeModel: (await dealerMaterial()).activeModel }, { headers: { "Cache-Control": "private, no-store" } });
    if (query.has("model")) return await modelFile(query);
    const { root, inputs } = await folders();
    const saved = path.join(root, "saved");
    const savedStat = await fs.lstat(/* turbopackIgnore: true */ saved).catch((e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") return null;
      throw e;
    });
    if (savedStat && (!savedStat.isDirectory() || savedStat.isSymbolicLink())) throw new LocalError("Oväntad sökväg för sparade prov.");
    if (query.size) {
      const run = query.get("run") || "";
      const view = query.get("view");
      const poses = savedStat ? await readPoses(saved, run) : [];
      const pose = poses.find(p => String(p.index) === query.get("index"));
      if (!pose) throw new LocalError("Det sparade resultatet saknas.", 404);
      const extension = view === "mesh" && pose.hasViewer ? ".html"
        : view === "sheet" && pose.hasSheet ? ".png"
        : view === "comparison" && pose.hasComparison ? "-jamforelse.png"
        : view === "front" && pose.hasFront ? "-front.glb"
        : view === "bordsvila" && pose.hasTablePose ? "-bordsvila.glb"
        : view === "utseende" && pose.hasAppearance ? "-utseende.glb"
        : view === "rak" && pose.hasUpright ? "-rak.glb" : null;
      if (!extension) throw new LocalError("Det sparade resultatet saknas.", 404);
      const file = String(pose.index).padStart(2, "0") + "-" + path.parse(pose.source).name + extension;
      const bytes = await fs.readFile(/* turbopackIgnore: true */ path.join(saved, run, file));
      return new Response(new Uint8Array(bytes), { headers: {
        "Content-Type": extension.endsWith(".glb") ? "model/gltf-binary" : view === "mesh" ? "text/html; charset=utf-8" : "image/png",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src data: blob:; frame-ancestors 'self'",
      } });
    }
    const dirs = savedStat ? await fs.readdir(/* turbopackIgnore: true */ saved, { withFileTypes: true }) : [];
    const ids = dirs.filter(d => d.isDirectory() && runId.test(d.name)).map(d => d.name).sort().reverse();
    const [assets, runs, checkpoints, gpu, activeModel] = await Promise.all([
      listAssets(), Promise.all(ids.map(id => readPoses(saved, id))), localWeights(), graphicsCard(), dealerMaterial().then(p => p.activeModel),
    ]);
    const inventory: ModelingInventory = {
      inbox: inputs, images: assets.filter(a => a.kind === "image").map(a => a.name), poses: runs.flat(), checkpoints, gpu, activeModel,
    };
    return Response.json(inventory, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
