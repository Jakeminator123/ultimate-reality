import type { DealerMaterial, MotionRecord } from "../lib/material-types";

const names = { ansiktsrigg: "Blinkning", tvahandsgiv: "Händer och kort", samspel: "Giv med blinkning" } as const;

export function takeLabel(take: string, fallback: string) {
  const match = /^(ansiktsrigg|tvahandsgiv|samspel)-v\d+-v(\d+)$/.exec(take);
  return match ? `${names[match[1] as keyof typeof names]} · prov ${match[2]}` : fallback;
}

export function takeLink(material: DealerMaterial, take: string, references?: "howcast-vip" | "original") {
  const query = new URLSearchParams({ dealer: material.dealer, tagning: take });
  if (material.revision) query.set("revision", material.revision);
  if (references) query.set("referenser", references);
  return "/modellering/rorelseprov?" + query + (references ? "#jamfor-giv" : "#vald-tagning");
}

export function MotionComponents({ material, motion }: { material: DealerMaterial; motion?: MotionRecord }) {
  const components = motion?.motion.components;
  if (!components?.length) return null;
  return <div><strong>Rörelser som kombineras på samma kropp</strong>
    <ul>{components.map(hash => {
      const part = material.motions.find(m => m.sha256 === hash);
      if (!part) return <li key={hash}>Källrörelse <code>{hash}</code></li>;
      const film = material.films.find(f => f.motion === hash && f.take === part.motion.take);
      const label = takeLabel(part.motion.take, film?.title ?? (part.motion.card ? "Kortprov" : "Rörelseprov"));
      return <li key={hash}>{film ? <a href={takeLink(material, film.take)}>{label}</a> :
        <a href={part.url} download={part.motion.take + ".glb"}>{label} · Hämta animerad 3D-modell (GLB)</a>}
        {" · "}<code>{part.motion.take}</code></li>;
    })}</ul>
  </div>;
}
