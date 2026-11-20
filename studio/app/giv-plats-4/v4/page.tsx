import type { Metadata } from "next";
import DealPlayer from "../DealPlayer";

export const metadata: Metadata = { title: "Paulinas giv V4 · Dealerstudio" };

export default function Page() {
  return <DealPlayer version="v4" />;
}
