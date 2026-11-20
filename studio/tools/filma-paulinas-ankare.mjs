import { chromium } from "playwright-core";
import sharp from "sharp";
import { mkdir, readFile, writeFile, link, unlink, mkdtemp, rm } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../avatars/paulina/prov-ankare/v1/", import.meta.url));
const args = process.argv.slice(2);
const preview = args.includes("--preview");
const positional = args.filter(value => value !== "--preview");
assert.ok(positional.length <= 2 && !positional.some(value => value.startsWith("--")),
  "Använd filma-paulinas-ankare.mjs [scen.glb] [kameramapp] [--preview].");
const scene = positional[0] ? path.resolve(positional[0]) : path.join(root, "rigg/ankare.glb");
const out = positional[1] ? path.resolve(positional[1]) : path.join(root, "kameror");
const report = JSON.parse(await readFile(path.join(path.dirname(scene), "posematning.json"), "utf8"));
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
assert.equal(digest(await readFile(scene)), report.sceneSha256);
const asJson = value => Buffer.from(JSON.stringify(value, null, 2) + "\n");

async function readIfPresent(filename) {
  try {
    return await readFile(filename);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function publish(filename, bytes) {
  const expected = digest(bytes);
  const requireSame = existing => {
    if (digest(existing) !== expected) {
      throw Error("Annan utgåva finns i " + filename + ". Välj en ny utgåvemapp.");
    }
  };
  const existing = await readIfPresent(filename);
  if (existing) {
    requireSame(existing);
    return;
  }
  // Publish the complete file in one exclusive operation, even when two exports race.
  const staging = filename + "." + randomUUID() + ".tmp";
  try {
    await writeFile(staging, bytes, { flag: "wx" });
    try {
      await link(staging, filename);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      requireSame(await readFile(filename));
    }
  } finally {
    await unlink(staging).catch(error => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

const contactSheetName = "kontaktkarta-120.jpg";
const orbitMovie = "a23-kameraorbit.mp4";
const movementMovies = {
  frontSha256: "a1-till-a23-front.mp4",
  side70Sha256: "a1-till-a23-sida70.mp4",
  synchronousPairSha256: "a1-till-a23-synkron.mp4"
};
const movieNames = [orbitMovie, ...Object.values(movementMovies)];

async function verifyRelease() {
  const filename = path.join(out, "kameror.json");
  const bytes = await readIfPresent(filename);
  if (!bytes) return false;
  const release = JSON.parse(bytes);
  assert.equal(release.sceneSha256, report.sceneSha256, "Kamerakvittot tillhör en annan scen. Välj en ny utgåvemapp.");
  assert.equal(release.bodySha256, report.bodySha256);
  assert.equal(release.cameras, 120);
  assert.equal(release.orbit.length, 120, "Det befintliga kamerakvittot är ofullständigt. Välj en ny utgåvemapp.");
  assert.deepEqual(Object.keys(release.anchors).sort(), ["a1-front", "a1-sida70", "a23-front", "a23-sida70"]);
  const expectedPose = label => report.poses[label].poseSha256;
  for (const [index, pair] of release.orbit.entries()) {
    assert.equal(pair.azimuth, index * 3);
    assert.equal(pair.a1.poseSha256, expectedPose("A1"));
    assert.equal(pair.a23.poseSha256, expectedPose("A2.3"));
  }
  assert.equal(new Set(release.orbit.map(pair => JSON.stringify(pair.a23.cameraWorld))).size, 120);
  const images = [...Object.values(release.anchors), ...release.orbit.flatMap(pair => [pair.a1, pair.a23])];
  for (const image of images) {
    const target = path.resolve(out, image.image);
    assert.ok(target.startsWith(path.resolve(out) + path.sep), "Bildsökväg utanför kameramappen");
    assert.equal(image.poseSha256, expectedPose(image.pose));
    assert.equal(digest(await readFile(target)), image.sha256, target);
  }
  const media = {};
  for (const name of [contactSheetName, ...movieNames]) {
    media[name] = digest(await readFile(path.join(out, name)));
  }
  for (const [key, name] of Object.entries(movementMovies)) {
    assert.equal(media[name], release.movement[key]);
  }
  const sheet = await sharp(path.join(out, contactSheetName)).metadata();
  assert.equal(sheet.width, 1920);
  assert.equal(sheet.height, 1536);
  for (const name of movieNames) {
    const output = execFileSync("ffprobe", [
      "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=nb_frames,avg_frame_rate",
      "-of", "json", path.join(out, name)
    ], { encoding: "utf8" });
    const recorded = JSON.parse(output).streams[0];
    assert.equal(Number(recorded.nb_frames), name === orbitMovie ? 120 : report.animationFrames);
    assert.equal(recorded.avg_frame_rate, "24/1");
  }
  await publish(path.join(out, "publicering.json"), asJson({
    sceneSha256: report.sceneSha256,
    manifestSha256: digest(bytes),
    media
  }));
  return true;
}

if (await verifyRelease()) {
  console.log("Verifierade den befintliga utgåvan och 240 kamerabilder.");
  process.exit(0);
}
sharp.concurrency(4);
const origin = "http://127.0.0.1:4317";
const rendererPage = `<!doctype html><html><meta charset=utf-8><script type=importmap>{"imports":{"three":"/bordsprov/rum3d/three.module.js","three/addons/":"/bordsprov/rum3d/addons/"}}</script><body style="margin:0"><canvas></canvas><script type="module" src="/__ankare-prov/kamera.mjs"></script></body></html>`;
await mkdir(out, {
  recursive: true
});
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--enable-unsafe-swiftshader"]
});
const animatedTemp = await mkdtemp(path.join(os.tmpdir(), "paulina-ankare-rutor-"));
try {
  const page = await browser.newPage({
    viewport: {
      width: 1280,
      height: 720
    },
    deviceScaleFactor: 1
  });
  await page.route("**/__ankare-prov/kamera.mjs", request => request.fulfill({
    contentType: "text/javascript; charset=utf-8",
    path: fileURLToPath(new URL("./ankarkameran.mjs", import.meta.url))
  }));
  await page.route("**/__ankare-prov/ankare.glb", request => request.fulfill({
    contentType: "model/gltf-binary",
    path: scene
  }));
  await page.route("**/__ankare-prov/", request => request.fulfill({
    contentType: "text/html; charset=utf-8",
    body: rendererPage
  }));
  await page.goto(origin + "/__ankare-prov/");
  await page.waitForFunction(() => window.captureAnchor || window.problem);
  const problem = await page.evaluate(() => window.problem);
  if (problem) throw Error(problem);
  const manifest = {
    sceneSha256: report.sceneSha256,
    bodySha256: report.bodySha256,
    width: 1280,
    height: 720,
    cameras: 120,
    yawsStepDegrees: 3,
    verticalFovDegrees: 31,
    radiusM: 1.62,
    orbitCentreM: [.072, .862, .233],
    eyeAboveCentreM: .93,
    anchors: {},
    orbit: []
  };
  async function shot(label, yaw, filename, withMask = true) {
    const pose = report.poses[label],
      points = {
        ...pose.joints,
        shoeMouth: report.mouthM
      };
    const data = await page.evaluate(([time, yaw, points, mask]) => window.captureAnchor(time, yaw, points, mask), [pose.time, yaw, points, withMask]);
    const buffer = Buffer.from(data.png, "base64");
    await publish(filename, buffer);
    return {
      ...data.stats,
      image: path.relative(out, filename).replaceAll("\\", "/"),
      sha256: digest(buffer),
      pose: label,
      poseSha256: pose.poseSha256
    };
  }
  for (const [label, tag] of [["A1", "a1"], ["A2.3", "a23"]]) {
    for (const [yaw, angle] of [[0, "front"], [70, "sida70"]]) manifest.anchors[tag + "-" + angle] = await shot(label, yaw, path.join(out, tag + "-" + angle + ".png"));
  }
  if (!preview) {
    const folder = path.join(out, "120-kameror");
    await mkdir(folder, {
      recursive: true
    });
    const thumbs = [];
    let placard = 0;
    for (let n = 0; n < 120; n++) {
      const yaw = n * 3,
        number = String(n).padStart(3, "0"),
        pair = {
          number: n,
          azimuth: yaw
        };
      for (const [label, tag] of [["A1", "a1"], ["A2.3", "a23"]]) {
        const dest = path.join(folder, tag + "-" + number + ".png");
        if (n === 0) {
          await publish(dest, await readFile(path.join(out, tag + "-front.png")));
          pair[tag] = {
            ...manifest.anchors[tag + "-front"],
            image: "120-kameror/" + tag + "-" + number + ".png"
          };
        } else pair[tag] = await shot(label, yaw, dest);
      }
      manifest.orbit.push(pair);
      const cell = await sharp(path.join(out, pair.a23.image)).resize(192, 108).png().toBuffer();
      thumbs.push({
        input: cell,
        left: placard % 10 * 192,
        top: Math.floor(placard / 10) * 128
      });
      placard++;
    }
    const labels = Array.from({
      length: 120
    }, (_, i) => '<text x="' + (i % 10 * 192 + 6) + '" y="' + (Math.floor(i / 10) * 128 + 123) + '">' + i * 3 + '°</text>').join("");
    const legend = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1536"><g font-family="Segoe UI, sans-serif" font-size="13" fill="#eee">' + labels + '</g></svg>');
    const contactSheet = await sharp({
      create: {
        width: 1920,
        height: 1536,
        channels: 3,
        background: "#26332d"
      }
    }).composite([...thumbs, {
      input: legend,
      left: 0,
      top: 0
    }]).jpeg({
      quality: 92
    }).toBuffer();
    await publish(path.join(out, contactSheetName), contactSheet);
    const views = manifest.orbit.map(row => row.a23);
    assert.equal(new Set(views.map(view => view.sha256)).size, 120);
    assert.equal(new Set(views.map(view => view.poseSha256)).size, 1);
    assert.equal(new Set(views.map(view => JSON.stringify(view.cameraWorld))).size, 120);
    manifest.visibility = {
      viewsWithAnyYellow: views.filter(view => view.yellowConfirmedPixels > 0).length,
      viewsWithAtLeast100YellowPixels: views.filter(view => view.yellowConfirmedPixels >= 100).length,
      viewsWithBothHandsOver100Pixels: views.filter(view => view.visiblePixels.leftHand >= 100 && view.visiblePixels.rightHand >= 100).length,
      blindAngles: views.filter(view => view.yellowConfirmedPixels === 0).map(view => view.azimuth)
    };
    const ffmpeg = (pattern, file, fps) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-framerate", String(fps), "-i", pattern, "-c:v", "libx264", "-threads", "4", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", file]);
    ffmpeg(path.join(folder, "a23-%03d.png"), path.join(animatedTemp, orbitMovie), 24);
    for (let n = 0; n < report.animationFrames; n++) {
      for (const [yaw, tag] of [[0, "front"], [70, "sida70"]]) {
        const response = await page.evaluate(([time, angle]) => window.captureAnchor(time, angle, {}, false).png, [n / report.fps, yaw]);
        await writeFile(path.join(animatedTemp, tag + "-" + String(n).padStart(3, "0") + ".png"), Buffer.from(response, "base64"));
      }
    }
    const frontVideo = path.join(animatedTemp, movementMovies.frontSha256);
    const sideVideo = path.join(animatedTemp, movementMovies.side70Sha256);
    ffmpeg(path.join(animatedTemp, "front-%03d.png"), frontVideo, report.fps);
    ffmpeg(path.join(animatedTemp, "sida70-%03d.png"), sideVideo, report.fps);
    const paired = path.join(animatedTemp, movementMovies.synchronousPairSha256);
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", frontVideo, "-i", sideVideo, "-filter_complex", "[0:v][1:v]hstack=inputs=2", "-c:v", "libx264", "-threads", "4", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", paired]);
    manifest.movement = {
      frames: report.animationFrames,
      rate: report.fps,
      poseTimeRangeSeconds: [0, report.seconds],
      frontSha256: digest(await readFile(frontVideo)),
      side70Sha256: digest(await readFile(sideVideo)),
      synchronousPairSha256: digest(await readFile(paired))
    };
    for (const name of movieNames) {
      await publish(path.join(out, name), await readFile(path.join(animatedTemp, name)));
    }
  }
  await publish(path.join(out, preview ? "ankare.json" : "kameror.json"), asJson(manifest));
  if (!preview) await verifyRelease();
  console.log(JSON.stringify(Object.fromEntries(Object.entries(manifest.anchors).map(([name, a]) => [name, {
    pixels: a.visiblePixels,
    yellow: a.yellowMedianRGB
  }]))));
} finally {
  await browser.close();
  assert.equal(path.dirname(animatedTemp), path.resolve(os.tmpdir()));
  assert.ok(path.basename(animatedTemp).startsWith("paulina-ankare-rutor-"));
  await rm(animatedTemp, {
    recursive: true,
    force: true
  });
}
