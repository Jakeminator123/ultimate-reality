import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { rangedResponse } from "./byte-range";
import { bildrecept } from "../fotomall/bildrecept";
import type { GranskadVy } from "../fotomall/bildserie";
import { currentModel as legacyModel } from "./current-model";
import { cropSource, dimensions, hasReviewedSeatCameras, roleName } from "./material-types";
import { bodyPixels, checkSeatedFrame, floorSpread, readSeatedMeasurement, seatedStandard } from "./seated-review";
import { verifiedPhotoReview } from "./photo-review";
import type { DealerMaterial, Edition, FilmRecord, FilmReview, ModelRecord, MotionRecord, Photo } from "./material-types";
import type { ActiveDealerModel } from "./modeling";
import type dealingStudy from "../../information/paulina-rorelseunderlag.json";
import { LocalError } from "./storage";

const hex = /^[a-f0-9]{64}$/;
const slug = /^[a-z0-9][a-z0-9-]*$/;
const editionPath = /^fas-[1-9]\d*\/v[1-9]\d*$/;
const photoPath = /^[a-z0-9-]+\/[a-z0-9-]+\.(?:jpe?g|png|webp)$/;
const profileTrialPath = /^granskning\/sittprofil-front-v[1-9]\d*\/profil\.png$/;
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
export async function materialStamp(dealer: string, revision: string | null = null) {
  const avatar = avatarDir(dealer), store = path.join(avatar, "3d", "versioner");
  const [active, ...registered] = await Promise.all([bytes(path.join(store, "aktiv.json")),
    ...["utgavor", "rorelser", "filmer", "granskningar"].map(group => records(path.join(store, group)))]);
  const release = revision ? await lockedRecord<Edition>(path.join(store, "utgavor"), revision) :
    active ? JSON.parse(active.toString("utf8")) as Edition : null;
  const edition = release?.edition ?? "fas-1/v1";
  if (!editionPath.test(edition)) bad("Ogiltig bildutgåva.");
  const observations = await Promise.all(["bildegenskaper.json", "sittande-bildskala.json", "sittande-kamerapunkter-v1.json", "utgavegranskning-v1.json",
    "granskning/sittprofilprov.json", "granskning/sittmodellprov.json"]
    .map(name => bytes(path.join(avatar, edition, name))));
  return digest(Buffer.from(JSON.stringify([active?.toString(), ...registered, revision, ...observations.map(b => b && digest(b))])));
}
async function lockedRecord<T>(folder: string, key: string): Promise<T | null> {
  if (!hex.test(key)) throw new LocalError("Ogiltig version.");
  const data = await bytes(path.join(folder, key + ".json"));
  if (!data) return null;
  if (digest(data) !== key) bad("Den sparade versionsbeskrivningen avviker.");
  return JSON.parse(data.toString("utf8").replace(/^\uFEFF/, ""));
}

async function optionalRecord<T>(folder: string, key: string, issues: string[]): Promise<T | null> {
  try { return await lockedRecord<T>(folder, key); }
  catch (error) {
    if (!(error instanceof LocalError || error instanceof SyntaxError)) throw error;
    issues.push("Versionsuppgifterna i " + path.basename(folder) + "/" + key + ".json kunde inte verifieras.");
    return null;
  }
}

async function verifiedMedia(store: string, sha256: string, extension: ".glb" | ".mp4") {
  try {
    const file = await bytes(path.join(store, "filer", sha256 + extension));
    return file !== null && digest(file) === sha256;
  } catch (error) {
    if (!(error instanceof LocalError)) throw error;
    return false;
  }
}

type ImageRow = { fil: string; kategori: string; motiv: string; typ: string; sha256: string; vinkelGrader?: number };
export async function readPhotoEdition(dealer: string, edition: string, snapshot?: string) {
  if (!editionPath.test(edition)) throw new LocalError("Ogiltig bildutgåva.");
  const directory = path.join(avatarDir(dealer), edition);
  const store = path.join(avatarDir(dealer), "3d", "versioner");
  const photos: Photo[] = [], issues: string[] = [];
  async function optionalMeasurement(name: string) {
    try { return await record<unknown>(path.join(directory, name)); }
    catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      issues.push(name + " kunde inte tolkas. Granskningsunderlag kan saknas.");
      return null;
    }
  }
  type Book = { avatar: string; fas: number; utgava: number; bilder: ImageRow[] };
  const [book, assessments, scales, seatPoints, reviews] = await Promise.all([
    snapshot ? lockedRecord<Book>(path.join(store, "bildregister"), snapshot) : record<Book>(path.join(directory, "bildregister.json")),
    record<{ schemaVersion: number; vyer: GranskadVy[] }>(path.join(directory, "bildegenskaper.json")),
    optionalMeasurement("sittande-bildskala.json"),
    optionalMeasurement("sittande-kamerapunkter-v1.json"),
    optionalMeasurement("utgavegranskning-v1.json"),
  ]);
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
      seated: id.startsWith("sittande/") ? readSeatedMeasurement({ file: row.fil, sha256: row.sha256, width, height }, edition, scales, seatPoints) : undefined,
      review: verifiedPhotoReview(reviews, edition, row.fil, row.sha256),
      targetAngle: typeof row.vinkelGrader === "number" && Number.isFinite(row.vinkelGrader) ? row.vinkelGrader : recipe?.vinkelGrader, observed,
      url: url(dealer, { edition, photo: row.fil, sha: row.sha256 }) });
  }
  return { photos, issues };
}

export async function readSeatedProfileTrial(dealer: string, edition: string) {
  if (!editionPath.test(edition)) throw new LocalError("Ogiltig bildutgåva.");
  const folder = path.join(avatarDir(dealer), edition);
  type Review = {
    schema: number; release: string; selected: string; modelRevision: string; frontSha256: string;
    views: { file: string; sourceSha256: string }[];
  };
  const review = await record<Review>(path.join(folder, "granskning", "sittprofilprov.json")).catch(error => {
    if (error instanceof SyntaxError) bad("Profilprovets granskningsfil kunde inte tolkas.");
    throw error;
  });
  if (!review) return null;
  if (review.schema !== 1 || review.release !== edition || !hex.test(review.modelRevision) ||
      !hex.test(review.frontSha256) || !profileTrialPath.test(review.selected) || !Array.isArray(review.views))
    bad("Profilprovets versionsunderlag är ogiltigt.");
  const row = review.views.find(view => view?.file === review.selected);
  if (!row || !hex.test(row.sourceSha256)) bad("Det valda profilprovet saknar bildversion.");
  const data = await bytes(path.join(folder, row.file));
  if (!data) return null;
  if (digest(data) !== row.sourceSha256) bad("Profilprovet avviker från den uppmätta bilden.");
  const { width, height, format } = await sharp(data).metadata();
  const identity = { width, height, sha256: row.sourceSha256, file: row.file };
  const seated = readSeatedMeasurement(identity, edition, review, review);
  if (!seated || format !== "png") bad("Profilprovets mätning stämmer inte med filen.");
  const photo = { ...identity, seated, id: "sittande/profilprov", name: "Ny sittprofil", group: "Sittande",
    targetAngle: 90, format: "PNG", kind: "profilprov", url: url(dealer, { edition, photo: row.file, sha: row.sourceSha256 }) };
  return { photo, revision: review.modelRevision, frontSha256: review.frontSha256 };
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

type ReviewedTrialTake = { film: DealerMaterial["films"][number]; animation: MotionRecord; receipt: string };
type SeatedTrial = ActiveDealerModel & Partial<ReviewedTrialTake> & {
  run: string | null; appearanceError?: string; reviewedTakes?: ReviewedTrialTake[];
};

export async function seatedTrialModel(material: DealerMaterial, trial: Photo, includeFilm = false): Promise<SeatedTrial | null> {
  const avatar = avatarDir(material.dealer);
  type Candidate = { schema: number; baseRevision: string; profile: string; geometry: string; modelRecord: string;
    appearance?: string; appearanceRecord?: string; motion?: string; filmRecord?: string; name: string; run: string };
  const candidate = await record<Candidate>(path.join(avatar, material.edition, "granskning", "sittmodellprov.json"));
  if (!candidate || candidate.baseRevision !== material.revision || candidate.profile !== trial.sha256) return null;
  if (candidate.schema !== 1 || !hex.test(candidate.modelRecord) || !candidate.name) bad("Sittmodellprovet saknar versionsunderlag.");
  const store = path.join(avatar, "3d", "versioner");
  const model = await modelRecord(store, candidate.geometry, "geometry", candidate.modelRecord);
  if (!model || !material.geometry) return null;
  const original = material.photos.find(photo => photo.id === "sittande/profil");
  const expected = material.geometry.sources.map(source => ({ role: source.role, sha256: source.sha256 === original?.sha256 ? trial.sha256 : source.sha256 }));
  if (model.run !== candidate.run || !expected.some(source => source.role === "posture" && source.sha256 === trial.sha256) ||
      model.sources.length !== expected.length || expected.some(s => !model.sources.some(c => c.sha256 === s.sha256 && c.role === s.role)))
    bad("Sittmodellprovets källbilder avviker från fotona i jämförelsen.");
  const body = { id: model.sha256, name: candidate.name, run: model.run, url: url(material.dealer, { model: model.sha256 }) };
  if (candidate.appearance === undefined && candidate.appearanceRecord === undefined) return body;
  try {
    if (!candidate.appearance || !candidate.appearanceRecord || !hex.test(candidate.appearanceRecord))
      bad("Sittmodellprovets fotoyta saknar ett giltigt kvitto.");
    const look = await modelRecord(store, candidate.appearance, "appearance", candidate.appearanceRecord);
    if (!look || look.parent !== model.sha256) bad("Sittmodellprovets fotoyta saknas eller tillhör en annan kropp.");
    const withAppearance = { ...body, appearanceUrl: url(material.dealer, { model: look.sha256 }) };
    if (!includeFilm) return withAppearance;
    const reviewedTakes = await reviewedTrialTakes(material.dealer, model.sha256, look.sha256, material.issues);
    const selected = reviewedTakes.find(take => take.receipt === candidate.filmRecord && take.animation.sha256 === candidate.motion);
    return { ...withAppearance, reviewedTakes, ...selected };
  } catch (error) {
    if (!(error instanceof LocalError || error instanceof SyntaxError)) throw error;
    return { ...body, appearanceError: "Fotoytan kunde inte verifieras för den här SAM-kroppen. Provet visas med neutral yta." };
  }
}

export async function currentSeatedTrial(project: DealerMaterial): Promise<Awaited<ReturnType<typeof seatedTrialModel>> | null> {
  if (project.dealer !== "paulina" || project.edition !== "fas-1/v1" || !project.revision) return null;
  try {
    const trial = await readSeatedProfileTrial(project.dealer, project.edition);
    if (trial?.revision === project.revision && project.photos.some(p => p.id === "sittande/front" && p.sha256 === trial.frontSha256 && p.seated))
      return await seatedTrialModel(project, trial.photo, true);
  } catch (error) {
    if (!(error instanceof LocalError || error instanceof SyntaxError)) throw error;
    project.issues.push("SAM-provet med den nya sittprofilen kunde inte verifieras.");
  }
  return null;
}

export async function reviewedTrialFilm(dealer: string, geometry: string, appearance: string, motion: string, receipt: string) {
  if (!hex.test(motion) || !hex.test(receipt)) return;
  const takes = await reviewedTrialTakes(dealer, geometry, appearance, [], receipt);
  return takes.find(take => take.animation.sha256 === motion);
}

export async function reviewedTakeForLink(dealer: string, geometry: string, take: string, receipt?: string) {
  if (!hex.test(geometry) || !slug.test(take) || (receipt !== undefined && !hex.test(receipt))) return;
  const folder = path.join(avatarDir(dealer), "3d", "versioner", "filmer");
  const keys = receipt ? [receipt] : (await records(folder)).map(name => name.slice(0, -5));
  let match: ReviewedTrialTake | undefined;
  for (const key of keys) {
    const film = await optionalRecord<FilmRecord>(folder, key, []);
    if (film?.take !== take || film.geometry !== geometry || (film.appearance !== null && !hex.test(film.appearance)) || !film.motion) continue;
    const verified = await reviewedTrialFilm(dealer, geometry, film.appearance, film.motion, key);
    if (!verified) continue;
    // A name alone cannot identify two distinct film receipts.
    if (match) return;
    match = verified;
  }
  return match;
}

async function reviewedTrialTakes(dealer: string, geometry: string, appearance: string, issues: string[], receipt?: string): Promise<ReviewedTrialTake[]> {
  const store = path.join(avatarDir(dealer), "3d", "versioner");
  try {
    const motions = await motionsFor(dealer, store, geometry, appearance, issues);
    const byMotion = new Map(motions.filter(m => m.parent === appearance && m.motion.appearance === appearance)
      .map(m => [m.sha256, m]));
    const films = await filmsFor(dealer, store, geometry, appearance, motions, issues, receipt);
    return films.flatMap(film => {
      const animation = film.motion && byMotion.get(film.motion);
      return animation && film.appearance === appearance && hasReviewedSeatCameras(film)
        ? [{ film, animation, receipt: film.receipt }] : [];
    });
  } catch (error) {
    if (!(error instanceof LocalError || error instanceof SyntaxError)) throw error;
    issues.push("Filmregistret för sittmodellprovet kunde inte verifieras.");
    return [];
  }
}
async function motionsFor(dealer: string, store: string, geometry: string, appearance: string | null, issues: string[]) {
  const folder = path.join(store, "rorelser"), motions: DealerMaterial["motions"] = [];
  for (const name of await records(folder)) {
    const item = await optionalRecord<MotionRecord>(folder, name.slice(0, -5), issues);
    if (!item || item.schema !== 1 || item.kind !== "motion" || item.motion?.geometry !== geometry || (item.motion.appearance && item.motion.appearance !== appearance)) continue;
    if (!hex.test(item.sha256)) { issues.push("Ogiltig animationsversion i " + name + "."); continue; }
    if (!await verifiedMedia(store, item.sha256, ".glb")) { issues.push("Animationsfilen för " + item.motion.take + " avviker."); continue; }
    motions.push({ ...item, url: url(dealer, { model: item.sha256 }) });
  }
  return motions;
}
async function filmsFor(dealer: string, store: string, geometry: string, appearance: string | null, motions: DealerMaterial["motions"], issues: string[], receipt?: string) {
  const folder = path.join(store, "filmer");
  const films: (DealerMaterial["films"][number] & { receipt: string })[] = [];
  const reviewFolder = path.join(store, "granskningar");
  const reviews = await Promise.all((await records(reviewFolder)).map(name => optionalRecord<FilmReview>(reviewFolder, name.slice(0, -5), issues)));
  const keys = receipt ? [receipt] : (await records(folder)).map(name => name.slice(0, -5));
  for (const key of keys) {
    const film = await optionalRecord<FilmRecord>(folder, key, issues);
    if (!film || film.schema !== 1 || film.geometry !== geometry || (film.appearance && film.appearance !== appearance)) continue;
    if (film.motion && !motions.some(m => m.sha256 === film.motion && m.motion.take === film.take && m.motion.card === film.card)) {
      issues.push("Animationsversionen för " + film.title + " saknas eller avviker."); continue;
    }
    if (!hex.test(film.sha256)) { issues.push("Ogiltig filmreferens i " + key + "."); continue; }
    if (!await verifiedMedia(store, film.sha256, ".mp4")) { issues.push(film.title + " saknas eller har ändrats."); continue; }
    films.push({ ...film, receipt: key, url: url(dealer, { film: key }), reviews: reviews.filter((r): r is FilmReview => r?.film === key) });
  }
  return films;
}
export async function dealerMaterial(dealer = "paulina", requested: string | null = null): Promise<DealerMaterial> {
  const store = path.join(avatarDir(dealer), "3d", "versioner");
  const editions = path.join(store, "utgavor");
  // Stamp first. If a writer publishes during the read, the next check requests fresh facts.
  const stamp = await materialStamp(dealer, requested);
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
    const trial = profileTrialPath.test(photo);
    if (!editionPath.test(edition) || !(photoPath.test(photo) || trial) || !hex.test(expected)) throw new LocalError("Ogiltig bildversion.");
    data = await bytes(path.join(root, edition, photo));
    if (!trial && (!data || digest(data) !== expected)) {
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
    if (query.has("ruta")) {
      const study = (await readDealingStudies(dealer)).find(candidate =>
        candidate.takes.some(take => take.movie === expected) && candidate.decodedStill.movie === expected &&
        String(candidate.decodedStill.frame) === query.get("ruta"));
      const still = study?.decodedStill;
      if (!still || !hex.test(still.sha256))
        throw new LocalError("En avkodad kontrollbild saknas för denna film och ruta.", 404);
      let frame = await bytes(path.join(store, "filer", still.sha256 + ".png"));
      if (!frame && study?.takes.some(take => take.take === "samspel-v2-v1" && take.movie === expected))
        frame = await bytes(path.resolve("..", "test/dealer/paulina/samspel-v2-bildkontroll-v1/avkodad-ruta-53.png"));
      if (!frame) throw new LocalError("Kontrollbilden finns inte på den här datorn.", 404);
      if (digest(frame) !== still.sha256) bad("Kontrollbilden avviker från den granskade rutan.");
      return new Response(new Uint8Array(frame), { headers: { ...cacheHeaders, "Content-Type": "image/png" } });
    }
    const movie = data;
    return rangedResponse(movie.length, type, range, (start, end) => new Uint8Array(movie.subarray(start, end + 1)), cacheHeaders["Cache-Control"]);
  }
  if (type.startsWith("image/") && query.get("vy") === "miniatyr") {
    data = await sharp(data).resize({ width: 176, height: 152, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    type = "image/webp";
  }
  return new Response(new Uint8Array(data), { headers: { ...cacheHeaders, "Content-Type": type } });
}

export type DealingStudy = typeof dealingStudy & {
  draw: { pressFrame?: number };
  turn?: { frame: number };
  rest?: { frame: number };
  handover: { note?: string };
  frameLayout?: "two-seats-with-details";
  frameLayoutNote?: string;
  handReference?: { file: string; sha256: string; frames: number[] };
};
export async function readDealingStudies(dealer: string): Promise<DealingStudy[]> {
  if (dealer !== "paulina") return [];
  const dir = path.resolve("..", "information");
  const names = (await fs.readdir(/* turbopackIgnore: true */ dir))
    .filter(name => /^paulina-rorelseunderlag(?:-v[1-9]\d*)?\.json$/.test(name));
  const studies = await Promise.all(names.map(name => record<DealingStudy>(path.join(dir, name))));
  return studies.filter((study): study is DealingStudy => study !== null);
}

export function materialMarkdown(project: DealerMaterial, origin?: string) {
  const rows = ["# " + (project.activeModel?.name ?? project.dealer), "", "Bildutgåva " + project.edition,
    "Modellutgåva " + (project.revision ?? "saknas"), "", "## Bildoriginal", ""];
  const front = project.photos.find(p => p.id === "sittande/front");
  for (const p of project.photos) {
    rows.push("- " + p.file + " · " + dimensions([p.width, p.height]) +
      " · " + p.format + (p.targetAngle !== undefined ? " · målvinkel " + p.targetAngle + "°" : "") + " · " + p.sha256);
    if (p.observed) rows.push("  - " + p.observed.observation.riktning + " " + p.observed.observation.ljus,
      "  - Osäkerhet · " + p.observed.osakerhet);
    if (p.review) rows.push("  - " + (p.review.decision === "usable" ? "Användbar som referens. " : "Användbar med förbehåll. ") +
      p.review.note + (p.review.cardPrint ? " Korttryck " + p.review.cardPrint + "." : ""));
    if (p.seated && front?.seated) {
      const frame = { ...p, seated: p.seated };
      const check = checkSeatedFrame(frame, { ...front, seated: front.seated });
      rows.push("  - Hjässa–sula " + bodyPixels(frame) + " px. Skalskillnad mot sittfront " +
        check.scaleDelta.toLocaleString("sv-SE", { maximumFractionDigits: 2 }) + " %. Utsnitt " +
        (check.review ? "för granskning" : "inom gränserna") + " (skala " + seatedStandard.scalePercent +
        " %, höjdläge " + seatedStandard.centrePercent + " % av bildhöjden, identiska bildmått).");
      const spread = floorSpread(p.seated.marks, 2);
      if (p.seated.marks) rows.push("  - Säkra stolkontakter " +
        p.seated.marks.feet.filter(f => f.visible === "centre").length + "/4. " +
        (spread ? "De synliga punkterna spänner över " + spread.widthPixels + " px i sidled och " + spread.pixels + " px i höjdled." : "Par av synliga kontaktcentrum saknas.") +
        (spread && spread.centres < 4 ? " Hela stolens spann är okänt." : "") +
        " Punktosäkerhet skattad till ±" + p.seated.marks.uncertaintyPx + " px.");
    }
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
  if (project.seatedTrial) {
    const { name, id, film, films = [] } = project.seatedTrial;
    rows.push("", "## SAM-kroppsprov", "", name + " · GLB " + id);
    const takes = film ? [film, ...films.filter(take => take.url !== film.url)] : films;
    for (const take of takes) {
      const link = origin ? new URL(take.url, origin).href : take.url;
      rows.push("", "[" + take.take + "](" + link + ") · film " + take.sha256 +
        (take.poses ? " · start " + take.poses.start + " · slut " + take.poses.end : "") + (take.url === film?.url ? " · vald tagning" : ""));
    }
  }
  rows.push("", "## Registrerade animationer", "");
  if (!project.motions.length) rows.push("Inga verifierade animationer för modellparet.");
  for (const { sha256, motion } of project.motions) rows.push("- " + motion.take + " · GLB " + sha256 +
      " · " + motion.keyframes + " samplade tidslägen · " + motion.start + "–" + motion.end + " s" +
      (motion.card ? " · kort " + motion.card + " · kortbana " : " · rörelsens tidslinje ") + motion.pathSha256 +
      (motion.components?.length ? " · källtagningar " + motion.components.join(", ") : "") +
      (motion.faceSurface ? " · ansiktsyta " + motion.faceSurface.revision + " · textur " + motion.faceSurface.bodyAtlasSHA256 : ""));
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
