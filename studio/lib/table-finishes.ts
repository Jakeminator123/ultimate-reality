type Finish = { value: string; name: string; scan?: string; metres?: number; quarterTurn?: boolean };
type Surface = { key: string; name: string; options: Finish[] };

export const tableFinishes: Surface[] = [
  { key: "matta", name: "Spelyta", options: [
    { value: "filt", name: "Grön filt" },
    { value: "gras", name: "Gräsmatta · Grass Ground", scan: "grass_ground", metres: 2.51 },
  ] },
  { key: "tra", name: "Träsarg", options: [
    { value: "valnot", name: "Valnötsfaner" },
    { value: "furu", name: "Lackerad furu · Coated Pine", scan: "coated_pine", metres: 0.74, quarterTurn: true },
  ] },
  { key: "reling", name: "Reling", options: [
    { value: "brun", name: "Brunt läder" },
    { value: "rodbrun", name: "Rödbrunt läder", scan: "leather_red_02", metres: 0.60 },
    { value: "denim", name: "Blå denim", scan: "denim_fabric", metres: 0.10 },
  ] },
];
