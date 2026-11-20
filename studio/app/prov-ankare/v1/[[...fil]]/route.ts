import { serveTrialResource } from "../../../../lib/local-trial-media";

const ui = "studio/app/prov-ankare/v1";
const trial = "avatars/paulina/prov-ankare/v1";
const files = new Map<string, [string, string]>([
  ["", [`${ui}/ankare.html`, "text/html; charset=utf-8"]],
  ["visare.mjs", [`${ui}/visare.mjs`, "text/javascript; charset=utf-8"]],
  ["film.mp4", [`${trial}/visning/fyra-filmprov.mp4`, "video/mp4"]],
  ["rigg.mp4", [`${trial}/kameror/a1-till-a23-synkron.mp4`, "video/mp4"]],
]);

function resource(name: string): [string, string] | undefined {
  const frame = /^bild\/((?:a1|a23)-(?:0[0-9]{2}|1[01][0-9])\.png)$/.exec(name);
  return frame ? [`${trial}/kameror/120-kameror/${frame[1]}`, "image/png"] : files.get(name);
}

async function respond(request: Request, context: { params: Promise<{ fil?: string[] }> }) {
  return serveTrialResource(request, resource((await context.params).fil?.join("/") ?? ""));
}

export const GET = respond;
export const HEAD = respond;
