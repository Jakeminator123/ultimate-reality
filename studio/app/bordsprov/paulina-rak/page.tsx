import { readFile } from "node:fs/promises";
import path from "node:path";
import Comparison, { type TakeSummary } from "./Comparison";
import styles from "./comparison.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paulinas sittpose · Dealerstudion" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const file = path.resolve(process.cwd(), "../test/dealer/paulina/08-rak-v1/jamforelse.json");
  const [query, raw] = await Promise.all([searchParams, readFile(/* turbopackIgnore: true */ file, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  })]);
  if (!raw) return <main className={styles.page}><h1>Paulinas sittpose</h1><p>Jämförelsen finns på datorn där de båda tagningarna har renderats.</p><a href="/#modellering">Till 3D-modellering</a></main>;
  const take: TakeSummary = JSON.parse(raw);
  const frame = Number(query.ruta);
  return <Comparison take={take} initialFrame={Number.isInteger(frame) && frame >= 1 && frame <= take.total ? frame : 1}
    initialSeat={query.stol === "1" || query.stol === "4" ? query.stol : "bada"}
    initialView={query.vy === "hand" || query.vy === "bord" ? query.vy : "hallning"} />;
}
