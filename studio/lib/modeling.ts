export type SamPose = {
  run: string;
  index: number;
  source: string;
  hasViewer: boolean;
  hasSheet: boolean;
  hasComparison: boolean;
};

export type ModelingInventory = {
  inbox: string;
  images: string[];
  gpu: string | null;
  checkpoints: string[];
  poses: SamPose[];
};

export function resultUrl(pose: SamPose, view: "mesh" | "sheet" | "comparison") {
  const params = new URLSearchParams({ run: pose.run, index: String(pose.index), view });
  return "/api/modeling?" + params.toString();
}
