import { kortMedVitRam, referenskort } from "../../fotomall/kortstandard";
import type { SceneView } from "./navigation";

type Destination = { label: string; href: string };
export type Study = {
  title: string; version: string; description: string; links: Destination[];
};
type SceneMaterial = {
  featured: Study;
  preview: { src: string; alt: string; caption: string; contain?: boolean };
  related: Study[];
  archive: Study[];
};

const panorama = "/bordsprov/panorama/fotostudio";
const room = "/bordsprov/rum3d?rum=mesh";
const grip = "/bordsprov/handljus";
const seatLinks = (path: string, query = ""): Destination[] => [4, 1].map(seat => ({
  label: "Stol " + seat, href: path + (path.includes("?") ? "&" : "?") + "stol=" + seat + query,
}));

export const sceneMaterial: Record<SceneView, SceneMaterial> = {
  bakgrund: {
    featured: {
      title: "Brown Photostudio 01", version: "RUM-02 · panorama-v1",
      description: "Jakobs valda bakgrund är ett fotograferat 360°-panorama. Öppna fotostudion tom eller se bordet i samma rum från en av spelarstolarna.",
      links: [{ label: "Öppna tomt panorama", href: "/bordsprov/panorama" }, ...seatLinks(panorama)],
    },
    preview: { src: "/scenmiljo/bilder/fotostudio-v1.jpg", alt: "Den tomma fotostudion med soffa, fönster och trägolv", caption: "Brown Photostudio 01 · tomt rum" },
    related: [],
    archive: [
      { title: "Ljus vid blackjackbordet", version: "LJUS-03 till LJUS-05",
        description: "Tidigare ljusstudier jämför bland annat pendellampan, panoramats miljöljus och avskärmat ljus på vänsterhanden.",
        links: [{ label: "Öppna ljusstudierna", href: "/bordsprov/ljusstudier" }] },
      { title: "Atlas-rummet", version: "RUM-07 · parkerat",
        description: "Snabbversionen och den fulla 3D-versionen jämförs från samma två kameror.",
        links: [{ label: "Jämför Atlas-versionerna", href: "/bordsprov/rum3d/atlas-jamforelse.html" }] },
    ],
  },
  bord: {
    featured: {
      title: "Blackjackbordet i fotostudion", version: "BORD-02 · YTA-02 · SKO-03",
      description: "Bordets antagna yttermått är 192 × 129,6 cm. Grön mikromocka, brunt läder och valnötsfaner klär skivan, relingen och sargen.",
      links: seatLinks(panorama),
    },
    preview: { src: "/scenmiljo/bilder/bord-stol-4-v1.jpg", alt: "Blackjackbordet och kortskon från Stol 4 i Brown Photostudio", caption: "BORD-02 i Brown Photostudio · Stol 4" },
    related: [
      { title: "Skons riktning", version: "SKO-03 · skoriktning-70-30-v1",
        description: "Mynningen pekar 70 delar in mot bordets mitt och 30 delar fram mot Stol 4. De båda stolarna visar samma sko.",
        links: [{ label: "Se kortutdraget i skon", href: grip + "?stol=1&ruta=17" }] },
      { title: "Bordsfötter och kontaktskugga", version: "golv-v2 · BORD-02",
        description: "Växla skuggan vid mässingsfötterna och jämför golvkontakten från båda stolarna.",
        links: seatLinks(panorama, "&vy=golv") },
      { title: "Grass Ground på spelytan", version: "grass-ground-v1 · RUM-02 · pose 17",
        description: "Jämför gräsytan med den gröna filten i samma ljus. De tunna spelrutorna är svårare att urskilja mot torrt gräs och jord.",
        links: seatLinks(panorama, "&vy=paulina&matta=gras") },
    ],
    archive: [
      { title: "Materialdetalj i kasinorummet", version: "YTA-02 · RUM-03",
        description: "Jämför bordets skannade ytor med det tidigare bordsmaterialet.",
        links: [{ label: "Öppna materialdetaljen", href: "/bordsprov/paulina-utdrag.html?vy=material" }] },
    ],
  },
  kort: {
    featured: {
      title: "Korttryck för nya foton", version: referenskort.id,
      description: "På den mörkröda baksidan finns ett ljust X och en ljuslila punkt vid övre vänstra hörnet. Kortstandarden anger tryckets färger, punktens placering och bildmått.",
      links: [{ label: "Öppna kortstandarden", href: "/bildstandard#referenskort" }, { label: "Visa kortbaksidan som PNG", href: referenskort.fil }],
    },
    preview: { src: referenskort.fil, alt: "Mörkröd kortbaksida med ljust X och ljuslila hörnpunkt", caption: "referenskort-x-v1 · 63 × 89 mm", contain: true },
    related: [
      { title: "Paulinas korttryck i Fas 1", version: kortMedVitRam.id,
        description: "I Paulinas v1-serie har kortet mörkröd baksida, tunn vit ram och en vit punkt som följer samma hörn i vändningen.",
        links: [{ label: "Visa högerhandens kortvändning", href: "/fotomall.html/fas-1/v1/rorelsereferens/kortvandning-hoger.png" }] },
      { title: "Kortet i 3D-utdraget", version: "KORT-02 · skoriktning-70-30-v1",
        description: "Det böjliga 3D-kortet mäter 63 × 89 × 0,4 mm. Vänsterhanden drar det 108 mm längs skons riktning.",
        links: [{ label: "Se greppet på pose 17", href: grip + "?stol=1&ruta=17" }] },
      { title: "Spelrutor och kortets landningspunkt", version: "BORD-02 · YTA-02",
        description: "De sju spelrutorna syns på den gröna filten. I Grepp och landning kan du flytta kortets landningspunkt på filten för given till plats 4.",
        links: [...seatLinks(panorama), { label: "Öppna Grepp och landning", href: "/#scen" }] },
    ],
    archive: [],
  },
  scenprov: {
    featured: {
      title: "Paulina vid bordet · pose 17", version: "RUM-02 · paulina-placering-v1",
      description: "Båda stolarna visar Paulina v2 och det första KORT-02 på samma frysta tidpunkt, 16/24 s in i utdraget. Bordsskivan skymmer bäckenet. Helbilden visar handens läge, men millimeterkontakt behöver närbild.",
      links: seatLinks(panorama, "&vy=paulina"),
    },
    preview: { src: "/scenmiljo/bilder/paulina-placering-v1-stol-4.jpg", alt: "Paulina v2 vid bordet i fotostudion sett från Stol 4", caption: "Brown Photostudio · Stol 4 · första kortet · pose 17" },
    related: [
      { title: "Paulinas kortutdrag i kasinorummet", version: "LJUS-05 · RUM-03 · skoriktning-70-30-v1",
        description: "I det rörliga provet drar Paulina v2 kortet ur SKO-03. Stolsvyerna öppnar på pose 17. Den motsvarar filmruta 28, räknat från noll.",
        links: [...seatLinks(grip, "&ruta=17"), { label: "Spela filmen", href: grip + "/kortdrag-v2.mp4" }] },
    ],
    archive: [
      { title: "Glas och marker i 08-riggens bordsscen", version: "RUM-03 · GLAS-01 · MARKER-01",
        description: "Vrid det äldre rummet med glaset på bordet. Slå på markerna i visaren för att se de två staplarna.",
        links: seatLinks(room, "&glas=1") },
      { title: "08-riggens kortutdrag", version: "08-rak-v1 · skoriktning-70-30-v1",
        description: "Öppna den äldre tagningen med 08-riggen på samma 70/30-bana.",
        links: [{ label: "Visa 08-riggens utdrag", href: "/bordsprov/paulina-utdrag.html?riktning=70-30" }] },
    ],
  },
};
