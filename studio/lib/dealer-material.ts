import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { rangedResponse } from "./byte-range";
import { bildrecept } from "../fotomall/bildrecept";
import type { GranskadVy } from "../fotomall/bildserie";
import { currentModel as legacyModel } from "./current-model";
import { cropSource, dimensions, roleName } from "./material-types";
import type { DealerMaterial, Edition, FilmRecord, FilmReview, ModelRecord, MotionRecord, Photo } from "./material-types";
import { LocalError } from "./storage";

const hex = /^[a-f0-9]{64}$/;
const slug = /^[a-z0-9][a-z0-9-]*$/;
const editionPath = /^fas-[1-9]\d*\/v[1-9]\d*$/;
const photoPath = /^[a-z0-9-]+\/[a-z0-9-]+\.(?:jpe?g|png|webp)$/;
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const cacheHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
function bad(message: string): never { throw new LocalError(message, 409); }
function avatarDir(dealer: string) {
  if (!slug.test(dealer)) throw new LocalError("Ogiltig dealer.", 400);
  return path.resolve("..", "avatars", dealer);
}
function url(dealer: string, fields: Record<string, string>) {
  return "/api/material?" + new URLSearchParams({ dealer, ...fields });
}
async function checkedPath(file: string) {
  try {
    const real = await fs.realpath(/* turbopackIgnore: true */ file);
    if (path.relative(file, real) !== "") bad("Materialet ligger utanför sin versionsmapp.");
    return real;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
async function bytes(file: string) {
  const real = await checkedPath(file);
  return real ? fs.readFile(/* turbopackIgnore: true */ real) : null;
}
async function record<T>(file: string): Promise<T | null> {
  const data = await bytes(file);
  return data ? JSON.parse(data.toString("utf8").replace(/^\uFEFF/, "")) : null;
}
async function records(folder: string) {
  const real = await checkedPath(folder);
  if (!real) return [];
  return (await fs.readdir(/* turbopackIgnore: true */ real)).filter(name => name.endsWith(".json") && hex.test(name.slice(0, -5))).sort();
}
export async function materialStamp(dealer: string) {
  const store = path.join(avatarDir(dealer), "3d", "versioner");
  const [active, ...registered] = await Promise.all([bytes(path.join(store, "aktiv.json")),
    ...["utgavor", "rorelser", "filmer", "granskningar"].map(group => records(path.join(store, group)))]);
  return createHash("sha256").update(JSON.stringify([active?.toString(), ...registered])).digest("hex");
}
async function lockedRecord<T>(folder: string, key: string): Promise<T | null> {
  if (!hex.test(key)) throw new LocalError("Ogiltig version.");
  const data = await bytes(path.join(folder, key + ".json"));
  if (!data) return null;
  if (digest(data) !== key) bad("Den sparade versionsbeskrivningen avviker.");
  return JSON.parse(data.toString("utf8").replace(/^\uFEFF/, ""));
}

type ImageRow = { fil: string; kategori: string; motiv: string; typ: string; sha256: string; vinkelGrader?: number };
export async function readPhotoEdition(dealer: string, edition: string, snapshot?: string) {
  if (!editionPath.test(edition)) throw new LocalError("Ogiltig bildutgåva.");
  const directory = path.join(avatarDir(dealer), edition);
  const store = path.join(avatarDir(dealer), "3d", "versioner");
  type Book = { avatar: string; fas: number; utgava: number; bilder: ImageRow[] };
  const [book, assessments] = await Promise.all([
    snapshot ? lockedRecord<Book>(path.join(store, "bildregister"), snapshot) : record<Book>(path.join(directory, "bildregister.json")),
    record<{ schemaVersion: number; vyer: GranskadVy[] }>(path.join(directory, "bildegenskaper.json")),
  ]);
  const photos: Photo[] = [], issues: string[] = [];
  if (!book) return { photos, issues: ["Bildregistret för " + edition + " saknas lokalt."] };
  if (book.avatar.toLowerCase() !== dealer || "fas-" + book.fas + "/v" + book.utgava !== edition || !Array.isArray(book.bilder))
    bad("Bildutgåvan stämmer inte med registret.");
  for (const row of book.bilder) {
    if (!photoPath.test(row.fil) || !hex.test(row.sha256)) bad("Ogiltig bildreferens i registret.");
    let image = await bytes(path.join(directory, row.fil));
    if (!image || digest(image) !== row.sha256) {
      issues.push(row.fil + (image ? " har ändrats sedan utgåvan sparades." : " saknas lokalt."));
      image = snapshot ? await bytes(path.join(store, "filer", row.sha256 + path.extname(row.fil))) : null;
      if (!image || digest(image) !== row.sha256) continue;
    }
    const { width, height, format } = await sharp(image).metadata();
    const id = row.fil.slice(0, row.fil.lastIndexOf("."));
    const recipe = bildrecept.find(r => r.id === id);
    const observed = assessments?.schemaVersion === 1 ? assessments.vyer.find(v => v.id === id &&
      v.filuppgifter.fil === row.fil && v.filuppgifter.sha256 === row.sha256 && v.filuppgifter.byte === image.length) : undefined;
    photos.push({ id, file: row.fil, name: recipe?.namn ?? row.motiv, group: row.kategori, kind: row.typ,
      sha256: row.sha256, width, height, format: format.toUpperCase(),
      targetAngle: typeof row.vinkelGrader === "number" && Number.isFinite(row.vinkelGrader) ? row.vinkelGrader : recipe?.vinkelGrader, observed,
      url: url(dealer, { edition, photo: row.fil, sha: row.sha256 }) });
  }
  return { photos, issues };
}

async function modelRecord(store: string, key: string, kind: ModelRecord["kind"], receipt: string) {
  if (!hex.test(key)) bad("Ogiltig modellversion.");
  const [metadata, file] = await Promise.all([
    bytes(path.join(store, "modeller", key + ".json")),
    bytes(path.join(store, "filer", key + ".glb")),
  ]);
  if (!metadata || !file) return null;
  if (digest(metadata) !== receipt) bad("Modellens källuppgifter avviker från utgåvan.");
  const model: ModelRecord = JSON.parse(metadata.toString("utf8"));
  if (digest(file) !== key || model.sha256 !== key || model.schema !== 1 || model.kind !== kind || !Array.isArray(model.sources))
    bad("GLB-filen avviker från den registrerade modellversionen.");
  return model;
}
async function motionsFor(dealer: string, store: string, geometry: string, appearance: string | null, issues: string[]) {
  const folder = path.join(store, "rorelser"), motions: DealerMaterial["motions"] = [];
  for (const name of await records(folder)) {
    const item = await lockedRecord<MotionRecord>(folder, name.slice(0, -5));
    if (!item || item.kind !== "motion" || item.motion.geometry !== geometry || (item.motion.appearance && item.motion.appearance !== appearance)) continue;
    if (!hex.test(item.sha256)) bad("Ogiltig animationsversion.");
    const file = await bytes(path.join(store, "filer", item.sha256 + ".glb"));
    if (!file || digest(file) !== item.sha256) { issues.push("Animationsfilen för " + item.motion.take + " avviker."); continue; }
    motions.push({ ...item, url: url(dealer, { model: item.sha256 }) });
  }
  return motions;
}
async function filmsFor(dealer: string, store: string, geometry: string, appearance: string | null, motions: DealerMaterial["motions"], issues: string[]) {
  const folder = path.join(store, "filmer");
  const films: DealerMaterial["films"] = [];
  const reviewFolder = path.join(store, "granskningar");
  const reviews = await Promise.all((await records(reviewFolder)).map(name => lockedRecord<FilmReview>(reviewFolder, name.slice(0, -5))));
  for (const name of await records(folder)) {
    const key = name.slice(0, -5);
    const film = await lockedRecord<FilmRecord>(folder, key);
    if (!film || film.schema !== 1 || film.geometry !== geometry || (film.appearance && film.appearance !== appearance)) continue;
    if (film.motion && !motions.some(m => m.sha256 === film.motion && m.motion.take === film.take && m.motion.card === film.card)) {
      issues.push("Animationsversionen för " + film.title + " saknas eller avviker."); continue;
    }
    if (!hex.test(film.sha256)) bad("Ogiltig filmreferens.");
    const file = await bytes(path.join(store, "filer", film.sha256 + ".mp4"));
    if (!file || digest(file) !== film.sha256) { issues.push(film.title + " saknas eller har ändrats."); continue; }
    films.push({ ...film, url: url(dealer, { film: key }), reviews: reviews.filter((r): r is FilmReview => r?.film === key) });
  }
  return films;
}
export async function dealerMaterial(dealer = "paulina", requested: string | null = null): Promise<DealerMaterial> {
  const store = path.join(avatarDir(dealer), "3d", "versioner");
  const editions = path.join(store, "utgavor");
  // Stamp first. If a writer publishes during the read, the next check requests fresh facts.
  const stamp = await materialStamp(dealer);
  const active = await bytes(path.join(store, "aktiv.json"));
  const revision = requested ?? (active && digest(active));
  const release = revision ? await lockedRecord<Edition>(editions, revision) : null;
  if (revision && !release) throw new LocalError("Modellutgåvan saknas.", 404);
  if (release && (release.schema !== 1 || !slug.test(release.id))) bad("Ogiltig modellutgåva.");
  const edition = release?.edition ?? "fas-1/v1";
  const { photos, issues } = await readPhotoEdition(dealer, edition, release?.photoRegister);
  const result: DealerMaterial = { dealer, edition, revision, stamp, photos, issues, activeModel: null,
    geometry: null, appearance: null, versions: [], motions: [], films: [] };
  if (!release) {
    if (dealer === "paulina") result.activeModel = await legacyModel();
    return result;
  }
  for (const name of await records(editions)) {
    const key = name.slice(0, -5);
    const version = await lockedRecord<Edition>(editions, key);
    if (version) result.versions.push({ key, name: version.name });
  }
  result.geometry = await modelRecord(store, release.geometry, "geometry", release.geometryRecord);
  if (!result.geometry) { issues.push("Den registrerade kroppsmodellen saknas lokalt."); return result; }
  result.activeModel = { id: release.id, name: release.name, url: url(dealer, { model: release.geometry }) };
  if (release.appearance) {
    const appearance = await modelRecord(store, release.appearance, "appearance", release.appearanceRecord ?? "");
    if (appearance && appearance.parent === release.geometry) {
      result.appearance = appearance;
      result.activeModel.appearanceUrl = url(dealer, { model: appearance.sha256 });
    } else issues.push("Den valda fotoytan saknas eller hör till en annan rigg.");
  }
  for (const source of [...result.geometry.sources, ...(result.appearance?.sources ?? [])]) {
    if (!photos.some(p => p.sha256 === source.sha256)) issues.push("Källbilden " + source.photo + " saknar verifierad motsvarighet i " + edition + ".");
  }
  result.motions = await motionsFor(dealer, store, release.geometry, result.appearance?.sha256 ?? null, issues);
  result.films = await filmsFor(dealer, store, release.geometry, result.appearance?.sha256 ?? null, result.motions, issues);
  return result;
}

export async function materialFile(query: URLSearchParams, range: string | null) {
  const dealer = query.get("dealer") ?? "paulina", root = avatarDir(dealer);
  const store = path.join(root, "3d", "versioner");
  let data: Buffer | null, expected: string, type: string;
  if (query.has("photo")) {
    const edition = query.get("edition") ?? "", photo = query.get("photo") ?? "";
    expected = query.get("sha") ?? "";
    if (!editionPath.test(edition) || !photoPath.test(photo) || !hex.test(expected)) throw new LocalError("Ogiltig bildversion.");
    data = await bytes(path.join(root, edition, photo));
    if (!data || digest(data) !== expected) {
      const archived = await bytes(path.join(store, "filer", expected + path.extname(photo)));
      if (archived) data = archived;
    }
    type = /\.jpe?g$/.test(photo) ? "image/jpeg" : photo.endsWith(".webp") ? "image/webp" : "image/png";
  } else if (query.has("model")) {
    expected = query.get("model") ?? "";
    if (!hex.test(expected)) throw new LocalError("Ogiltig modellversion.");
    data = await bytes(path.join(store, "filer", expected + ".glb"));
    type = "model/gltf-binary";
  } else if (query.has("film")) {
    const film = await lockedRecord<FilmRecord>(path.join(store, "filmer"), query.get("film") ?? "");
    if (!film || !hex.test(film.sha256)) throw new LocalError("Filmversionen saknas.", 404);
    expected = film.sha256;
    data = await bytes(path.join(store, "filer", expected + ".mp4"));
    type = "video/mp4";
  } else throw new LocalError("Välj en materialfil.");
  if (!data) throw new LocalError("Materialfilen saknas lokalt.", 404);
  if (digest(data) !== expected) bad("Materialfilen avviker från den valda versionen.");
  if (type === "video/mp4") {
    const movie = data;
    return rangedResponse(movie.length, type, range, (start, end) => new Uint8Array(movie.subarray(start, end + 1)), cacheHeaders["Cache-Control"]);
  }
  if (type.startsWith("image/") && query.get("vy") === "miniatyr") {
    data = await sharp(data).resize({ width: 176, height: 152, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    type = "image/webp";
  }
  return new Response(new Uint8Array(data), { headers: { ...cacheHeaders, "Content-Type": type } });
}

export function materialMarkdown(project: DealerMaterial) {
  const rows = ["# " + (project.activeModel?.name ?? project.dealer), "", "Bildutgåva " + project.edition,
    "Modellutgåva " + (project.revision ?? "saknas"), "", "## Bildoriginal", ""];
  for (const p of project.photos) {
    rows.push("- " + p.file + " · " + dimensions([p.width, p.height]) +
      " · " + p.format + (p.targetAngle !== undefined ? " · målvinkel " + p.targetAngle + "°" : "") + " · " + p.sha256);
    if (p.observed) rows.push("  - " + p.observed.observation.riktning + " " + p.observed.observation.ljus,
      "  - Osäkerhet · " + p.observed.osakerhet);
  }
  for (const model of [project.geometry, project.appearance]) {
    if (!model) continue;
    rows.push("", model.kind === "geometry" ? "## Kroppsmodell" : "## Fotoyta", "", "GLB " + model.sha256);
    if (model.parent) rows.push("Grundmodell " + model.parent);
    if (model.run) rows.push("SAM-körning " + model.run);
    if (model.atlas) rows.push("Inbäddad kroppstextur " + dimensions(model.atlas));
    rows.push("");
    for (const source of model.sources) {
      const photo = project.photos.find(p => p.sha256 === source.sha256);
      rows.push("- " + roleName[source.role] + " · " + (photo?.file ?? "Saknad källbild " + source.photo) + " · " + source.sha256);
      if (source.processing) {
        const { original, prepared, crop } = source.processing;
        rows.push("  - Bildoriginal " + dimensions(original) + ", inläst bild " + dimensions(prepared) + (crop ?
          ", kroppsutsnitt " + dimensions(crop.body) + ", handutsnitt " + dimensions(crop.hand) + " (" + cropSource[crop.evidence] + ")." : ". Utsnitt saknas."));
      }
    }
  }
  rows.push("", "## Registrerade animationer", "");
  if (!project.motions.length) rows.push("Inga verifierade animationer för modellparet.");
  for (const { sha256, motion } of project.motions) rows.push("- " + motion.take + " · GLB " + sha256 +
    " · " + motion.keyframes + " samplade tidslägen · " + motion.start + "–" + motion.end + " s · kort " + motion.card +
    " · kortbana " + motion.pathSha256);
  rows.push("", "## Registrerade filmer", "");
  if (!project.films.length) rows.push("Inga verifierade filmer för modellparet.");
  for (const film of project.films) {
    rows.push("- " + film.title + " · " + film.take + " · " + dimensions([film.width, film.height]) +
      " · " + film.fps + " fps · " + film.frames + " bildrutor · " + film.sha256,
      "  - Rigg " + film.geometry + " · fotoyta " + (film.appearance ?? "neutral") + " · kort " + (film.card ?? "inget"),
      "  - Kameror " + film.cameras.map(c => c.id + " (" + c.samples.length + " registrerade lägen)").join(", "),
      "  - Nollbaserade granskningsrutor · " + film.marks.map(m => m.frame + " " + m.label).join(", "));
    for (const review of film.reviews) rows.push("  - " + review.camera + ", ruta " + review.frames.join(", ") + " · " + review.note);
    if (film.motion) rows.push("  - Animation " + film.motion);
  }
  if (project.issues.length) rows.push("", "## Avvikelser", "", ...project.issues.map(issue => "- " + issue));
  return rows.join("\n") + "\n";
}
