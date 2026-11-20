export type SamPose = {
  run: string;
  index: number;
  source: string;
  hasViewer: boolean;
  hasSheet: boolean;
  hasComparison: boolean;
  hasFront: boolean;
  hasTablePose: boolean;
  hasAppearance: boolean;
  hasUpright: boolean;
};

export type ModelingInventory = {
  inbox: string;
  images: string[];
  gpu: string | null;
  checkpoints: string[];
  poses: SamPose[];
  activeModel: ActiveDealerModel | null;
};

export type ActiveDealerModel = {
  id: string;
  name: string;
  url: string;
  appearanceUrl?: string;
};

export type PoseVersion = "front" | "bordsvila" | "utseende" | "rak";

export function resultUrl(pose: SamPose, view: "mesh" | "sheet" | "comparison" | PoseVersion) {
  const params = new URLSearchParams({ run: pose.run, index: String(pose.index), view });
  return "/api/modeling?" + params.toString();
}
