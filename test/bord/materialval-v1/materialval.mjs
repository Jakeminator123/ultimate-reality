import * as T from "three";
import { tableSurfaces } from "/bordsprov/rum3d/material.mjs";
import { textiles } from "/bordsprov/rum3d/test/bord/filtdjup-v1/bord.mjs";
import { printGrassMarkings } from "./grasmatta.mjs";

async function loadFinish(option, layout, renderer) {
  const { scan, metres } = option.dataset;
  const loader = new T.TextureLoader();
  const transfers = await Promise.allSettled(["diff", "nor_gl", "rough"].map(kind =>
    loader.loadAsync(new URL(`${scan}_${kind}_2k.jpg`, import.meta.url).href)
  ));
  const failure = transfers.find(result => result.status === "rejected");
  if (failure) {
    for (const result of transfers) if (result.status === "fulfilled") result.value.dispose();
    throw failure.reason;
  }
  const [map, normalMap, roughnessMap] = transfers.map(result => result.value);
  for (const texture of [map, normalMap, roughnessMap]) {
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.setScalar(1 / Number(metres));
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (option.hasAttribute("data-quarter-turn")) {
      texture.center.set(.5, .5);
      texture.rotation = Math.PI / 2;
    }
  }
  map.colorSpace = T.SRGBColorSpace;
  const material = new T.MeshStandardMaterial({ map, normalMap, roughnessMap, roughness: 1, metalness: 0 });
  if (scan === "grass_ground") printGrassMarkings(material, textiles(layout, { onlyMarkings: true }));
  return material;
}

export async function bindTableFinishes(panel, table, layout, renderer, redraw) {
  const { felt, skirt, rail } = tableSurfaces(table);
  const parts = { matta: [felt], tra: [skirt], reling: [rail, ...rail.children.filter(child => child.isMesh)] };
  const cache = new Map();
  const states = Array.from(panel.querySelectorAll("select"), select => ({
    select, meshes: parts[select.name], originals: parts[select.name].map(mesh => mesh.material),
    current: select.options[0].value, revision: 0, error: "",
  }));

  function syncUrl(href) {
    const url = new URL(href, location.href);
    for (const { select, current } of states) {
      if (current === select.options[0].value) url.searchParams.delete(select.name);
      else url.searchParams.set(select.name, current);
    }
    return url;
  }

  async function apply(state) {
    const { select, meshes, originals } = state;
    const option = select.selectedOptions[0];
    const revision = ++state.revision;
    select.setAttribute("aria-busy", "true");
    state.error = "";
    try {
      const scan = option.dataset.scan;
      let material;
      if (scan) {
        if (!cache.has(scan)) cache.set(scan, loadFinish(option, layout, renderer).catch(error => {
          cache.delete(scan);
          throw error;
        }));
        material = await cache.get(scan);
      }
      if (revision !== state.revision) return;
      meshes.forEach((mesh, index) => { mesh.material = material ?? originals[index]; });
      state.current = option.value;
      if (!panel.disabled) redraw();
    } catch {
      if (revision !== state.revision) return;
      select.value = state.current;
      state.error = `Kunde inte läsa ${option.textContent}. Prova igen.`;
    } finally {
      if (revision === state.revision) {
        select.removeAttribute("aria-busy");
        panel.querySelector("output").textContent = states.map(s => s.error).filter(Boolean).join(" ");
      }
    }
  }

  function syncNavigation() {
    for (const link of document.querySelectorAll("nav a, footer a")) link.href = syncUrl(link.href).href;
    history.replaceState(history.state, "", syncUrl(location.href));
    renderer.domElement.dataset.mat = states.find(state => state.select.name === "matta").current;
  }
  await Promise.all(states.map(apply));
  syncNavigation();
  for (const state of states) {
    state.select.addEventListener("change", async () => {
      await apply(state);
      syncNavigation();
    });
  }
  panel.disabled = false;
}
