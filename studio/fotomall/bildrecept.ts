import { kortinstruktion, referenskort, type Kortstandard } from "./kortstandard";

export const basvyer = {
  "staende/front": { roll: "Godkänd ståfront", anvandning: "helkroppens proportioner och klädsel genom serien" },
  "sittande/front": { roll: "Godkänd sittfront", anvandning: "samma stol, sittpose, klädsel och händer på låren genom sittserien" },
  "hander/handryggar": { roll: "Granskade handryggar", anvandning: "händernas och naglarnas utseende i kortbilderna" },
} as const;

export type Bildrecept = {
  id: string;
  grupp: string;
  namn: string;
  vinkel: string;
  vinkelGrader?: number;
  riktning: string;
  kamera: string;
  utsnitt: string;
  pose: string;
  ljus: string;
  bakgrund: string;
  format: string;
  kontroll: string;
  basvy?: keyof typeof basvyer;
  extra?: boolean;
};

export type Bildreferens = { namn: string; roll: string };

const front = {
  vinkelGrader: 0,
  vinkel: "0° framifrån",
  riktning: "Placera kameran rakt framför personen. Bröstben, näsa och blick är riktade mot kameran.",
};

const trekvart = {
  vinkelGrader: 45,
  vinkel: "cirka 45° från fronten",
  riktning: "Flytta kameran mot personens anatomiska vänster. Behåll huvud, bål och blick i frontposens riktning. Näsan pekar åt bildvänster.",
};

const profil = {
  vinkelGrader: 90,
  vinkel: "cirka 90° från fronten",
  riktning: "Placera kameran på personens anatomiska vänstra sida. Håll kvar huvud, bål och blick i frontposens riktning så att näsan pekar åt bildvänster i ren profil.",
};

const personbild = {
  ljus: "Använd en stor diffus ljuskälla snett framför personen och mjuk upplättning från motsatt sida. Behåll lampornas lägen, exponeringen och den neutrala vitbalansen genom serien.",
  bakgrund: "Använd en enfärgad, matt ljusgrå studiobakgrund.",
  format: "stående PNG i 3:4, exempelvis 1080 × 1440 px",
};

const staende = {
  ...personbild,
  grupp: "Stående",
  kamera: "Håll kameran i våg på personens midjehöjd. Behåll samma brännvidd och avstånd till personen i de tre stående vyerna.",
  utsnitt: "Visa hela personen från hjässan till fötternas kontakt med golvet. Lämna en liten marginal ovanför huvudet, under fötterna och vid händerna.",
  pose: "Stå upprätt med vikten jämnt fördelad på båda fötterna. Låt armarna hänga en liten bit från sidorna och händerna vila öppna. Behåll samma fotplacering och hållning i de tre vyerna.",
};

const sittande = {
  ...personbild,
  grupp: "Sittande",
  kamera: "Håll kameran i våg i den sittande personens brösthöjd. Behåll samma brännvidd och avstånd till stolens mitt i de tre vyerna.",
  utsnitt: "Visa personen från hjässa till fötter, hela stolen och fötternas kontakt med golvet. Lämna en smal marginal runt motivet.",
  pose: "Sitt mitt på sitsen med bålen upprätt och axlarna avspända. Vila händerna på var sitt lår. Låt knäna peka framåt och båda fötterna vila plant på golvet. Behåll samma sittpose i alla tre vyer.",
  bakgrund: "Placera en enkel stol utan armstöd framför den matta ljusgrå bakgrunden. Använd samma stol genom serien. Håll utrymmet framför personen fritt från bord och bordsskiva.",
};

const ansikte = {
  ...personbild,
  grupp: "Ansikte",
  kamera: "Håll kameran i ögonhöjd med vågrät optisk axel. Behåll samma brännvidd och avstånd till huvudet i de tre porträtten.",
  utsnitt: "Ta med hela huvudet och hårets kontur ned till axlarnas överkant. Håll huvudet lika stort i de tre porträtten och lämna lite luft ovanför hjässan.",
  pose: "Håll huvudet upprätt med hakan i neutralt läge och munnen i vila. Låt ögonen följa näsans riktning när kameran flyttas.",
};

const handljus = "Använd mjukt, neutralt sidoljus. Lägg skärpan över både fingertoppar och kortkant och låt skuggorna vara svaga men urskiljbara.";
const handyta = "Använd en matt vit, omönstrad yta med vit bakgrund.";

export const bildrecept: Bildrecept[] = [
  {
    ...staende,
    ...front,
    id: "staende/front",
    namn: "Stående framifrån",
    kontroll: "Båda axlarna, händerna och fötterna ska gå att jämföra sida vid sida. Kontrollera att hela silhuetten ryms i bilden.",
  },
  {
    ...staende,
    ...trekvart,
    id: "staende/trekvart",
    basvy: "staende/front",
    namn: "Stående i trekvart",
    kontroll: "Visa djupskillnaden mellan axlarna och hur den närmaste armen löper längs bålen. Båda fötterna ska rymmas i bilden.",
  },
  {
    ...staende,
    ...profil,
    id: "staende/profil",
    basvy: "staende/front",
    namn: "Stående i profil",
    kontroll: "Gör näsans och hakans kontur samt huvudets läge över bäckenet tydliga. Den bortre armen och det bortre benet får överlappa de närmaste naturligt.",
  },
  {
    ...sittande,
    ...front,
    id: "sittande/front",
    basvy: "staende/front",
    namn: "Sittande framifrån",
    kontroll: "Bäckenet ska vara centrerat på sitsen. Visa båda händerna på låren, båda knäna och båda fötterna.",
  },
  {
    ...sittande,
    ...trekvart,
    id: "sittande/trekvart",
    basvy: "sittande/front",
    namn: "Sittande i trekvart",
    kontroll: "Visa sitsens framkant och sidokant. Den närmaste armen ska gå att följa från axeln till handen på låret.",
  },
  {
    ...sittande,
    ...profil,
    id: "sittande/profil",
    basvy: "sittande/front",
    namn: "Sittande i profil",
    kontroll: "Visa ryggens kontur, höften mot sitsen och den närmaste sidans knävinkel och fotled. Det bortre benet får överlappa det närmaste.",
  },
  {
    ...ansikte,
    ...front,
    id: "ansikte/front",
    namn: "Ansikte framifrån",
    kontroll: "Håll båda ögonen skarpa. Näsa, mun och haka ska synas rakt framifrån med personens naturliga asymmetrier.",
  },
  {
    ...ansikte,
    ...trekvart,
    id: "ansikte/trekvart",
    namn: "Ansikte i trekvart",
    kontroll: "Visa den närmaste kindens form och det bortre ögat. Håll ögon, näsa och mun inom skärpedjupet.",
  },
  {
    ...ansikte,
    ...profil,
    id: "ansikte/profil",
    namn: "Ansikte i profil",
    kontroll: "Pannans, näsans, läpparnas och hakans konturer ska gå att följa mot bakgrunden. Lämna lite luft framför näsan.",
  },
  {
    id: "hander/handryggar",
    grupp: "Händer",
    namn: "Båda handryggarna",
    vinkel: "90° mot den vita ytan, lodrätt ovanifrån",
    riktning: "Placera personens vänsterhand till bildvänster och högerhand till bildhöger. Låt fingertopparna peka mot bildens överkant.",
    kamera: "Sätt kameran rakt över händerna med bildplanet parallellt med underlaget. Fokusera på handryggarna och håll alla fingertoppar i skärpa.",
    utsnitt: "Visa båda handlederna, båda handryggarna, samtliga tio fingertoppar och hela spelkortet med en liten marginal.",
    pose: "Lägg handflatorna mot ytan och låt fingrarna vila lätt isär. Lägg ett enda spelkort plant bredvid händerna som skalreferens, med baksidan uppåt.",
    ljus: handljus,
    bakgrund: handyta,
    format: "liggande PNG i 3:2, exempelvis 1536 × 1024 px",
    kontroll: "Handryggar, naglar och fingertoppar ska synas tydligt. Lämna en glipa mellan händerna och kortet så att kortets fyra hörn är synliga.",
  },
  {
    id: "hander/kortdrag-vanster",
    basvy: "hander/handryggar",
    grupp: "Händer",
    namn: "Vänsterhandens kortdrag",
    vinkel: "cirka 20° över den vita ytan",
    riktning: "Fotografera personens anatomiska vänsterhand från tumsidan med kameran riktad mot pek- och långfingrets kontakt med kortet.",
    kamera: "Placera objektivet lågt och sikta snett ned mot kontaktstället. Mät kamerans höjdvinkel från det vågräta underlaget.",
    utsnitt: "Visa handleden, hela vänsterhanden och hela kortet. Ge fingertopparna och den närmaste kortkanten plats i bild.",
    pose: "Frys ett kortdrag längs underlaget. Låt fingerblommorna på vänsterhandens pek- och långfinger vila mot kortets baksida. Kortet ligger plant. Håll tummen, ringfingret och lillfingret avspända och fria.",
    ljus: handljus,
    bakgrund: handyta,
    format: "liggande PNG i 16:9, exempelvis 1920 × 1080 px",
    kontroll: "Visa var pek- och långfingrets konturer möter kortet. Kortkanten ska gå att följa längs den vita ytan.",
  },
  {
    id: "rorelsereferens/kortvandning-hoger",
    basvy: "hander/handryggar",
    grupp: "Rörelsereferens",
    namn: "Högerhandens kortvändning i luften",
    vinkel: "snett ovanifrån, i höjd med greppet eller något högre",
    riktning: "Fotografera personens anatomiska högerhand från tumsidan. Handleden kommer in från bildhöger och fingrarna riktas åt bildvänster.",
    kamera: "Rikta objektivet mot nypet vid korthörnet. Välj en position där både kortets yta och tunna kant syns.",
    utsnitt: "Visa handleden, fingrarna och hela kortet. Lämna synlig luft mellan kortets lägsta hörn och ytan.",
    pose: "Frys vändningen när kortets plan lutar cirka 55° mot den vita ytan. Låt höger tumme trycka mot baksidan vid ett hörn och pekfingret böjas runt kanten och trycka mot framsidan vid samma hörn. Visa baksidan snett mot kameran och låt övriga fingrar vara avspända.",
    ljus: "Använd mjukt, neutralt sidoljus och skarp teckning av fingrar och kortkant. Låt kortets svaga skugga falla en bit från kortet på den vita ytan.",
    bakgrund: handyta,
    format: "liggande PNG i 3:2, exempelvis 1536 × 1024 px",
    kontroll: "Kortkanten ska gå att följa fram till nypet. Visa tumme och pekfinger på motsatta sidor av samma hörn och luft under kortet.",
    extra: true,
  },
];

const referensroller = new Map<string, string>([
  ["Identitet", "ansiktsdrag, hår, hudton och personliga detaljer som syns i huvudfotot"],
  ["Kompletterande original", "drag och detaljer som syns tydligare från just den vinkeln"],
  ["Kläder och kropp", "personens kroppsproportioner, klädsel, passform och synliga material"],
  ["Pose och händer", "kroppsställning, handledsvinkel och fingrarnas läge. En neutral docka i denna roll styr pose och kameravy"],
  ["Kortets mönster", "kortets färger, tryck och markeringarnas inbördes lägen i de vyer där kortet syns"],
  ...Object.values(basvyer).map(({ roll, anvandning }): [string, string] => [roll, anvandning]),
]);

export const valbaraRoller = Array.from(referensroller.keys());
const basroller = new Set<string>(Object.values(basvyer).map((bas) => bas.roll));

export function skapaBildprompt(recept: Bildrecept, referenser: Bildreferens[], kortstandard: Kortstandard = referenskort): string {
  const bas = recept.basvy && basvyer[recept.basvy];
  const medKort = recept.grupp === "Händer" || recept.grupp === "Rörelsereferens";
  const bilder = referenser
    .map(({ namn, roll }) => ({ namn: namn.trim(), roll: roll.trim() }))
    .filter(({ namn, roll }) => namn.length > 0 && (medKort || roll !== "Kortets mönster"))
    .filter(({ roll }) => !basroller.has(roll) || roll === bas?.roll);
  const kallor = bilder.map(({ namn, roll }) => {
    const anvandning = referensroller.get(roll);
    if (anvandning) return `Använd ”${namn}” (${roll}) för ${anvandning}.`;
    return roll ? `Använd ”${namn}” i rollen ”${roll}”.` : `Jämför motivet med ”${namn}”.`;
  });
  if (kallor.length === 0) {
    kallor.push("Utgå från den bifogade identitetsbilden för personens utseende, proportioner och klädsel i den mån de syns.");
  } else if (!bilder.some(({ roll }) => roll === "Identitet")) {
    kallor.push("Använd ett separat bifogat foto av personen som identitetsreferens.");
  }
  if (bas && !bilder.some(({ roll }) => roll === bas.roll)) {
    kallor.push(`När bilden ”${bas.roll}” är bifogad, använd den för ${bas.anvandning}.`);
  }
  kallor.push("Låt personens egna originalfoton styra ansiktsdrag och synliga kännetecken vid varje ny vy. Följ den här vyns kamerariktning och pose.");

  let kort = "";
  if (medKort) {
    kort = bilder.some(({ roll }) => roll === "Kortets mönster")
      ? "Återge kortreferensens tryck. Använd samma kort i alla kortbilder för personen och låt markeringarna följa kortet när det vrids."
      : kortinstruktion(kortstandard);
  }

  return [
    `Skapa en fotorealistisk stillbild för personens referensserie i vyn ”${recept.namn}”.`,
    kallor.join("\n"),
    `Kameravinkeln är ${recept.vinkel}. ${recept.riktning} ${recept.kamera}`,
    `${recept.pose} ${recept.utsnitt}`,
    `${recept.bakgrund} ${recept.ljus}`,
    kort,
    recept.kontroll,
    `Målformatet är ${recept.format}.`,
  ].filter(Boolean).join("\n\n");
}
