import { link, readFile, unlink, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";

export const digest = bytes => createHash("sha256").update(bytes).digest("hex");

export async function readIfPresent(filename) {
  try {
    return await readFile(filename);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function publish(filename, bytes) {
  const expected = digest(bytes);
  const requireSame = existing => {
    if (digest(existing) !== expected) throw Error("Annan utgåva finns i " + filename + ". Välj en ny utgåvemapp.");
  };
  const existing = await readIfPresent(filename);
  if (existing) return requireSame(existing);
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
