import { PMREMGenerator } from "three";
import { HDRLoader } from "./HDRLoader.js";

export async function loadBrownEnvironment(renderer) {
  const photo = await new HDRLoader().loadAsync(new URL("studio.hdr", import.meta.url).href);
  const filter = new PMREMGenerator(renderer);
  try {
    return filter.fromEquirectangular(photo);
  } finally {
    photo.dispose();
    filter.dispose();
  }
}
