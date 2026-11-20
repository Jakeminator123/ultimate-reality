import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { StudioSubpage } from "../../StudioSidebar";
import { sceneMaterial, type Study } from "../material";
import { sceneViews } from "../navigation";
import SceneImage from "../SceneImage";
import styles from "../scene.module.css";

type Props = { params: Promise<{ del?: string[] }> };

function selectedPage(del?: string[]) {
  if (!del?.length) return null;
  const view = sceneViews.find(item => item.id === del[0]);
  if (del.length > 1 || !view) notFound();
  return view;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const view = selectedPage((await params).del);
  return { title: (view?.name ?? "Scenmiljö") + " · Dealerstudio" };
}

function StudyLinks({ study }: { study: Study }) {
  return <nav className={styles.destinations} aria-label={study.title}>
    {study.links.map(link => <a key={link.href} href={link.href}>{link.label} <ArrowUpRight size={15} aria-hidden/></a>)}
  </nav>;
}

function StudyCard({ study }: { study: Study }) {
  return <article className={styles.study}>
    <p className={styles.version}>{study.version}</p>
    <h3>{study.title}</h3>
    <p>{study.description}</p>
    <StudyLinks study={study}/>
  </article>;
}

export default async function Page({ params }: Props) {
  const view = selectedPage((await params).del);
  if (!view) return <StudioSubpage area="scenmiljo"><main className={styles.page}>
    <header className={styles.heading}><h1>Scenmiljö</h1><p>Fotograferade rum, blackjackbordet och Paulinas scenprov.</p></header>
    <div className={styles.overview}>{sceneViews.map(item => {
      const { featured, preview } = sceneMaterial[item.id];
      return <a key={item.id} className={styles.card} href={"/scenmiljo/" + item.id}>
        <div className={styles.image}><SceneImage {...preview}/></div>
        <div className={styles.cardBody}>
          <span className={styles.version}>{featured.version}</span>
          <h2>{item.name} <ArrowRight size={19} aria-hidden/></h2>
          <p>{featured.title}</p>
        </div>
      </a>;
    })}</div>
  </main></StudioSubpage>;

  const { featured, preview, related, archive } = sceneMaterial[view.id];
  return <StudioSubpage area={view.id}><main className={styles.page}>
    <a className={styles.back} href="/scenmiljo"><ArrowLeft size={15} aria-hidden/> Scenmiljö</a>
    <header className={styles.heading}><h1>{view.name}</h1></header>
    <section className={styles.featured} aria-labelledby="active-scene">
      <figure><div className={styles.image}><SceneImage key={preview.src} {...preview}/></div><figcaption>{preview.caption}</figcaption></figure>
      <div className={styles.featuredBody}>
        <p className={styles.version}>{featured.version}</p>
        <h2 id="active-scene">{featured.title}</h2>
        <p>{featured.description}</p>
        <StudyLinks study={featured}/>
      </div>
    </section>
    {related.length > 0 && <div className={styles.studies}>{related.map(study => <StudyCard key={study.title} study={study}/>)}</div>}
    {archive.length > 0 && <details className={styles.archive}>
      <summary>Tidigare prov</summary>
      <div className={styles.studies}>{archive.map(study => <StudyCard key={study.title} study={study}/>)}</div>
    </details>}
  </main></StudioSubpage>;
}
