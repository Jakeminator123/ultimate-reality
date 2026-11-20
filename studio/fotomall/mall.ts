export const shots = [
  {
    id: "staende-front",
    title: "Stående framifrån",
    angle: "0° · kameran i våg",
    base: true,
    setup:
      "Stå jämnt på båda fötterna med armarna en bit från sidorna. Hela huvudet, händerna och skorna ska få plats.",
    use: "Kroppsproportioner, klädernas silhuett och längd.",
  },
  {
    id: "sittande-front",
    title: "Sittande framifrån",
    angle: "0° · kameran i brösthöjd",
    base: true,
    setup:
      "Flytta undan bordet och sitt mitt på en enkel stol. Håll blicken framåt, vila händerna på låren och låt båda fötterna stå på golvet. Få med hela sittposen i bilden.",
    use: "Ansiktet och överkroppens läge över höften i en neutral sittpose.",
  },
  {
    id: "sittande-profil",
    title: "Sittande i profil",
    angle: "90° · kameran i brösthöjd",
    base: true,
    setup:
      "Behåll samma stol och sittpose som framifrån. Flytta kameran ett kvarts varv och håll den i våg. Visa hela stolen, höften, knäna och fötterna. I ren profil överlappar ofta benen.",
    use: "Ryggens lutning, höftdjup, knävinkel och fötternas läge.",
  },
  {
    id: "handryggar",
    title: "Båda handryggarna",
    angle: "Rakt ovanifrån",
    base: true,
    setup:
      "Lägg båda händerna med handflatorna nedåt och fingrarna lätt åtskilda. Lägg ett vanligt spelkort bredvid. Visa handleder, naglar och alla tio fingertoppar.",
    use: "Handens form, naglar och placeringen av synliga tatueringar.",
  },
  {
    id: "staende-trekvart",
    title: "Stående i trekvart",
    angle: "45° · kameran i våg",
    base: false,
    setup:
      "Behåll ståposen och flytta kameran halvvägs mot sidan. Hela kroppen och båda skorna ska synas.",
    use: "Hur ansikte, axlar och kostym ser ut när modellen vrids.",
  },
  {
    id: "staende-profil",
    title: "Stående i profil",
    angle: "90° · kameran i våg",
    base: false,
    setup:
      "Flytta kameran till sidan av samma ståpose. Håll huvud och bäcken neutrala och ta med hela kroppen.",
    use: "Huvudets läge över bäckenet och kroppens djup i stående pose.",
  },
  {
    id: "sittande-bord",
    title: "Sittande vid bordet",
    angle: "Extrabild · 45° snett framifrån",
    base: false,
    setup:
      "Ta fram bordet för den här arbetsposen. Fotografera snett framifrån så att händer, underarmar och bordskant syns tillsammans. Bordet får skymma en del av benen här.",
    use: "Visar hur händer och underarmar vilar mot arbetsytan.",
  },
  {
    id: "nacke",
    title: "Huvud och nacke",
    angle: "180° · bakifrån",
    base: false,
    setup:
      "Sitt som på frontbilden. Fotografera från nacken med bakhuvud, hals och axlar i bild.",
    use: "Hårlinje, frisyr och krage på den sida som frontbilderna döljer.",
  },
  {
    id: "kortgrepp",
    title: "Vänsterhandens kortgrepp",
    angle: "Lågt från tumsidan",
    base: false,
    setup:
      "Placera kameran på vänsterhandens tumsida, lite över filtplanet. Pek- och långfinger vilar lätt på kortet. Visa fingertopparna, kortkanten och de lediga fingrarnas böjning.",
    use: "Kortkanten, de två kontaktfingrarna och de fria fingrarnas böjning.",
  },
] as const;

export const referenceFiles = {
  "01": {
    name: "01_staende_bakgrund.png",
    label: "Stående original",
    role: "Kostym och proportioner",
  },
  "03": {
    name: "03_sittande_bakgrund.png",
    label: "Sittande original",
    role: "Ansikte, hår och handdetaljer",
  },
  "05b": {
    name: "05b_sittande_sidoprofil_ansiktsreferens03_genererad.png",
    label: "Genererad sittprofil",
    role: "Stol och benvinkel",
  },
  "08": {
    name: "08_sittande_trekvart_bordskontakt_genererad.png",
    label: "Genererad arbetsställning",
    role: "Underlag för den sittande riggen",
  },
  "09": {
    name: "09_vansterhand_kortdrag_genererad.png",
    label: "Genererat kortgrepp",
    role: "Vänsterhandens pose ovanifrån",
  },
} as const;

export const nextPhotos = [
  {
    id: "10",
    shot: "handryggar",
    title: "Båda handryggarna i vila",
    file: "10_handryggar_ovanifran_genererad.png",
    refs: ["03"],
    goal: "En sammanhängande bild av båda händerna. 03 ger originalets färger och synliga tatueringar.",
    prompt:
      "Gör en enda fotorealistisk närbild av Paulinas båda händer. Bifogad bild 03 är identitetsreferensen. Fotografera lodrätt ovanifrån. Båda handflatorna vilar mot matt mörkgrön filt, med handryggarna mot kameran och fingrarna avslappnade och lätt isär. Visa båda handlederna, de svarta kavajärmarna, samtliga tio fingertoppar och naglar. Lägg ett enda rödryggat standardspelkort bredvid händerna som skala. Behåll hudton, naglarnas form och de tatueringsmotiv som faktiskt syns i 03. Låt otydliga detaljer vara diskreta. Mjukt jämnt ljus och skärpa över båda händerna. Liggande bild, utan text, smycken eller collage.",
  },
  {
    id: "11",
    shot: "kortgrepp",
    title: "Vänsterhandens grepp från sidan",
    file: "11_vansterhand_kortgrepp_snett_genererad.png",
    refs: ["03", "09"],
    goal: "Se hur de lediga fingrarna böjs. 03 styr utseendet och 09 visar vilka fingrar som ligger på kortet.",
    prompt:
      "Gör en enda fotorealistisk närbild av Paulinas vänstra hand när hon drar ett rödryggat spelkort över mörkgrön filt. Bifogad bild 03 styr hudton, kavajärm, naglar och synliga tatueringar. Bild 09 visar samma vänsterhand och dess kontakt med kortet ovanifrån. Flytta kameran till tumsidan, cirka 20 grader över filtens plan, så att kortets kant och kontakten under pek- och långfingrets fingerblommor syns. Fingrarna ligger lätt mot kortets rygg. Låt tumme, ringfinger och lillfinger vila i en mjuk, naturlig böj. Visa handleden, alla fem fingrar och hela kortet i skarp fokus. Mjukt ljus från sidan, liggande bild. Behåll vänsterhandens riktiga orientering och de motiv som går att läsa i 03.",
  },
] as const;
