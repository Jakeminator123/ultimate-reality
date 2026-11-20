import { referenskort } from "./kortstandard";

type Vinkel = "front" | "trekvart" | "profil";
type Personvy = `${"staende" | "sittande" | "ansikte"}/${Vinkel}`;
type Handvy = "hander/handryggar" | "hander/kortdrag-vanster" | "rorelsereferens/kortvandning-hoger";
type Roll = "identitet" | "original" | "stafront" | "sittfront" | "handryggar" | "kort" | "samling";

const vinkel: Record<Vinkel, string> = {
  front: "Straight-on, centered view. Nose, chest and eyes face the lens.",
  trekvart: "The camera is 45 degrees around to the person's anatomical left. The head, chest and gaze stay aligned in their original forward direction. The nose points toward frame left; the far eye is visible.",
  profil: "The camera is 90 degrees around to the person's anatomical left. Head, chest and gaze keep their original forward direction. A true left profile, with the nose pointing toward frame left and one eye visible.",
};

const personljus = "Matte light-gray seamless studio background (target sRGB #ECE9F0). A broad diffuse key is in front and to the person's left, slightly above eye level. Gentle fill from their right. Keep the lighting fixed relative to the person as the camera moves. Neutral white balance, natural skin texture.";
const handljus = "Matte off-white tabletop and matching background (#F5F3F5), soft neutral side light and a faint shadow. Both the fingertips and the card edge are in sharp focus.";
const staende = "One full-length studio photograph of the person standing upright, weight balanced between both feet. Arms hang slightly away from the body, hands open and relaxed. Level camera at waist height, 50 mm full-frame-equivalent lens, starting about 3 metres away. Adjust distance to fit the whole person within about 88% of frame height. Include the crown, hands and shoes with margin above the head and below the soles. Natural limb overlap in profile.";
const sittande = "One full-length photograph of the person centered on a plain armless chair with a light-gray upholstered seat and four light wooden legs. Torso upright, shoulders relaxed, one hand resting on each thigh, knees forward and feet flat on the floor. Level camera at seated chest height, 50 mm full-frame-equivalent lens. Frame the entire chair, head and both feet with clear open space in front and visible floor below.";
const ansikte = "One eye-level studio portrait with an 85 mm full-frame-equivalent lens, framed from the top of the hair to the tops of the shoulders. Head upright, chin neutral, mouth relaxed. Preserve natural facial asymmetry and keep eyes, nose and lips in focus. Leave a little space around the hair.";

const poser: Record<Personvy | Handvy, string> = {
  "staende/front": `Create a new photograph of the person seen in the references. ${staende} ${vinkel.front} ${personljus}`,
  "staende/trekvart": `${staende} ${vinkel.trekvart} Match the standing front view's stance, camera distance and focal length. ${personljus}`,
  "staende/profil": `${staende} ${vinkel.profil} Match the standing front view's stance, camera distance and focal length. ${personljus}`,
  "sittande/front": `${sittande} ${vinkel.front} Both hands, knees and feet are visible. ${personljus}`,
  "sittande/trekvart": `${sittande} ${vinkel.trekvart} Match the seated front view's chair, pose, focal length and distance. Show the front and side edges of the seat. ${personljus}`,
  "sittande/profil": `${sittande} ${vinkel.profil} Match the seated front view's chair, pose, focal length and distance. Show the back contour, hip on the seat and near knee and ankle. ${personljus}`,
  "ansikte/front": `${ansikte} ${vinkel.front} Both eyes are clearly visible. ${personljus}`,
  "ansikte/trekvart": `${ansikte} ${vinkel.trekvart} Show the near cheek and far eye. ${personljus}`,
  "ansikte/profil": `${ansikte} ${vinkel.profil} Leave some room in front of the nose; show the contours of forehead, lips and chin. ${personljus}`,
  "hander/handryggar": `One overhead photograph of both hands, palms down, fingers slightly apart and pointing toward the upper edge. Left hand on frame left, right hand on frame right. Include both wrists and all ten fingertips. One face-down playing card lies flat beside the hands for scale, separated by a visible gap with all four corners in frame. ${handljus}`,
  "hander/kortdrag-vanster": `One close-up photograph of the person's anatomical left hand sliding one face-down playing card across the tabletop. The pads of the index and middle fingers touch the card back; thumb, ring and little finger rest free. Camera on the thumb side, looking down at 20 degrees above the surface. Frame the wrist, whole hand and entire flat card. ${handljus}`,
  "rorelsereferens/kortvandning-hoger": `One close-up photograph of a card turn frozen in midair. The anatomical right wrist enters from frame right; the fingers point left. The thumb presses the back near one corner and the bent index finger presses the face at that same corner. The remaining fingers relax. The card tilts 55 degrees above the tabletop, back angled toward the camera. Photograph the pinch from the thumb side, slightly above it; include the wrist, whole card, thin edge and visible air beneath the lowest corner. ${handljus}`,
};

const roller: Record<Roll, string> = {
  identitet: "original photograph of the intended person. Use whichever original most clearly shows each facial or body feature.",
  original: "another original photograph of the same person; use visible details to complete their likeness.",
  stafront: "primary full-body reference for the same person's proportions, hairstyle, clothing, fit and footwear.",
  sittfront: "primary reference for the same seated person, outfit, chair, body position, hands on thighs and feet on the floor.",
  handryggar: "reference for the person's hand anatomy, skin, fingertips and nails.",
  kort: "match the playing card's size, back design and corner mark, rotating the printed design with the card.",
  samling: "a collection of photos of one person; use the visible details across them to reconstruct that single person's likeness.",
};

function harNyckel<T extends object>(objekt: T, nyckel: string): nyckel is keyof T & string {
  return Object.prototype.hasOwnProperty.call(objekt, nyckel);
}

export function runwayBildprompt(vy: string, referenser: { tag: string; roll: string }[]): string {
  if (!harNyckel(poser, vy)) throw new Error(`Okänd bildvy: ${vy}`);
  if (referenser.length > 16) throw new Error("Runways GPT Image stöder högst 16 referensbilder.");

  // GPT Image receives the images in request order. API tags are local labels only.
  const kallor = referenser.map(({ roll }, index) => {
    if (!harNyckel(roller, roll)) throw new Error(`Okänd bildreferensroll: ${roll}`);
    return `Reference image ${index + 1}: ${roller[roll]}`;
  });
  const harKort = vy.startsWith("hander/") || vy.startsWith("rorelsereferens/");
  if (harKort) {
    const { breddMm, hojdMm, punktlage, rygg, x, punkt } = referenskort;
    kallor.push(`One ${breddMm} by ${hojdMm} mm playing card. Its print uses an edge-to-edge dark red back, sRGB (${rygg.join(", ")}), a centered pale X (${x.join(", ")}) and one pale lilac dot (${punkt.join(", ")}) ${punktlage.diameterMm} mm across, centered ${punktlage.franVansterMm} mm from the left and ${punktlage.franOvanMm} mm from the top of the upright back. That dot stays on the same physical corner as the card rotates.`);
  }
  if (vy === "staende/front") {
    kallor.push("The originals may be selfies, crops or side views in different settings. Identify the same person across them. Use the clearest original evidence for each visible feature regardless of image order. Match the best-documented outfit as one coherent outfit. Where body or clothing details fall outside the originals, complete them plausibly and consistently. Compose a new studio photograph of this one person in one uninterrupted frame.");
  }
  return [poser[vy], ...kallor].join("\n");
}
