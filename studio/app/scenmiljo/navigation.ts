export const sceneViews = [
  { id: "bakgrund", name: "Bakgrund och ljus" },
  { id: "bord", name: "Bord och kortsko" },
  { id: "kort", name: "Kort och markeringar" },
  { id: "scenprov", name: "Scenprov" },
] as const;

export type SceneView = (typeof sceneViews)[number]["id"];

export const panoramaCatalog = {
  id: "fotopanorama",
  name: "Fotopanorama (360°)",
  href: "/scenmiljo/bakgrund/fotopanorama",
} as const;
