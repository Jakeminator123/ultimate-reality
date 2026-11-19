import layout from "./table-layout.json" with { type: "json" };

export const FPS = 24;
export const LAST_FRAME = 119;
export const GRASP = 24;
export const CONTACT = 71;
export const RELEASE = 77;
export const SETTLED = 84;

export type Blocking = {
  frame: number;
  gapMm: number;
  edgeMm: number;
  tiltDeg: number;
  landingXcm: number;
  landingZcm: number;
};

export const defaultBlocking: Blocking = {
  frame: 54,
  gapMm: 0,
  edgeMm: -6,
  tiltDeg: 32,
  landingXcm: layout.landing.xCm,
  landingZcm: layout.landing.zCm,
};
export const limits = {
  frame: [0, LAST_FRAME],
  gapMm: [0, 18],
  edgeMm: [-20, 20],
  tiltDeg: [20, 60],
  landingXcm: [-19, 19],
  landingZcm: [-3, 22],
} satisfies Record<keyof Blocking, [number, number]>;

export function validBlocking(value: Blocking) {
  return (
    value &&
    (Object.keys(limits) as (keyof Blocking)[]).every((key) => {
      const [min, max] = limits[key];
      return (
        Number.isInteger(value[key]) && value[key] >= min && value[key] <= max
      );
    })
  );
}
export function phase(frame: number) {
  if (frame < GRASP) return "Fram till skon";
  if (frame < CONTACT) return "Grepp och förflyttning";
  if (frame < RELEASE) return "Kortkant mot filt";
  if (frame < SETTLED) return "Fingrarna släpper";
  return "Kortet ligger kvar";
}
