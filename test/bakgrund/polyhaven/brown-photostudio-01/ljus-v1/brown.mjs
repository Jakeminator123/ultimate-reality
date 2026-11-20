import { loadBrownEnvironment } from "./miljokarta.mjs";

const canvas = document.querySelector("#stage");
const status = document.querySelector("#status");
const query = new URLSearchParams(location.search);
const header = document.querySelector("header");
const title = "Brown Photostudio · kasinorummet";
document.title = title;
header.querySelector("h1").textContent = title;
const background = document.querySelector("#background");
background.replaceChildren(background.querySelector('[value="mesh"]'));
background.closest("label").hidden = true;
const baseLight = document.querySelector("#lighting");
baseLight.replaceChildren(baseLight.querySelector('[value="studio"]'));
baseLight.closest("label").hidden = true;
document.querySelector("#glass").checked = true;
const label = document.createElement("label");
label.textContent = "Miljöljus ";
const picker = document.createElement("select");
picker.id = "env-light";
picker.add(new Option("Före · befintlig rumsreflex", "studio"));
picker.add(new Option("Brown Photostudio · 50 %", "mild"));
picker.add(new Option("Brown Photostudio · 100 %", "hdr"));
picker.disabled = true;
label.append(picker);
header.append(label);
const note = document.querySelector("body > p");
note.replaceChildren("Dra för att vrida kasinorummet. Rulla för att zooma. ");
for (const [file, text] of [["jamforelse.jpg", "Jämför båda stolarna"], ["detaljer.jpg", "Hand, glas och filt i närbild"], ["panorama.html", "Se fotostudion i 360°"]]) {
  const link = document.createElement("a");
  link.href = new URL(file, import.meta.url).href;
  link.textContent = text;
  if (note.querySelector("a")) note.append(" · ");
  note.append(link);
}

canvas.addEventListener("roomready", async ({ detail: { renderer, scene, glass } }) => {
  if (!query.has("stol")) document.querySelector('[data-camera="4"]').click();
  const sceneStatus = status.textContent;
  const original = scene.environment;
  const originalGlass = glass.material.envMap;
  const originalIntensity = scene.environmentIntensity;
  const originalGlassIntensity = glass.material.envMapIntensity;
  let filtered;
  function apply() {
    const usePhoto = picker.value !== "studio";
    const strength = picker.value === "mild" ? .5 : 1;
    scene.environment = usePhoto ? filtered.texture : original;
    glass.material.envMap = usePhoto ? filtered.texture : originalGlass;
    scene.environmentIntensity = originalIntensity * strength;
    glass.material.envMapIntensity = originalGlassIntensity * strength;
    canvas.dataset.environment = picker.value;
  }
  picker.value = "studio";
  apply();
  status.textContent = "Läser fotostudions 4K-ljus…";
  try {
    filtered = await loadBrownEnvironment(renderer);
    picker.disabled = false;
    picker.value = ["studio", "mild", "hdr"].includes(query.get("miljo")) ? query.get("miljo") : "mild";
    picker.addEventListener("change", apply);
    apply();
    status.textContent = sceneStatus;
  } catch (error) {
    status.textContent = [sceneStatus, "Fotostudioljuset kunde inte öppnas. Befintligt ljus visas."].filter(Boolean).join(" ");
    console.error(error);
  }
}, { once: true });

await import("/bordsprov/rum3d/scen.mjs");
