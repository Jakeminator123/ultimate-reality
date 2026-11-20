import type { Metadata } from "next";
import DealPlayer from "../DealPlayer";

export const metadata: Metadata = { title: "Paulinas giv till plats 4 · Dealerstudio" };

export default function Page() {
  return <DealPlayer version="v1" />;
}
