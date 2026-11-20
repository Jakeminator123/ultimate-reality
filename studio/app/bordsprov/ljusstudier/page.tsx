import styles from "./page.module.css";

export const metadata = {
  title: "Ljus vid blackjackbordet · Dealerstudio",
};

export default function Page() {
  return (
    <main className={styles.studies}>
      <nav aria-label="Studion">
        <a href="/bordsprov/rum3d?rum=mesh&stol=4&glas=1">← Till bordsscenen</a>
      </nav>
      <header className={styles.intro}>
        <h1>Ljus vid blackjackbordet</h1>
        <p>Stol 4 ser dealern framifrån. Stol 1 ser samma vänsterhand, kortsko och glas från sidan.</p>
        <nav aria-label="Välj ljusprov">
          <a href="#handljus">Paulina v2 · vänsterhanden</a>
          <a href="#pendel">Atlas · pendellampan</a>
          <a href="#fotostudio">Poly Haven · fotostudion</a>
        </nav>
      </header>
      <section id="handljus">
        <h2>Paulina v2 drar kortet</h2>
        <p>Brown Photostudio ger bordet miljöljus på 50 %. Båda stolarna visar samma drag. I 3D-vyn kan du pausa på greppet och slå på eller av det mjuka ljuset över vänsterhanden.</p>
        <video controls loop playsInline preload="metadata" aria-label="Paulina v2 drar kortet från Stol 4 och Stol 1 med närbilder av greppet">
          <source src="/bordsprov/handljus/kortdrag-v2.mp4" type="video/mp4" />
        </video>
        <nav aria-label="Öppna vänsterhandsprovet">
          <a href="/bordsprov/handljus?stol=4">Se från Stol 4 i 3D</a>
          <a href="/bordsprov/handljus?stol=1">Se från Stol 1 i 3D</a>
          <a href="/bordsprov/handljus/grepp.jpg">Jämför greppet med och utan handljus</a>
        </nav>
      </section>
      <section id="pendel">
        <h2>Pendellampan under kortdraget</h2>
        <p>Filmen upprepar samma kortdrag. Lampan dämpas en halv sekund var tredje sekund. Följ glaskanten och vänsterhanden när det första kortet lämnar skon.</p>
        <video controls loop playsInline preload="metadata" aria-label="Kortdrag och lampblinkning från Stol 4 och Stol 1">
          <source src="/bordsprov/rum3d/pendelljus-kortutdrag.mp4" type="video/mp4" />
        </video>
        <nav aria-label="Öppna pendelprovet">
          <a href="/bordsprov/rum3d?rum=atlas-full&stol=4&glas=1&blink=1&drag=1">Öppna Atlas-rummet i 3D</a>
          <a href="/bordsprov/rum3d/pendelljus-ruta17.jpg">Jämför ljuset på ruta 17</a>
        </nav>
      </section>
      <section id="fotostudio">
        <h2>Fotostudioljus i Jakobs kasinorum</h2>
        <p>Här får kasinorummet sitt miljöljus från panoramat Brown Photostudio 01. Jämför glasets reflex, knogarna och den gröna filten med det tidigare studioljuset.</p>
        <a className={styles.photo} href="/bordsprov/brown-studio/jamforelse.jpg" aria-label="Förstora före- och efterbilderna från båda stolarna">
          <img src="/bordsprov/brown-studio/jamforelse.jpg" alt="Före och efter med Brown Photostudios miljöljus från Stol 4 och Stol 1" loading="lazy" />
        </a>
        <nav aria-label="Öppna fotostudioprovet">
          <a href="/bordsprov/brown-studio?stol=4">Öppna kasinorummet i 3D</a>
          <a href="/bordsprov/brown-studio/panorama.html">Se fotostudion i 360°</a>
        </nav>
      </section>
    </main>
  );
}
