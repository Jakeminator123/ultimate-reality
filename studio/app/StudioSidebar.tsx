import type { ReactNode } from "react";
import { Aperture, BookOpen, Box, Calculator, Clapperboard, FolderOpen, LayoutGrid, Layers3 } from "lucide-react";
import { panoramaCatalog, sceneViews, type SceneView } from "./scenmiljo/navigation";

const gripWorkspace = { id: "scen", name: "Grepp och landning" } as const;
const filmWorkspaces = [
  { id: "film", name: "Filmutkast", icon: Clapperboard },
  { id: "modeller", name: "Modeller och pris", icon: Calculator },
  { id: "promptmallar", name: "Startprompter", icon: BookOpen },
] as const;
export const secondaryWorkspaces = [gripWorkspace, ...filmWorkspaces] as const;

export type Workspace = "oversikt" | "modellering" | (typeof secondaryWorkspaces)[number]["id"];
type SubpageArea = "bilder" | "rorelseprov" | "ovrigt" | "scenmiljo" | SceneView | typeof panoramaCatalog.id;
type StudioArea = Workspace | SubpageArea;

export function StudioSidebar({ area, editor, dirty }: { area: StudioArea; editor?: boolean; dirty?: boolean }) {
  const root = editor ? "#" : "/#";
  const external = dirty ? { target: "_blank", rel: "noreferrer" } : {};
  const current = (id: StudioArea) => area === id ? "page" as const : undefined;
  const sceneChildren: Partial<Record<SceneView, ReactNode>> = {
    bakgrund: <a className="nav-child" href={panoramaCatalog.href} aria-current={current(panoramaCatalog.id)} {...external}>{panoramaCatalog.name}</a>,
    scenprov: <a className="nav-child" href={root + gripWorkspace.id} aria-current={current(gripWorkspace.id)}>{gripWorkspace.name}</a>,
  };
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
        <div className="nav-branch" role="group" aria-label="Fas 2 · 3D-modell">
          <a href={root + "modellering"} aria-current={current("modellering")}><small>Fas 2</small> 3D-modell</a>
          <a className="nav-child" href="/modellering/rorelseprov" aria-current={current("rorelseprov")} {...external}>Rörelseprov</a>
        </div>
      </div>
      <div className="nav-environment" role="group" aria-label="Scenmiljö">
        <a className="nav-environment-title" href="/scenmiljo" aria-current={current("scenmiljo")} {...external}>
          <Layers3 size={18} aria-hidden/> Scenmiljö
        </a>
        {sceneViews.map(({ id, name }) => {
          const viewLink = <a key={id} className="nav-environment-view" href={"/scenmiljo/" + id} aria-current={current(id)} {...external}>{name}</a>;
          if (sceneChildren[id]) return <div key={id} className="nav-branch" role="group" aria-label={name}>
            {viewLink}
            {sceneChildren[id]}
          </div>;
          return viewLink;
        })}
      </div>
      <div className="nav-secondary" role="group" aria-label="Övriga verktyg">
        <p>Övriga verktyg</p>
        {filmWorkspaces.map(({ id, name, icon: Icon }) => <a key={id} href={root + id} aria-current={current(id)}>
          <Icon size={17} strokeWidth={1.7} aria-hidden/>{name}
        </a>)}
        <a href="/ovrigt" aria-current={current("ovrigt")} {...external}><FolderOpen size={17} aria-hidden/> Övrigt</a>
      </div>
    </nav>
    <span className="workspace-local"><i/> Lokal arbetsyta</span>
  </header>;
}

export function StudioSubpage({ area, children }: { area: SubpageArea; children: ReactNode }) {
  return <div className="studio-shell studio-subpage"><StudioSidebar area={area}/>{children}</div>;
}
