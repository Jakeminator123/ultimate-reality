import recipe from "../recept/giv-plats-4.json";
import { MODEL, draftSettings, isDraftModel, type DraftModel } from "./model";

export type PromptPreset = {
  id: string;
  name: string;
  model: DraftModel;
  duration: number;
  instruction: string;
  prompt: string;
};

export const builtInPrompts: PromptPreset[] = [
  { id: "giv-plats-4", name: "Giv till plats 4 · labbets original", model: MODEL, duration: 5,
    instruction: "Den ursprungliga svenska startprompten. Välj en egen startbild och en slutbild med målet synligt.",
    prompt: recipe.promptDraft },
  { id: "tva-kort", name: "Två kort · plats 3 och 2", model: "kling_4", duration: 5,
    instruction: "Bearbetning av exportens femsekundersprov. Använd eget REDO-ankare och samma utsnitt i slutbilden, med två mål till vänster om mitten. Låt de två bilderna styra rörelsen.",
    prompt: "Locked camera. Starting in the pose in image 1, the dealer deals one card to each of the two positions in image 2. First she reaches just left of center, then farther left. Each time her left hand draws one card from the shoe, her right hand takes it, turns it face up and lays it flat. Her fingers release after contact. She returns to the starting pose between cards and at the end. Both cards stay where she placed them." },
  { id: "kontakt", name: "Ett kort · grepp och släpp", model: "kling_4", duration: 5,
    instruction: "Visa kortkanten skarpt i startbilden och landningen i slutbilden. Granska första rutan där fingrarna lämnar kortet.",
    prompt: "One continuous shot from a fixed camera. The dealer pinches one card by its short edge, carries it to the center mark and touches the far edge to the felt. Her fingers open, the card settles flat and her hand withdraws. The card stays on the mark." },
  { id: "blink", name: "Vila · en blinkning", model: "grok_imagine_1_5_lite", duration: 1,
    instruction: "En startbild av dealern i vila. Granska om ansiktet och kameran är stabila när ögonen öppnas igen.",
    prompt: "Fixed camera. The seated dealer blinks once and opens her eyes. Her hands rest on the table." },
  { id: "ingaang", name: "Ingång · vila till redo", model: "wan3", duration: 2,
    instruction: "Visa viloposen först och handen vid skon i slutbilden.",
    prompt: "The dealer lowers her gaze toward the shoe and moves her left hand to the top card. Her thumb and index finger settle on its edge. Hold this ready pose. The camera stays fixed." },
  { id: "retur", name: "Retur · handen till skon", model: "wan3", duration: 3,
    instruction: "Börja efter släppet. Det lagda kortet ska finnas på samma plats i slutbilden.",
    prompt: "The dealt card rests flat on the felt. The dealer lifts her fingertips, draws her hand back to the shoe in one smooth motion and settles into the ready pose. The card stays in place. Fixed camera." },
  { id: "viloloop", name: "Vila · lugn loop", model: "wan3", duration: 5,
    instruction: "Använd samma egna bild först och sist. Bedöm övergången när klippet börjar om.",
    prompt: "A locked shot of the seated dealer. She breathes quietly, blinks once and rests both hands beside the shoe. Her shoulders settle back into the opening pose." },
];

export function validPreset(value: unknown): value is Pick<PromptPreset, "name" | "prompt" | "model" | "duration"> {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<PromptPreset>;
  return typeof p.name === "string" && p.name.trim().length > 0 && p.name.length <= 80
    && typeof p.prompt === "string" && p.prompt.trim().length > 0 && p.prompt.length <= 1000
    && isDraftModel(p.model) && typeof p.duration === "number" && draftSettings(p.model).model.durations.includes(p.duration);
}
