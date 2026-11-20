import { serveTrialResource, type TrialResource } from "../../../../lib/local-trial-media";

const editions = new Map<string, TrialResource>([
  ["bildutgava.pdf", ["information/lokalt/paulina-foto-till-rorelse.pdf", "application/pdf"]],
  ["illustrerad.pdf", ["output/pdf/paulina-foto-till-rorelse.pdf", "application/pdf"]],
]);

export async function GET(request: Request, context: { params: Promise<{ fil: string }> }) {
  return serveTrialResource(request, editions.get((await context.params).fil));
}

export const HEAD = GET;
