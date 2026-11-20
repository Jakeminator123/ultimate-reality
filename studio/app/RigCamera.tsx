import type { Photo } from "../lib/material-types";
import { angleDifference, seatedStandard } from "../lib/seated-review";

export type CameraValues = {
  azimuth: number; elevation: number; distance: number; zoom: number;
  cameraHeight: number; targetHeight: number; leftEye: number | null; rightEye: number | null;
};
export type CameraAdjustment = Partial<Pick<CameraValues, "azimuth" | "elevation" | "distance" | "zoom" | "targetHeight">>;
export const frontCamera: CameraValues = {
  azimuth: 0, elevation: 0, distance: 3, zoom: 1, cameraHeight: 0, targetHeight: 0, leftEye: null, rightEye: null,
};
const directions = ["Framifrån", "Vänster trekvart", "Vänster profil", "Snett bakifrån till vänster", "Bakifrån",
  "Snett bakifrån till höger", "Höger profil", "Höger trekvart"];
const settings = [
  { key: "azimuth", name: "Vridning", min: -180, max: 180, step: 1, unit: "°" },
  { key: "elevation", name: "Höjdvinkel", min: -70, max: 77, step: 1, unit: "°" },
  { key: "distance", name: "Avstånd till riktpunkt", min: .5, max: 6, step: .01, unit: " m" },
  { key: "zoom", name: "Zoom", min: .55, max: 7, step: .05, unit: "×" },
  { key: "targetHeight", name: "Riktpunktens höjd över 3D-golvet", min: 0, max: 2.4, step: .01, unit: " m" },
] as const;

const fmt = (n: number, digits = 1) => n.toLocaleString("sv-SE", { maximumFractionDigits: digits });

export function eyeRows(values: CameraValues, photo?: Photo) {
  const marks = photo?.seated?.marks;
  if (!photo || !marks || values.leftEye === null || values.rightEye === null) return null;
  const landmark = marks.eye.landmark;
  const model = landmark === "left" ? values.leftEye : landmark === "right" ? values.rightEye : (values.leftEye + values.rightEye) / 2;
  return { model, photo: (marks.eye.y + .5) * 100 / photo.height, uncertainty: marks.uncertaintyPx * 100 / photo.height };
}

export default function RigCamera({ values, ready, adjust, reference, guides, onGuides }: {
  values: CameraValues; ready: boolean; adjust: (values: CameraAdjustment) => void;
  reference?: Photo; guides: boolean; onGuides: (show: boolean) => void;
}) {
  const direction = directions[(Math.round(values.azimuth / 45) + 8) % 8];
  const target = reference?.targetAngle;
  const yawMatches = target !== undefined && angleDifference(values.azimuth, target) <= seatedStandard.cameraDegrees;
  const freeView = ready && target !== undefined && (!yawMatches || Math.abs(values.elevation) > seatedStandard.cameraDegrees);
  const eye = ready && yawMatches ? eyeRows(values, reference) : null;
  const difference = eye ? Math.abs(eye.model - eye.photo) : 0;
  const eyeReview = eye && difference - eye.uncertainty > seatedStandard.eyeRowPercent;
  const eyeBorderline = eye && !eyeReview && difference + eye.uncertainty > seatedStandard.eyeRowPercent;
  return <details className="rig-camera">
    <summary><strong>Kameravärden i 3D</strong>{ready ? <span>{direction} · sidled {fmt(values.azimuth)}° · höjdvinkel {fmt(values.elevation)}° · {fmt(values.distance, 2)} m</span> : <span>Läser vyn…</span>}
      {freeView && <span className="rig-warning">Utanför sittreceptets vinkel</span>}</summary>
    <div className="rig-camera-controls">
      {settings.map(s => <label key={s.key}>
        <span>{s.name}</span><output>{values[s.key].toLocaleString("sv-SE", { maximumFractionDigits: 2 })}{s.unit}</output>
        <input aria-label={s.name} type="range" min={s.min} max={s.max} step={s.step} value={values[s.key]} disabled={!ready}
          onChange={event => adjust({ [s.key]: Number(event.target.value) })}/>
      </label>)}
    </div>
    {ready && <p><strong>Höjd över 3D-golvet</strong> · kamera {fmt(values.cameraHeight, 2)} m · riktpunkt {fmt(values.targetHeight, 2)} m.</p>}
    <p>Helkroppsvyn siktar på modellens geometriska mitt. Reglaget för riktpunktens höjd flyttar kamera och riktpunkt lika långt. Positiv höjdvinkel betyder att kameran blickar nedåt. Zoom ändrar den ortografiska kamerans utsnitt.</p>
    {target !== undefined && <p>Sittfotots recept är {target}° i sidled och 0° i höjdled. Studion markerar en fri 3D-vy när någon vinkel avviker mer än {seatedStandard.cameraDegrees}°. Fotokamerans faktiska höjdvinkel är okänd.</p>}
    <label className="rig-guides-toggle"><input type="checkbox" disabled={!ready} checked={guides} onChange={e => onGuides(e.target.checked)}/> Visa riktpunkt och tillgängliga ögonlinjer</label>
    {eye && <p className="rig-eye-comparison"><strong>Ögonlinje från bildens överkant</strong> · foto {fmt(eye.photo)} % · rigg {fmt(eye.model)} %.
      {" "}Den lila streckade linjen följer fotots pupill. Den gröna visar riggens ögonled. Pose och zoom påverkar skillnaden.
      {!freeView && <strong className={eyeReview || eyeBorderline ? "rig-warning" : ""}> {eyeReview ? "Granska inramningen." :
        eyeBorderline ? "Inramningen ligger vid gränsen." : "Inramningen är inom gränsen."} Gräns {seatedStandard.eyeRowPercent} procentenheter.</strong>}</p>}
  </details>;
}
