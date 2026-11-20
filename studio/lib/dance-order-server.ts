import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { digest, optionalJson } from "./bildpipeline-files";
import { rangedResponse } from "./byte-range";
import { danceSeconds, danceSeries, type DanceRevision } from "./dance-order";
import { filmRevisionFolder, requestHash } from "./runway-film-revisions";
import { probeFilm } from "./film-probe";
import { serveTrialResource } from "./local-trial-media";
import { API_VERSION, ENDPOINT, makePayload } from "./model";
import { LocalError, publishExclusive, revisionIds } from "./storage";

const source = "avatars/paulina/rorelseprov-dans/v1/";
const assets = {
  photo: [source + "referenser/paulina.png", "image/png"],
  motion: [source + "visning/rorelsereferens.mp4", "video/mp4"],
} as const;
type Material = { photo: string; motion: string; photoSha256: string; motionSha256: string; motionSeconds: number };
type DancePayload = ReturnType<typeof makePayload> & { referenceVideos: { uri: string }[] };
type RecordFile = {
  draft: { version: number; prompt: string };
  source: Pick<Material, "photoSha256" | "motionSha256" | "motionSeconds">;
  request: { body: DancePayload };
};

async function localAsset(kind: keyof typeof assets) {
  const [relative, mime] = assets[kind];
  const name = path.resolve(process.cwd(), "..", relative);
  const real = await fs.realpath(/* turbopackIgnore: true */ name).catch(() => "");
  if (path.relative(name, real) !== "" || !real)
    throw new LocalError(kind === "photo" ? "Paulinas startbild saknas." : "Den färdiga rörelsereferensen saknas.", 404);
  const details = await fs.stat(/* turbopackIgnore: true */ real);
  const prefix = "data:" + mime + ";base64,";
  if (!details.isFile() || !details.size || prefix.length + Math.ceil(details.size / 3) * 4 > 5 * 1024 ** 2)
    throw new LocalError("En källfil överskrider Runways gräns på 5 MB per kodad data-URI eller saknar innehåll.", 413);
  const bytes = await fs.readFile(/* turbopackIgnore: true */ real);
  return { real, bytes, uri: prefix + bytes.toString("base64") };
}

async function sourceMaterial(): Promise<Material> {
  const [photo, motion] = await Promise.all([localAsset("photo"), localAsset("motion")]);
  const [image, video] = await Promise.all([sharp(photo.bytes).metadata(), probeFilm(motion.real)]);
  if (image.format !== "png" || Math.min(image.width, image.height) < 300 || image.width >= image.height)
    throw new LocalError("Startbilden måste vara en stående PNG med minst 300 pixlar på varje sida.");
  const { fps, width, height, container } = video.format;
  if (!fps || !width || !height || fps < 24 || fps > 60 || Math.min(width, height) < 700 ||
      width / height < 0.4 || width >= height || !container.includes("MP4"))
    throw new LocalError("Rörelsereferensen måste vara stående MP4, minst 700 pixlar per sida och 24–60 bilder/s.");
  const motionSeconds = video.times[video.times.length - 1] + 1 / fps;
  if (Math.abs(motionSeconds - danceSeconds) > 0.001)
    throw new LocalError("Rörelseprovet ska vara exakt fyra sekunder långt.");
  return { photo: photo.uri, motion: motion.uri, photoSha256: digest(photo.bytes), motionSha256: digest(motion.bytes),
    motionSeconds: Math.round(motionSeconds * 1000) / 1000 };
}

async function readSaved(dir: string, version: number) {
  if (!Number.isSafeInteger(version) || version < 1) throw new LocalError("Ogiltig version.");
  const saved = await optionalJson<RecordFile>(dir, `v${version}.json`);
  if (!saved) throw new LocalError("Filmversionen finns inte.", 404);
  return saved;
}

function summary(record: RecordFile): DanceRevision {
  return { version: record.draft.version, prompt: record.draft.prompt, requestSha256: requestHash(record.request.body), ...record.source };
}

export async function danceDraft(version: number | null) {
  const dir = await filmRevisionFolder(danceSeries);
  const versions = await revisionIds(dir);
  const chosen = version ?? versions[0] ?? 0;
  return { versions, selected: chosen ? summary(await readSaved(dir, chosen)) : null };
}

export async function saveDanceDraft(input: unknown) {
  if (!input || typeof input !== "object") throw new LocalError("Ogiltigt filmutkast.");
  const { prompt, base, parent } = input as Record<string, unknown>;
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 26000 || typeof base !== "number" ||
      !Number.isSafeInteger(base) || base < 0 || typeof parent !== "number" || !Number.isSafeInteger(parent) ||
      parent < 0 || parent > base) throw new LocalError("Kontrollera versionsnummer och rörelsebeskrivning.");
  const dir = await filmRevisionFolder(danceSeries);
  const versions = await revisionIds(dir);
  if ((versions[0] ?? 0) !== base) throw new LocalError("En nyare dansversion finns. Ladda om först.", 409);
  const previous = parent ? await readSaved(dir, parent) : undefined;
  const material = previous ? { ...previous.source, photo: previous.request.body.promptImage[0].uri,
    motion: previous.request.body.referenceVideos[0].uri } : await sourceMaterial();
  const body = { ...makePayload(prompt, danceSeconds, material.photo, undefined, "kling_4", "1080p"),
    referenceVideos: [{ uri: material.motion }] };
  if (previous && requestHash(previous.request.body) === requestHash(body)) return { versions, selected: summary(previous) };
  const version = base + 1;
  const record = {
    draft: { version, prompt, model: "kling_4", quality: "1080p", duration: danceSeconds },
    parentVersion: parent || null, savedAt: new Date().toISOString(),
    source: { photoSha256: material.photoSha256, motionSha256: material.motionSha256, motionSeconds: material.motionSeconds },
    request: { transport: "runway-api", state: "draft", method: "POST", endpoint: ENDPOINT,
      headers: { "Content-Type": "application/json", "X-Runway-Version": API_VERSION }, body },
  };
  await publishExclusive(dir, `v${version}.json`, JSON.stringify(record));
  return { versions: [version, ...versions], selected: summary(record) };
}

export async function danceAsset(req: Request, kind: string, version: number) {
  if (kind !== "photo" && kind !== "motion") throw new LocalError("Okänd referens.", 404);
  if (!version) return serveTrialResource(req, assets[kind]);
  const { request } = await readSaved(await filmRevisionFolder(danceSeries), version);
  const uri = kind === "photo" ? request.body.promptImage[0].uri : request.body.referenceVideos[0].uri;
  const bytes = Buffer.from(uri.slice(uri.indexOf(",") + 1), "base64");
  const range = rangedResponse(bytes.length, assets[kind][1], req.headers.get("range"),
    (start, end) => req.method === "HEAD" ? new Uint8Array() : new Uint8Array(bytes.buffer, bytes.byteOffset + start, end - start + 1), "private, no-store");
  return req.method === "HEAD" ? new Response(null, { status: range.status, headers: range.headers }) : range;
}
