import type { GranskadVy } from "../../fotomall/bildserie";

export type PaulinaExempel = GranskadVy & {
  bildUrl: string;
  granskning?: boolean;
};
