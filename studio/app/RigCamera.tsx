export type CameraValues = { azimuth: number; elevation: number; distance: number; zoom: number };
export const frontCamera: CameraValues = { azimuth: 0, elevation: 0, distance: 3, zoom: 1 };
const directions = ["Framifrån", "Vänster trekvart", "Vänster profil", "Snett bakifrån till vänster", "Bakifrån",
  "Snett bakifrån till höger", "Höger profil", "Höger trekvart"];
const settings = [
  { key: "azimuth", name: "Vridning", min: -180, max: 180, step: 1, unit: "°" },
  { key: "elevation", name: "Höjdvinkel", min: -70, max: 77, step: 1, unit: "°" },
  { key: "distance", name: "Avstånd till riktpunkt", min: .5, max: 6, step: .01, unit: " m" },
  { key: "zoom", name: "Zoom", min: .55, max: 7, step: .05, unit: "×" },
] as const;

export default function RigCamera({ values, ready, adjust }: {
  values: CameraValues; ready: boolean; adjust: (values: Partial<CameraValues>) => void;
}) {
  const direction = directions[(Math.round(values.azimuth / 45) + 8) % 8];
  return <details className="rig-camera">
    <summary><strong>Kameravärden</strong><span>{direction} · {values.azimuth}° · {values.distance.toLocaleString("sv-SE")} m</span></summary>
    <div className="rig-camera-controls">
      {settings.map(s => <label key={s.key}>
        <span>{s.name}</span><output>{values[s.key].toLocaleString("sv-SE", { maximumFractionDigits: 2 })}{s.unit}</output>
        <input aria-label={s.name} type="range" min={s.min} max={s.max} step={s.step} value={values[s.key]} disabled={!ready}
          onChange={event => adjust({ [s.key]: Number(event.target.value) })}/>
      </label>)}
    </div>
    <p>Vridningen utgår från Paulinas front. Avståndet mäts i modellen från kameran till riktpunkten. Zoom ändrar den ortografiska kamerans utsnitt.</p>
  </details>;
}
