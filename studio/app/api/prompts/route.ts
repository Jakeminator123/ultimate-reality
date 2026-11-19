import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { validPreset } from "../../../lib/prompt-presets";
import { errorResponse, LocalError, promptFolder, publishExclusive, requireLocal } from "../../../lib/storage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    requireLocal(req);
    const folder = await promptFolder();
    const files = await fs.readdir(/* turbopackIgnore: true */ folder, { withFileTypes: true });
    const presets = await Promise.all(files.filter((file) => file.isFile() && /^[0-9a-f-]{36}\.json$/.test(file.name)).map(async (file) => {
      const value = JSON.parse(await fs.readFile(/* turbopackIgnore: true */ path.join(folder, file.name), "utf8"));
      if (!validPreset(value)) throw new LocalError("En sparad promptmall är ogiltig.");
      return { id: file.name.slice(0, -5), name: value.name, model: value.model, duration: value.duration, prompt: value.prompt, instruction: "Egen sparad startprompt." };
    }));
    return Response.json(presets.sort((a, b) => a.name.localeCompare(b.name, "sv")), { headers: { "Cache-Control": "no-store" } });
  } catch (err) { return errorResponse(err); }
}

export async function POST(req: Request) {
  try {
    requireLocal(req);
    const value = await req.json();
    if (!validPreset(value)) throw new LocalError("Kontrollera namn, prompt, modell och längd.");
    const id = randomUUID();
    const preset = { id, name: value.name.trim(), model: value.model, duration: value.duration, prompt: value.prompt, instruction: "Egen sparad startprompt." };
    await publishExclusive(await promptFolder(), id + ".json", JSON.stringify(preset, null, 2));
    return Response.json(preset, { status: 201 });
  } catch (err) { return errorResponse(err); }
}
