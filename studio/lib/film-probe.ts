import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { FilmFormat } from "./model";
import { LocalError } from "./storage";

const run = promisify(execFile);
function readFields(lines: string[], section: string): Record<string, string> {
  const row = lines.find((line) => line.startsWith(section + "|"));
  return Object.fromEntries((row?.split("|").slice(1) ?? []).map((pair) => pair.split("=")));
}
function positive(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
export async function probeFilm(file: string) {
  const { stdout } = await run(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "frame=best_effort_timestamp_time:stream=width,height,avg_frame_rate,codec_name,pix_fmt,bit_rate:format=format_name:format_tags=major_brand",
      "-of",
      "compact=p=1:nk=0",
      file,
    ],
    { windowsHide: true, timeout: 120000, maxBuffer: 64 * 1024 * 1024 },
  );
  const lines = stdout.split(/\r?\n/);
  const pts = lines.flatMap((line) => {
    const value = /^frame\|best_effort_timestamp_time=(-?\d+(?:\.\d+)?)(?:\||$)/.exec(line);
    return value ? [Number(value[1])] : [];
  });
  if (!pts.length) throw new LocalError("Inga läsbara bildtider hittades.");
  const times = pts.map((v) => Math.max(0, v - pts[0]));
  const stream = readFields(lines, "stream"), fileFormat = readFields(lines, "format");
  const [num, den] = (stream.avg_frame_rate ?? "").split("/").map(Number);
  const container = fileFormat.format_name ?? "";
  const brand = fileFormat["tag:major_brand"]?.trim();
  const format: FilmFormat = {
    width: positive(stream.width), height: positive(stream.height),
    fps: Number.isFinite(num / den) && num / den > 0 ? num / den : null,
    codec: stream.codec_name || "Okänd", pixelFormat: stream.pix_fmt || "Okänt",
    container: container.includes("mp4")
      ? brand === "qt" ? "MOV" : /^(isom|iso[2-9]|mp4[12]|avc1)$/i.test(brand ?? "") ? "MP4" : "MOV / MP4"
      : container || "Okänd",
    bitrate: positive(stream.bit_rate),
  };
  return { times, format };
}
