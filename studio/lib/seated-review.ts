export const seatedStandard = {
  scalePercent: 2,
  centrePercent: 1,
  cameraDegrees: 1,
  eyeRowPercent: 2,
} as const;

type Point = { x: number; y: number };
export type FloorPoint = Point & { visible: "centre" | "edge" };
export type CameraMarks = {
  uncertaintyPx: number;
  eye: Point & { landmark: "midpoint" | "left" | "right" };
  feet: FloorPoint[];
};
export type SeatedMeasurement = {
  crownY: number; soleY: number; seatX: number; seatY: number; marks?: CameraMarks;
};
type ImageIdentity = { file: string; sha256: string; width: number; height: number };
type PhotoFrame = { width: number; height: number; seated: SeatedMeasurement };

function matchingView(record: unknown, edition: string, photo: ImageIdentity) {
  if (!record || typeof record !== "object" || !("release" in record) || record.release !== edition ||
    !("views" in record) || !Array.isArray(record.views)) return;
  const matches = record.views.filter(row => row?.file === photo.file && row.sourceSha256 === photo.sha256 &&
    row.width === photo.width && row.height === photo.height);
  if (matches.length === 1) return matches[0];
}

const inImage = (coordinate: number, dimension: number) =>
  Number.isInteger(coordinate) && coordinate >= 0 && coordinate < dimension;

export function readSeatedMeasurement(photo: ImageIdentity, edition: string, scales: unknown, points: unknown): SeatedMeasurement | undefined {
  const row = matchingView(scales, edition, photo);
  if (!row || !inImage(row.seatX, photo.width) ||
    ![row.crownY, row.seatY, row.soleY].every(y => inImage(y, photo.height)) ||
    !(row.crownY < row.seatY && row.seatY < row.soleY)) return;
  const result: SeatedMeasurement = { crownY: row.crownY, soleY: row.soleY, seatX: row.seatX, seatY: row.seatY };
  if (!points || typeof points !== "object" || !("schema" in points) || points.schema !== 1) return result;
  const marks = matchingView(points, edition, photo);
  const hasPoint = (p: Point | undefined) => p && inImage(p.x, photo.width) && inImage(p.y, photo.height);
  if (marks && Number.isFinite(marks.uncertaintyPx) && marks.uncertaintyPx > 0 &&
    hasPoint(marks.eye) && ["midpoint", "left", "right"].includes(marks.eye.landmark) &&
    Array.isArray(marks.feet) && marks.feet.length <= 4 &&
    marks.feet.every((p: FloorPoint) => hasPoint(p) && ["centre", "edge"].includes(p.visible))) {
    result.marks = { uncertaintyPx: marks.uncertaintyPx, eye: marks.eye, feet: marks.feet };
  }
  return result;
}

export const bodyPixels = (p: PhotoFrame) => p.seated.soleY - p.seated.crownY + 1;
const bodyFraction = (p: PhotoFrame) => bodyPixels(p) / p.height;
const verticalCentre = (p: PhotoFrame) => (p.seated.crownY + p.seated.soleY + 1) / (2 * p.height);

export function checkSeatedFrame(photo: PhotoFrame, front: PhotoFrame, tolerance: number = seatedStandard.scalePercent) {
  const scaleDelta = 100 * (bodyFraction(photo) / bodyFraction(front) - 1);
  const centreDelta = 100 * (verticalCentre(photo) - verticalCentre(front));
  const formatDiffers = photo.width !== front.width || photo.height !== front.height;
  const scaleDiffers = Math.abs(scaleDelta) > tolerance + 1e-9;
  const centreDiffers = Math.abs(centreDelta) > seatedStandard.centrePercent + 1e-9;
  return { scaleDelta, centreDelta, formatDiffers, scaleDiffers, centreDiffers, review: formatDiffers || scaleDiffers || centreDiffers };
}

export function floorSpread(marks?: CameraMarks, minimumCentres: 2 | 4 = 4) {
  if (!marks || marks.feet.length > 4) return null;
  const centres = marks.feet.filter(point => point.visible === "centre");
  if (centres.length < minimumCentres) return null;
  const columns = centres.map(point => point.x), rows = centres.map(point => point.y);
  const left = Math.min(...columns), right = Math.max(...columns);
  const top = Math.min(...rows), bottom = Math.max(...rows);
  return { left, right, top, bottom, widthPixels: right - left, pixels: bottom - top, centres: centres.length };
}

export function angleDifference(degrees: number, target: number) {
  return Math.abs(((degrees - target + 540) % 360) - 180);
}
