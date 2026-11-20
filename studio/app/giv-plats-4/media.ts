import { serveTrialResource, type TrialResource } from "../../lib/local-trial-media";

export type DealVersion = "v1" | "v2" | "v3" | "v4";
const media = new Map<string, TrialResource>([
  ["front.mp4", ["visning/front.mp4", "video/mp4"]],
  ["sida70.mp4", ["visning/sida70.mp4", "video/mp4"]],
  ["jamforelse.mp4", ["visning/jamforelse.mp4", "video/mp4"]],
  ["oversikt.jpg", ["visning/oversikt.jpg", "image/jpeg"]],
  ["rendering.json", ["visning/rendering.json", "application/json"]],
  ["giv.glb", ["rigg/giv.glb", "model/gltf-binary"]],
  ["hander-ruta-92.jpg", ["granskning/hander-ruta-92.jpg", "image/jpeg"]],
  ["ansikte-original.jpg", ["granskning/ansikte-original.jpg", "image/jpeg"]],
  ["blickprov.jpg", ["granskning/blickprov.jpg", "image/jpeg"]],
  ["tre-poser.jpg", ["granskning/tre-poser-fore-och-efter.jpg", "image/jpeg"]],
]);

export const texturesV3 = [
  ["hud-och-klader.png", "Hud, ansikte och kläder"],
  ["har.png", "Hår"],
  ["har-insida.png", "Hårets insida"],
  ["hud-och-nagelglans.png", "Hudens och naglarnas glans"],
  ["stovlar.jpg", "Stövlar"],
  ["aldre-kortrygg.jpg", "Äldre kortrygg (oanvänd i given)"],
] as const;

const materialV3 = new Map<string, TrialResource>([
  ["minspel.glb", ["granskning/minspel/minspel.glb", "model/gltf-binary"]],
  ["minspel.mp4", ["granskning/minspel/minspel.mp4", "video/mp4"]],
  ...texturesV3.map(([file]): [string, TrialResource] => [file,
    ["underlag/texturer/" + file, file.endsWith(".png") ? "image/png" : "image/jpeg"]]),
]);
const editionMaterial: Partial<Record<DealVersion, Map<string, TrialResource>>> = {
  v3: materialV3,
  v4: new Map([["tummar.jpg", ["granskning/tumme/tummar-original-v3-v4.jpg", "image/jpeg"]]]),
};

export function mediaFor(version: DealVersion) {
  return async (request: Request, context: { params: Promise<{ fil: string }> }) => {
    const { fil } = await context.params;
    const resource = media.get(fil) ?? editionMaterial[version]?.get(fil);
    return serveTrialResource(request, resource && ["avatars/paulina/giv-plats-4/" + version + "/" + resource[0], resource[1]]);
  };
}
