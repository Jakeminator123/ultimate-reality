export const referenskort = {
  id: "referenskort-x-v1",
  fil: "/fotomall/kort/referenskort-x-v1.png",
  sha256: "2e2bfa870d4863cae7afdd0cec7ced91c6454bfe1915e7ddd04cb1be6b272708",
  breddMm: 63, hojdMm: 89,
  breddPx: 252, hojdPx: 356,
  fargutrymme: "sRGB",
  rygg: [152, 1, 9],
  x: [241, 240, 242],
  punkt: [222, 198, 250],
  punktlage: { horn: "övre vänster på den upprätta kortbaksidan", franVansterMm: 10, franOvanMm: 10, diameterMm: 6 },
} as const;

export const kortMedVitRam = {
  id: "vit-ram-punkt-v1",
  beskrivning: "Baksidan har ett enfärgat mörkrött fält, en tunn vit ram och en enda vit punkt som följer samma hörn när kortet vrids.",
} as const;

export type Kortstandard = typeof referenskort | typeof kortMedVitRam;

export function kortinstruktion(kort: Kortstandard) {
  if (kort.id === "vit-ram-punkt-v1") return kort.beskrivning;
  const { rygg, x, punkt, punktlage } = kort;
  return `Använd ett ${kort.breddMm} × ${kort.hojdMm} mm kort. Trycket går ända till kanten. Kortbaksidan är mörkröd, sRGB (${rygg.join(", ")}), med ett centrerat ljust X, sRGB (${x.join(", ")}). En ljuslila punkt, sRGB (${punkt.join(", ")}), är ${punktlage.diameterMm} mm i diameter och centrerad ${punktlage.franVansterMm} mm från vänster kant och ${punktlage.franOvanMm} mm från överkanten på den upprätta kortbaksidan. Behåll punkten i samma fysiska hörn när kortet vrids.`;
}
