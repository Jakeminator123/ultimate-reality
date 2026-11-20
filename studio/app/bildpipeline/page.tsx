import Bildpipeline from "./Bildpipeline";
import { StudioSubpage } from "../StudioSidebar";

export const metadata = {
  title: "Bildbeställning · Dealerstudio",
  description: "Förbered, beställ och granska en dealers bildserie i Runway.",
};

export default function Page() {
  return <StudioSubpage area="bilder"><Bildpipeline/></StudioSubpage>;
}
