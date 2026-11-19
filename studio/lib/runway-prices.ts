// Public API estimates, in credits. Checked against Runway Dev on 2026-11-19.
export const priceSource = "https://docs.dev.runwayml.com/guides/pricing/";
export const formatSource = "https://docs.dev.runwayml.com/assets/inputs/";
export const deliverySource = "https://docs.dev.runwayml.com/guides/professional-outputs/";
export const draftModelId = "kling2.5_turbo_pro";

type Rate = { quality: string; output: number; reference?: number };
export type VideoModel = {
  id: string; name: string; use: string; inputs: string; geometry: string; evidence: string;
  rates: Rate[]; durations: number[]; formats?: string[];
  referenceRange?: [number, number]; imageLimit?: number;
};

export const seconds = (min: number, max: number) =>
  Array.from({ length: max - min + 1 }, (_, i) => min + i);

const proFormats = ["MP4", "ProRes MOV", "PNG-sekvens", "10-bitars SDR"];
export const videoModels: VideoModel[] = [
  { id: draftModelId, name: "Kling 2.5 Turbo Pro", use: "Utkastets modell",
    inputs: "Startbild och valfri slutbild.", geometry: "Referensen i utkastet är JPEG, 1280 × 720 (16:9). Filmen följer startbildens proportioner.",
    evidence: "Labbets lokala test verifierar bildbeskärning och JSON-export. Filmens visuella kvalitet återstår att bedöma.",
    rates: [{ quality: "Följer startbilden", output: 12 }], durations: [5, 10] },
  { id: "grok_imagine_1_5_lite", name: "Grok Imagine Video 1.5 Lite", use: "En kort rörelse från en bild",
    inputs: "En startbild styr bild-till-video. En bild kostar en extra kredit.",
    geometry: "1–15 s. Bildens proportioner behålls. 1080p skalas upp från 720p.",
    evidence: "Kandidat för blinkning eller en kort paus. Lokalt kvalitetsprov för givar saknas.",
    rates: [{ quality: "480p", output: 2 }, { quality: "720p", output: 3 }, { quality: "1080p", output: 14 }], durations: seconds(1, 15) },
  { id: "aleph2", name: "Aleph 2.0", use: "Ny vinkel på en bra giv",
    inputs: "Källfilm och upp till fem tidsatta nyckelbilder.", geometry: "Behåller källans upplösning upp till 1080p. Källfilm högst 30 fps.",
    evidence: "Jakob bedömde Paows sidovy som mycket bra. Begärda 35° blev cirka 40°. Original och sidovy var 1764 × 1174 vid 24 fps.",
    rates: [{ quality: "Som källfilmen", output: 28 }], durations: seconds(2, 30), formats: proFormats },
  { id: "kling_4", name: "Kling 4.0", use: "Kortets kontakt och landning",
    inputs: "Start, upp till åtta ordnade mellanbilder och slutbild. Rörelsereferens kan läggas till.",
    geometry: "720p eller 1080p. Bildstyrda tagningar följer underlagets utsnitt.",
    evidence: "Två tidiga provserier nådde mål på plats 4 i tre av fyra respektive två av två fall. Jakob underkände två senare givar på finger­greppet.",
    rates: [{ quality: "720p", output: 15.7, reference: 9.4 }, { quality: "1080p", output: 23.5, reference: 14.1 }], durations: seconds(3, 30), referenceRange: [3, 30] },
  { id: "seedance2_5", name: "Seedance 2.5", use: "Grepp från egen handfilm",
    inputs: "Ge dealerbilden ansvar för utseendet och referensfilmen för fingrar, rörelse och tempo. Filmen behöver minst 480p.",
    geometry: "Referensgenerering i bl.a. liggande eller stående format. Liggande 1080p ger 1920 × 1080 och 4K ger 3840 × 2160.",
    evidence: "Ett kandidatval för handrörelsen. En godkänd dealer­giv saknas i de lokala kvitton som granskats. MOV ger högre färgprecision för friläggning.",
    rates: [{ quality: "480p", output: 20, reference: 10 }, { quality: "720p", output: 30, reference: 15 }, { quality: "1080p", output: 68, reference: 34 }, { quality: "4K", output: 110, reference: 57 }],
    durations: seconds(4, 30), formats: ["MP4", "MOV"], referenceRange: [2, 30] },
  { id: "wan3", name: "WAN 3.0", use: "Början och slutet av en rörelse",
    inputs: "Start och slut, eller separat läge för bild-, video- och ljudreferenser.",
    geometry: "480p, 720p eller 1080p med adaptivt utsnitt. Den lokala 1080p-ingången gav 1764 × 1174 vid 30 fps.",
    evidence: "En ingång och ett kortsläp till plats 1 fungerade. I andra tagningar dök ett grått bord upp när handen lyftes.",
    rates: [{ quality: "480p", output: 5 }, { quality: "720p", output: 10 }, { quality: "1080p", output: 20 }], durations: seconds(2, 30) },
  { id: "gen4.5", name: "Gen-4.5", use: "Blick och små vilorörelser",
    inputs: "Text eller en startbild som styr ljus, identitet och komposition.",
    geometry: "Liggande 16:9 ger 1280 × 720. Stående och kvadratiska utsnitt finns också.",
    evidence: "Lämpligt prov för blick och andning. För grepp behöver resultatet bedömas bildruta för bildruta.",
    rates: [{ quality: "720p-klass", output: 12 }], durations: seconds(2, 10), formats: proFormats },
  { id: "kling_4_flash", name: "Kling 4.0 Flash", use: "Snabbt rörelseprov",
    inputs: "En startbild eller ett referensprov med bilder och film.", geometry: "720p. Upp till 20 sekunder referensfilm totalt.",
    evidence: "Fullversionens mellanbilder ger mer styrning när ett bestämt släpp ska träffas.",
    rates: [{ quality: "720p", output: 9.4, reference: 6.3 }], referenceRange: [3, 20], durations: seconds(3, 20) },
  { id: "gemini_omni_flash_1.2", name: "Gemini Omni 1.2 Flash", use: "Jämför flera referenser",
    inputs: "Kalkylen avser generering med upp till fem referensbilder och tre referensfilmer på högst tio sekunder var.",
    geometry: "16:9 eller 9:16. 360p till 4K.", evidence: "En möjlig jämförelsemodell. Lokal kvalitetsbedömning av en givning saknas.",
    rates: [{ quality: "360p", output: 2, reference: 1 }, { quality: "720p", output: 7, reference: 1 }, { quality: "1080p", output: 10, reference: 1 }, { quality: "4K", output: 21, reference: 1 }],
    durations: seconds(3, 15), referenceRange: [1, 30], imageLimit: 5 },
  { id: "act_two", name: "Act-Two", use: "Överför en filmad gest",
    inputs: "En framförandefilm styr gest och tempo. Använd en stillbild av dealern för hand- och kroppsgester.",
    geometry: "Bland annat 1280 × 720, 720 × 1280 eller 960 × 960.",
    evidence: "Passar ett prov med tydligt synliga händer. Kontakten mellan fingrar och kort behöver granskas separat.",
    rates: [{ quality: "720p-klass", output: 5 }], durations: seconds(3, 30) },
];

const sv = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 });
export const money = (credits: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "USD", currencyDisplay: "code" }).format(credits / 100);

export function quote(model: VideoModel, rate: Rate, duration: number, reference = 0, images = 0, format = "MP4", now = Date.now()) {
  let credits = duration * rate.output;
  let calculation = duration + " s × " + sv.format(rate.output);
  if (model.id === "kling_4" || model.id === "kling_4_flash") {
    if (reference > 0 && rate.reference) {
      credits = (duration + Math.max(reference, duration)) * rate.reference;
      calculation = "(" + duration + " s ut + " + Math.max(reference, duration) + " s debiterat underlag) × " + sv.format(rate.reference);
    }
    credits = Math.ceil(Number(credits.toFixed(6)));
    if (model.id === "kling_4" && now < Date.UTC(2026, 11, 1)) {
      credits = Math.ceil(credits * 80 / 100);
      calculation += " · avrundat uppåt, sedan 20 % kampanjrabatt t.o.m. 30 nov UTC och ny avrundning";
    } else if (model.id === "kling_4_flash") {
      credits = Math.max(29, credits);
    }
  } else {
    if (model.id === "grok_imagine_1_5_lite") {
      credits += 1;
      calculation += " + 1 startbild × 1";
    }
    if (reference > 0 && rate.reference) {
      credits += reference * rate.reference;
      calculation += " + " + reference + " s referens × " + rate.reference;
    }
    if (images && model.imageLimit) {
      credits += images;
      calculation += " + " + images + " bildreferenser × 1";
    }
    const surcharge = format === "10-bitars SDR" ? 20 : ["ProRes MOV", "PNG-sekvens"].includes(format) ? 5 : 0;
    if (surcharge) {
      credits += surcharge * duration;
      calculation += " + " + duration + " s format × " + surcharge;
    }
    const minimum = model.id === "seedance2_5" ? 80 : model.id === "gemini_omni_flash_1.2" ? 6 : 0;
    if (credits < minimum) calculation += " · minimipris " + minimum;
    credits = Math.max(credits, minimum);
  }
  return { credits, calculation };
}
