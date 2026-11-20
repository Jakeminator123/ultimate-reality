import * as T from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

// Centres and diffuser dimensions in metres from RUM-03's emissive mesh components.
// Output and spread are visual test settings. The GLB contains no photometric data.
export function buildFixtures() {
  RectAreaLightUniformsLib.init();
  const fixtures = new T.Group();
  const warmOpal = 0xffe1be, ceilingWhite = 0xffefdd;

  for (const x of [-2.22, 2.22]) {
    const globe = new T.PointLight(warmOpal, 2.0, 12, 2);
    globe.position.set(x, .59, -3.42);
    fixtures.add(globe);
  }
  for (const x of [-3.28, 3.28]) {
    for (const z of [-1.62, 1.38]) {
      // Flat equivalent of the room-facing portion of each cylindrical wall diffuser.
      const light = new T.RectAreaLight(warmOpal, 40, .122, .45);
      light.position.set(x, .85, z);
      light.lookAt(0, .85, z);
      fixtures.add(light);
    }
  }
  for (const x of [-2.62, 2.62]) {
    for (const z of [-.92, 1.17]) {
      const spot = new T.SpotLight(ceilingWhite, 6.8, 12, T.MathUtils.degToRad(66), .48, 2);
      spot.position.set(x, 2.443, z); // Just below the 14 mm luminous disc.
      spot.target.position.set(x, -.75, z);
      spot.castShadow = true;
      spot.shadow.mapSize.set(1024, 1024);
      spot.shadow.camera.near = .10;
      spot.shadow.bias = -.00012;
      spot.shadow.normalBias = .001;
      spot.shadow.radius = 3.0;
      fixtures.add(spot, spot.target);
    }
  }
  for (const [x, y, z, width, depth] of [
    [0, 2.39, -2.762, 6.55, .026], [0, 2.39, 3.032, 6.55, .026],
    [-3.102, 2.402, .14, .032, 6.38], [3.102, 2.402, .14, .032, 6.38],
  ]) {
    const strip = new T.RectAreaLight(warmOpal, 13, width, depth);
    strip.position.set(x, y, z);
    strip.rotation.x = -Math.PI / 2;
    fixtures.add(strip);
  }
  return fixtures;
}
