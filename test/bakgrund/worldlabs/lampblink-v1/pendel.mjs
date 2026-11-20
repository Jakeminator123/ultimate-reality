// Triangulated from the centre of the same bulb in the two calibrated views.
const centre = [2.147, .289, -3.302];

export function isDim(seconds) {
  const phase = seconds % 3;
  return phase >= 1.5 && phase < 2;
}

export function attachPendant(cloud, { SplatEdit, SplatEditSdf }) {
  // The edits use world coordinates. The original splat transform includes a floor offset.
  const regions = [
    { name: "Pendelns glödlampa", radii: [.23, .26, .30], edge: .09, dim: .17 },
    { name: "Ljus i pendelnischen", radii: [.66, .67, .52], edge: .22, dim: .70 },
  ].map(({ name, radii, edge, dim }) => {
    const edit = new SplatEdit({ name, softEdge: edge });
    const volume = new SplatEditSdf({ type: "ellipsoid" });
    volume.scale.fromArray(radii);
    volume.position.fromArray(centre);
    volume.position.y -= cloud.position.y;
    edit.add(volume);
    cloud.add(edit);
    return { volume, dim };
  });
  let previous;
  return dimmed => {
    if (dimmed === previous) return;
    for (const region of regions) region.volume.color.setScalar(dimmed ? region.dim : 1);
    previous = dimmed;
  };
}

export function enableRecording(canvas, button, link, onError) {
  if (!canvas.captureStream || !window.MediaRecorder) return;
  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/mp4"].find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) return;
  button.hidden = false;
  let active, previousUrl;
  button.addEventListener("click", () => {
    if (active?.state === "recording") {
      button.disabled = true;
      active.stop();
      return;
    }
    let stream;
    try {
      stream = canvas.captureStream(24);
      active = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
      const chunks = [];
      active.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      active.onerror = event => onError(event.error.message);
      active.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        button.disabled = false;
        button.textContent = "Spela in vyn";
        if (!chunks.length) return;
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        previousUrl = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
        link.href = previousUrl;
        link.download = "kasinorummet." + (mimeType.includes("mp4") ? "mp4" : "webm");
        link.hidden = false;
      };
      active.start(1000);
      button.textContent = "Avsluta inspelningen";
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      onError(error.message);
    }
  });
  return () => { if (active?.state === "recording") active.stop(); };
}
