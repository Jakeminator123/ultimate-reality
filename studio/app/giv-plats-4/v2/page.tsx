import type { Metadata } from "next";
import DealPlayer from "../DealPlayer";

export const metadata: Metadata = { title: "Paulinas giv · 120 kameravinklar · Dealerstudio" };

export default function Page() {
  return <DealPlayer version="v2" />;
}
