import type { ReactNode } from "react";
import { Aperture, BookOpen, Box, Calculator, Clapperboard, FolderOpen, LayoutGrid, Layers3 } from "lucide-react";

export const secondaryWorkspaces = [
  { id: "scen", name: "3D-scen", icon: Layers3 },
  { id: "film", name: "Filmutkast", icon: Clapperboard },
  { id: "modeller", name: "Modeller och pris", icon: Calculator },
  { id: "promptmallar", name: "Startprompter", icon: BookOpen },
] as const;

export type Workspace = "oversikt" | "modellering" | (typeof secondaryWorkspaces)[number]["id"];
type StudioArea = Workspace | "bilder" | "ovrigt";

export function StudioSidebar({ area, editor, dirty }: { area: StudioArea; editor?: boolean; dirty?: boolean }) {
  const root = editor ? "#" : "/#";
  const external = dirty ? { target: "_blank", rel: "noreferrer" } : {};
  const current = (id: StudioArea) => area === id ? "page" as const : undefined;
  return <header className="studio-sidebar">
    <div className="studio-brand">
      <span className="studio-mark"><Aperture size={24} aria-hidden/></span>
      <div><b>Ultimate Reality</b><small>Dealerstudio</small></div>
    </div>
    <nav className="workspace-nav" aria-label="Arbetsyta">
      <a href={root + "oversikt"} aria-current={current("oversikt")}><LayoutGrid size={18} aria-hidden/> Översikt</a>
      <div className="nav-phases" role="group" aria-label="3D-modellering">
        <p><Box size={18} aria-hidden/> 3D-modellering</p>
        <a href="/bildstandard" aria-current={current("bilder")} {...external}><small>Fas 1</small> Bildpipeline</a>
        <a href={root + "modellering"} aria-current={current("modellering")}><small>Fas 2</small> 3D-modell</a>
      </div>
      <div className="nav-secondary" role="group" aria-label="Övriga verktyg">
        <p>Övriga verktyg</p>
        {secondaryWorkspaces.map(({ id, name, icon: Icon }) => <a key={id} href={root + id} aria-current={current(id)}>
          <Icon size={17} strokeWidth={1.7} aria-hidden/>{name}
        </a>)}
        <a href="/ovrigt" aria-current={current("ovrigt")} {...external}><FolderOpen size={17} aria-hidden/> Övrigt</a>
      </div>
    </nav>
    <span className="workspace-local"><i/> Lokal arbetsyta</span>
  </header>;
}

export function StudioSubpage({ area, children }: { area: "bilder" | "ovrigt"; children: ReactNode }) {
  return <div className="studio-shell studio-subpage"><StudioSidebar area={area}/>{children}</div>;
}
