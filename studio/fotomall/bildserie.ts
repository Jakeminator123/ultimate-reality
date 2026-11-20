import { bildrecept, skapaBildprompt, type Bildreferens } from "./bildrecept";
import { referenskort, type Kortstandard } from "./kortstandard";

export type GranskadVy = {
  id: string;
  filuppgifter: {
    fil: string;
    breddPx: number;
    hojdPx: number;
    byte: number;
    format: string;
    kanaler: string;
    exif: boolean;
    bakgrundsprov: string;
    sha256: string;
  };
  observation: { riktning: string; ljus: string; iakttagelse: string };
  osakerhet: string;
  kalla: string;
};

export function skapaBildserie(referenser: Bildreferens[], avatar = "", granskade: GranskadVy[] = [], standard: Kortstandard = referenskort) {
  const egnaKort = referenser.filter((bild) => bild.roll.trim() === "Kortets mönster" && bild.namn.trim());
  return {
    schemaVersion: 1,
    avatar,
    referenser,
    kortstandard: egnaKort.length ? { id: "egen-kortreferens", filer: egnaKort.map((bild) => bild.namn.trim()) } : standard,
    vyer: bildrecept.map((recept) => {
      const bild = granskade.find((rad) => rad.id === recept.id);
      return {
        id: recept.id,
        recept,
        prompt: skapaBildprompt(recept, referenser, standard),
        filuppgifter: bild?.filuppgifter ?? {
          fil: "", breddPx: null, hojdPx: null, byte: null, format: "",
          kanaler: "", exif: null, bakgrundsprov: "", sha256: "",
        },
        observation: bild?.observation ?? { riktning: "", ljus: "", iakttagelse: "" },
        osakerhet: bild?.osakerhet ?? "",
        kalla: bild?.kalla ?? "",
      };
    }),
  };
}
