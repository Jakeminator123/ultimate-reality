import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, promises as fs } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Exercise the same TypeScript modules Next runs, with a transport that has no network access.
const project = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !path.extname(specifier)) return next(specifier + ".ts", context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(new URL("../", import.meta.url).href) && !url.includes("/node_modules/")) {
      if (url.endsWith(".ts")) return { format: "module", shortCircuit: true,
        source: stripTypeScriptTypes(readFileSync(new URL(url), "utf8"), { mode: "transform" }) };
      if (url.endsWith(".json")) return { format: "module", shortCircuit: true,
        source: "export default " + readFileSync(new URL(url), "utf8") };
    }
    return next(url, context);
  },
});
const { pipelineAction, pipelineImage, pipelineRevision } = await import("../lib/bildpipeline-server.ts");
const { bildpipelinePlan } = await import("../lib/bildpipeline.ts");
const { verifiedPhotoReview, reviewPhotoSeries } = await import("../lib/photo-review.ts");
const { actOnFilmOrder, filmOrder, filmOrderOriginal, requestHash } = await import("../lib/film-order-server.ts");
const { API_VERSION, ENDPOINT } = await import("../lib/model.ts");
hooks.deregister();

test("en vald filmversion skickas en gång och samma jobb ger ett verifierat filmoriginal", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ultimate-filmorder-"));
  const lab = path.join(root, "ultimate-reality-lab");
  const orders = path.join(lab, "orders", "giv-plats-4");
  await fs.mkdir(orders, { recursive: true });
  await fs.mkdir(path.join(lab, "inputs"));
  await fs.writeFile(path.join(lab, ".owner"), "ultimate-reality-lab/v1");
  const priorRoot = process.env.ULTIMATE_REALITY_STORAGE, priorKey = process.env.RUNWAYML_API_SECRET;
  process.env.ULTIMATE_REALITY_STORAGE = root;
  process.env.RUNWAYML_API_SECRET = "offline-film-fixture";
  t.after(async () => {
    if (priorRoot === undefined) delete process.env.ULTIMATE_REALITY_STORAGE;
    else process.env.ULTIMATE_REALITY_STORAGE = priorRoot;
    if (priorKey === undefined) delete process.env.RUNWAYML_API_SECRET;
    else process.env.RUNWAYML_API_SECRET = priorKey;
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    await fs.rm(root, { recursive: true, force: true });
  });

  const source = path.join(root, "source.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=green:s=32x32:r=10",
    "-frames:v", "3", "-c:v", "mpeg4", source], { windowsHide: true });
  const bytes = await fs.readFile(source);
  const expectedSha = createHash("sha256").update(bytes).digest("hex");
  const payload = { model: "grok_imagine_1_5_lite", promptText: "Move one hand", duration: 5,
    ratio: "auto_720p", promptImage: [{ uri: "data:image/jpeg;base64," +
      (await sharp({ create: { width: 8, height: 8, channels: 3, background: "green" } }).jpeg().toBuffer()).toString("base64"), position: "first" }] };
  const ids = [randomUUID(), randomUUID()];
  const bodies = [payload, { ...payload, promptText: "Another hand motion" }];
  for (const [i, body] of bodies.entries()) await fs.writeFile(path.join(orders, "v" + (i + 1) + ".json"),
    JSON.stringify({ draft: { version: i + 1 }, request: { body, method: "POST", endpoint: ENDPOINT,
      transport: "runway-api", headers: { "X-Runway-Version": API_VERSION } } }));

  const sends = [], remainingPolls = new Set(ids);
  const transport = async (url, init) => {
    if (url === ENDPOINT && init?.method === "POST") {
      const request = JSON.parse(init.body);
      sends.push(request);
      if (request.promptText === bodies[1].promptText) throw Error("Response lost after submit");
      return Response.json({ id: ids[0] });
    }
    const id = ids.find(value => url === "https://api.dev.runwayml.com/v1/tasks/" + value);
    if (id) {
      if (remainingPolls.delete(id)) return Response.json({ id, status: "RUNNING" });
      return Response.json({ id, status: "SUCCEEDED", output: ["https://film.invalid/" + id] });
    }
    assert.ok(ids.some(value => url === "https://film.invalid/" + value));
    assert.equal(init?.headers, undefined, "API-nyckeln får bara användas hos Runway");
    return new Response(bytes);
  };
  const action = (version, operation, fields = {}) => actOnFilmOrder({ version, action: operation, ...fields }, transport);
  const start = version => action(version, "start", { requestSha256: requestHash(bodies[version - 1]) });
  assert.equal((await filmOrder(1)).job.status, "waiting");
  assert.equal((await action(1, "sync")).job.status, "waiting");
  await assert.rejects(action(1, "start", { requestSha256: requestHash(bodies[1]) }), /avviker/);
  assert.equal(sends.length, 0);
  await Promise.all([start(1), start(1), start(1)]);
  assert.deepEqual(sends, [bodies[0]]);
  assert.equal((await filmOrder(1)).job.taskId, ids[0]);
  assert.equal((await action(1, "sync")).job.status, "running");
  const done = await Promise.all([action(1, "sync"), action(1, "sync")]);
  assert.ok(done.every(item => item.result.sha256 === expectedSha));
  assert.deepEqual(done[0].result.format.width, 32);
  assert.equal(done[0].result.frames, 3);
  assert.equal(done[0].result.format.fps, 10);
  assert.deepEqual(await fs.readFile(path.join(orders, "v1-runway/original.mp4")), bytes);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(orders, "v1-runway/bildtider.json"), "utf8")), [0, 0.1, 0.2]);
  const range = await filmOrderOriginal(1, "bytes=0-7");
  assert.equal(range.status, 206);
  assert.deepEqual(Buffer.from(await range.arrayBuffer()), bytes.subarray(0, 8));

  assert.equal((await start(2)).job.status, "unknown");
  assert.equal((await start(2)).job.status, "unknown");
  await assert.rejects(action(2, "reconcile", { taskId: ids[0] }), /annan filmversion/);
  assert.equal((await action(2, "reconcile", { taskId: ids[1] })).job.taskId, ids[1]);
  assert.equal((await action(2, "sync")).result.sha256, expectedSha);
  assert.deepEqual(sends, bodies);
  const modified = Buffer.from(bytes);
  modified[0] ^= 1;
  await fs.writeFile(path.join(orders, "v2-runway/original.mp4"), modified);
  await assert.rejects(filmOrderOriginal(2, null), /avviker från kvittot/);
});

test("bildgranskning följer exakt utgåva och fil medan leveransmålen hämtas från bildpipelinen", () => {
  const hash = "a".repeat(64), edition = "fas-1/v1", file = "hander/handryggar.png";
  const entry = { file, sha256: hash, decision: "limited", note: "Tio fingertoppar syns.", cardPrint: "vit-ram-punkt-v1" };
  const data = { schema: 1, edition, views: [entry] };
  const review = verifiedPhotoReview(data, edition, file, hash);
  assert.equal(review.cardPrint, entry.cardPrint);
  assert.equal(verifiedPhotoReview(data, edition, file, "b".repeat(64)), undefined);
  assert.equal(verifiedPhotoReview(data, "fas-1/v2", file, hash), undefined);
  assert.equal(verifiedPhotoReview({ ...data, views: [entry, entry] }, edition, file, hash), undefined);
  const photo = { id: "hander/handryggar", sha256: hash, format: "PNG", width: 1536, height: 1024, review };
  const project = { photos: [photo], appearance: { sources: [{ sha256: hash, role: "surface" }] } };
  const rows = reviewPhotoSeries(project);
  const plan = bildpipelinePlan(["person.png"]);
  assert.deepEqual(rows.map(r => r.target.ratio), plan.map(s => s.ratio));
  const hand = rows.find(r => r.recipe.id === photo.id);
  assert.deepEqual(hand.roles, ["surface"]);
  assert.equal(hand.exactDelivery, false);
  assert.equal(rows.filter(r => r.usesCard).length, 3);
  const delivered = { ...photo, format: "PNG", width: 3504, height: 2336 };
  assert.equal(reviewPhotoSeries({ ...project, photos: [delivered] }).filter(r => r.exactDelivery).length, 1);
  assert.equal(reviewPhotoSeries({ ...project, photos: [{ ...delivered, format: "JPEG" }] }).filter(r => r.exactDelivery).length, 0);
});

test("en sparad revision genererar en ny ståfront, rätt barnbilder och aldrig två jobb för samma steg", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "ultimate-bildpipeline-"));
  const lab = path.join(temporary, "ultimate-reality-lab");
  const inputs = path.join(lab, "inputs");
  await fs.mkdir(inputs, { recursive: true });
  await fs.mkdir(path.join(lab, "orders"));
  await fs.writeFile(path.join(lab, ".owner"), "ultimate-reality-lab/v1");
  const previousRoot = process.env.ULTIMATE_REALITY_STORAGE;
  const previousKey = process.env.RUNWAYML_API_SECRET;
  process.env.ULTIMATE_REALITY_STORAGE = temporary;
  process.env.RUNWAYML_API_SECRET = "offline-fixture";
  t.after(async () => {
    if (previousRoot === undefined) delete process.env.ULTIMATE_REALITY_STORAGE;
    else process.env.ULTIMATE_REALITY_STORAGE = previousRoot;
    if (previousKey === undefined) delete process.env.RUNWAYML_API_SECRET;
    else process.env.RUNWAYML_API_SECRET = previousKey;
    assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
    await fs.rm(temporary, { recursive: true, force: true });
  });
  const png = (width, height, n) => sharp({ create: { width, height, channels: 3,
    background: { r: 17 + n, g: 185, b: 82 } } }).png().toBuffer();
  const files = ["skor.png", "profil.png", "porträtt.png", "sittande.png"];
  const originals = [];
  for (const [index, name] of files.entries()) {
    const bytes = await png(64, 96, index);
    originals.push(bytes);
    await fs.writeFile(path.join(inputs, name), bytes);
  }
  const card = await fs.readFile(path.join(project, "public/fotomall/kort/referenskort-x-v1.png"));
  const plan = bildpipelinePlan(files);
  assert.equal(plan.length, 12);
  assert.equal(plan[0].credits, 18);
  assert.equal(plan.reduce((sum, s) => sum + s.credits, 0), 225);
  assert.ok(bildpipelinePlan(Array.from({ length: 14 }, (_, i) => i + ".png")).every((s) => s.refs.length <= 16));
  assert.throws(() => bildpipelinePlan(Array.from({ length: 15 }, (_, i) => i + ".png")));
  const outputs = new Map();
  for (const [index, step] of plan.entries()) {
    const [width, height] = step.ratio.split(":").map(Number);
    outputs.set(step.id, await png(width, height, index + 10));
  }
  const requests = [];
  const tasks = new Map();
  let lostResponse = false;
  let invalidDimensions = false;

  async function remote(input, init = {}) {
    const url = new URL(String(input));
    if (url.origin === "https://api.dev.runwayml.com" && url.pathname === "/v1/text_to_image" && init.method === "POST") {
      const body = JSON.parse(init.body);
      const step = plan.find((s) => s.prompt === body.promptText);
      assert.ok(step);
      assert.equal(body.ratio, step.ratio);
      assert.deepEqual([body.model, body.quality, body.reasoningEffort, body.outputFormat, body.outputCount],
        ["gpt_image_2_6_sunburst", "high", "high", "png", 1]);
      assert.deepEqual(body.referenceImages.map((ref) => ref.tag), step.refs.map((ref) => ref.tag));
      for (const [index, ref] of step.refs.entries()) {
        const expected = ref.source === "step" ? outputs.get(ref.step) : ref.source === "card" ? card : originals[ref.index];
        const actual = Buffer.from(body.referenceImages[index].uri.split(",")[1], "base64");
        assert.ok(actual.equals(expected), step.id + " / " + ref.tag);
      }
      const id = randomUUID();
      tasks.set(id, step.id);
      requests.push({ id, step: step.id });
      if (lostResponse) throw new Error("Simulerat avbrott efter mottagen beställning");
      return Response.json({ id });
    }
    if (url.origin === "https://api.dev.runwayml.com" && url.pathname.startsWith("/v1/tasks/")) {
      const id = url.pathname.split("/").at(-1);
      assert.ok(tasks.has(id));
      return Response.json({ id, status: "SUCCEEDED", output: ["https://result.invalid/" + id] });
    }
    if (url.origin === "https://result.invalid") {
      assert.equal(new Headers(init.headers).has("authorization"), false);
      const step = tasks.get(url.pathname.slice(1));
      return new Response(invalidDimensions ? originals[0] : outputs.get(step), { headers: { "Content-Type": "image/png" } });
    }
    throw new Error("Oväntad nätadress i simulerat API");
  }

  const draft = await pipelineAction({ action: "draft", files }, remote);
  assert.equal(draft.mode, "draft");
  assert.equal(requests.length, 0);
  // A later change in the inbox must not change the paid revision.
  await fs.writeFile(path.join(inputs, files[0]), originals[2]);
  await Promise.all([0, 1].map(() => pipelineAction({ action: "start", id: draft.id, mode: "front" }, remote)));
  assert.deepEqual(requests.map((r) => r.step), ["staende/front"]);
  let state = await pipelineAction({ action: "sync", id: draft.id }, remote);
  assert.equal(state.jobs["staende/front"].status, "succeeded");
  assert.equal(requests.length, 1);
  state = await pipelineAction({ action: "start", id: draft.id, mode: "series" }, remote);
  assert.deepEqual(requests.slice(1).map((r) => r.step).sort(),
    ["staende/trekvart", "staende/profil", "sittande/front"].sort());
  for (let round = 0; round < 15 && Object.values(state.jobs).some((j) => j.status !== "succeeded"); round++) {
    await Promise.all([0, 1].map(() => pipelineAction({ action: "sync", id: draft.id }, remote)));
    state = await pipelineRevision(draft.id);
  }
  assert.ok(Object.values(state.jobs).every((j) => j.status === "succeeded"));
  assert.equal(new Set(requests.map((r) => r.step)).size, 12);
  assert.equal(requests.length, 12);
  const result = await pipelineImage(draft.id, "sittande/front");
  assert.ok(Buffer.from(await result.arrayBuffer()).equals(outputs.get("sittande/front")));

  await fs.writeFile(path.join(inputs, files[0]), originals[0]);
  const other = await pipelineAction({ action: "draft", files }, remote);
  lostResponse = true;
  state = await pipelineAction({ action: "start", id: other.id, mode: "series" }, remote);
  assert.equal(state.jobs["staende/front"].status, "unknown");
  await pipelineAction({ action: "sync", id: other.id }, remote);
  assert.equal(requests.length, 13);
  lostResponse = false;
  invalidDimensions = true;
  state = await pipelineAction({ action: "reconcile", id: other.id, step: "staende/front", taskId: requests.at(-1).id }, remote);
  assert.equal(state.jobs["staende/front"].status, "failed");
  await pipelineAction({ action: "sync", id: other.id }, remote);
  assert.equal(requests.length, 13);
  const archived = await pipelineImage(other.id, "staende/front");
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(hash(Buffer.from(await archived.arrayBuffer())), hash(originals[0]));
});
