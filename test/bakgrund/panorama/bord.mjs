import * as T from "three";
import { buildTable, textiles } from "/bordsprov/rum3d/test/bord/filtdjup-v1/bord.mjs";
import { buildDrawShoe } from "/bordsprov/rum3d/sko.mjs";
import { applyTableMaterials } from "/bordsprov/rum3d/material.mjs";

async function loadSceneData(file) {
  const response = await fetch("/bordsprov/rum3d/" + file);
  if (!response.ok) throw Error("Kunde inte läsa " + file);
  return response.json();
}

export async function placeTable(scene, renderer, seatId, view) {
  const study = view === "paulina" ? await import("./placering.mjs") : null;
  const [layout, calibration, take] = await Promise.all([
    loadSceneData("layout.json"), loadSceneData("kameror.json"),
    study ? study.loadCardPath() : loadSceneData("bana.json"),
  ]);
  // Sample the oriented photo before adding furniture so its reflections match the visible room.
  const cube = new T.WebGLCubeRenderTarget(256, { type: T.HalfFloatType });
  const filter = new T.PMREMGenerator(renderer);
  try {
    new T.CubeCamera(.1, 20, cube).update(renderer, scene);
    scene.environment = filter.fromCubemap(cube.texture).texture;
  } finally {
    cube.dispose();
    filter.dispose();
  }
  const table = buildTable(layout, false, textiles(layout));
  await applyTableMaterials(table, layout, "/bordsprov/rum3d/");
  const { shoe, draw, card } = buildDrawShoe(take.shoe);
  let playback;
  if (view === "giv") {
    card.visible = false; // KORT-02 and its bending track are embedded in this take.
    const { loadDeal } = await import("./giv.mjs");
    playback = await loadDeal(scene, document.querySelector("#givkontroll"));
  } else if (view === "sequence") {
    card.visible = false; // Each deal supplies its own registered, animated playing card.
  } else if (study) {
    await study.placePaulina(scene, take, draw);
  } else {
    draw(take.frames[0].card_curve_zy_m);
  }
  scene.add(table, shoe);
  return { table, layout, playback, seat: calibration.cameras[seatId], cameras: calibration.cameras };
}
