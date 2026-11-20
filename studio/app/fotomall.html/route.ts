import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { errorResponse, requireLocal } from "../../lib/storage";
import { nextPhotos, referenceFiles, shots } from "../../fotomall/mall";

export const dynamic = "force-dynamic";
const root = path.resolve(process.cwd(), "..");
const avatar = path.join(root, "avatars", "paulina");
const takeDir = path.join(root, "test/dealer/paulina/08-rak-v1");
const guideDir = path.resolve(process.cwd(), "fotomall");
type Ref = keyof typeof referenceFiles;
const refIds = Object.keys(referenceFiles) as Ref[];

async function optional(file: string): Promise<Buffer | null> {
  try {
    return await readFile(/* turbopackIgnore: true */ file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
async function present(file: string) {
  try {
    return (await stat(/* turbopackIgnore: true */ file)).isFile();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
}
const uri = (data: Buffer, mime: string) =>
  "data:" + mime + ";base64," + data.toString("base64");

async function currentRun() {
  const raw = await optional(path.join(takeDir, "jamforelse.json"));
  if (!raw) return null;
  const report = JSON.parse(raw.toString("utf8"));
  if (
    report.version !== "08-rak-v1" ||
    report.take !== "skoriktning-70-30-v1" ||
    report.total !== 33
  )
    return null;
  const frame = 17;
  const pairs = await Promise.all(
    (["bord", "hand"] as const).map(async (view) => {
      const [four, one] = await Promise.all(
        ["4", "1"].map((seat) =>
          optional(
            path.join(
              takeDir,
              "efter",
              frame + "-" + seat + "-" + view + ".webp",
            ),
          ),
        ),
      );
      return four && one
        ? { "4": uri(four, "image/webp"), "1": uri(one, "image/webp") }
        : null;
    }),
  );
  if (!pairs[0] || !pairs[1]) return null;
  return {
    run: report.run,
    frame,
    total: report.total,
    before: report.beforeDegrees,
    after: report.afterDegrees,
    travel: report.travel[frame - 1],
    bord: pairs[0],
    hand: pairs[1],
  };
}

async function reference(id: Ref, exportFile: boolean, origin: string) {
  const ref = referenceFiles[id];
  const file = path.join(avatar, ref.name);
  if (!(await present(file))) return null;
  const previewFile = path.join(
    root,
    "test/dealer/paulina/fotomall-v1/kallbilder",
    id + ".webp",
  );
  const preview = await optional(previewFile);
  // Include attachment-quality sources for the two requested prompts in the portable copy.
  const full =
    !preview || (exportFile && (id === "03" || id === "09"))
      ? await optional(file)
      : null;
  if (!preview && !full) return null;
  const sourceUrl = origin + "/fotomall.html?kallbild=" + id;
  return {
    id,
    ...ref,
    preview: preview ? uri(preview, "image/webp") : uri(full!, "image/png"),
    attachment: exportFile && full ? uri(full, "image/png") : sourceUrl,
  };
}

export async function GET(request: Request) {
  try {
    requireLocal(request);
    const url = new URL(request.url);
    const origin = url.protocol + "//" + request.headers.get("host");
    const sourceId = url.searchParams.get("kallbild");
    if (sourceId !== null) {
      if (!refIds.includes(sourceId as Ref))
        return new Response("Okänd grundbild.", { status: 404 });
      const name = referenceFiles[sourceId as Ref].name;
      const bytes = await optional(path.join(avatar, name));
      if (!bytes)
        return new Response("Grundbilden saknas på labbdatorn.", {
          status: 404,
        });
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": 'attachment; filename="' + name + '"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const exportFile = url.searchParams.get("hamta") === "1";
    if (url.pathname === "/fotomall.html" && !exportFile) {
      // Picture and download query URLs stay compatible. Fragments of the old
      // guide are only visible in the browser, so forward them there.
      return new Response(`<!doctype html><html lang="sv"><meta charset="utf-8"><title>Dealerstudions fotomall</title>
        <script>location.replace(location.hash ? "/ovrigt/fotomall" + location.hash : "/bildstandard")</script>
        <p><a href="/bildstandard">Bildstandard för en dealer</a> · <a href="/ovrigt/fotomall">Äldre fotomall med docka</a></p></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
    }
    const [template, font, examples, references, current, next] =
      await Promise.all([
        readFile(
          /* turbopackIgnore: true */ path.join(guideDir, "fotomall.mall.html"),
          "utf8",
        ),
        readFile(
          /* turbopackIgnore: true */ path.resolve(
            "node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2",
          ),
        ),
        Promise.all(
          shots.map(async (shot) => {
            const bytes = await readFile(
              /* turbopackIgnore: true */ path.resolve(
                "public/fotomall/docka",
                shot.id + ".webp",
              ),
            );
            return { ...shot, image: uri(bytes, "image/webp") };
          }),
        ),
        Promise.all(refIds.map((id) => reference(id, exportFile, origin))),
        currentRun(),
        Promise.all(
          nextPhotos.map(async (photo) => ({
            ...photo,
            saved: await present(path.join(avatar, photo.file)),
          })),
        ),
      ]);
    const data = {
      origin,
      portable: exportFile,
      phaseOneAvailable: await present(path.join(avatar, "fas-1/v1/index.html")),
      shots: examples,
      refs: references.filter((r) => r !== null),
      current,
      next,
    };
    const html = template
      .replace("__FONT_URI__", () => uri(font, "font/woff2"))
      .replace("__GUIDE_JSON__", () =>
        JSON.stringify(data).replace(/</g, "\\u003c"),
      );
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...(exportFile
          ? {
              "Content-Disposition":
                'attachment; filename="Fotomall-steg-1.html"',
            }
          : {}),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
