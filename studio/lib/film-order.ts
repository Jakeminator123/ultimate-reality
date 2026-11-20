import type { FilmFormat } from "./model";
import type { PipelineJob } from "./bildpipeline";

export type FilmOrder = {
  version: number;
  job: PipelineJob;
  result?: {
    sha256: string;
    bytes: number;
    frames: number;
    format: FilmFormat;
  };
};
