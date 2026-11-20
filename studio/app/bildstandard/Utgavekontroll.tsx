import { referenskort } from "../../fotomall/kortstandard";
import { roleName, type DealerMaterial } from "../../lib/material-types";
import { reviewPhotoSeries } from "../../lib/photo-review";
import styles from "./bildstandard.module.css";

export default function Utgavekontroll({ project }: { project: DealerMaterial }) {
  const rows = reviewPhotoSeries(project);
  const found = rows.filter(r => r.photo);
  const portraits = rows.filter(r => r.recipe.grupp === "Ansikte");
  const cards = rows.filter(r => r.usesCard);
  const cardSamples = cards.flatMap(r => r.photo?.review?.cardPrint ? [r.photo.review.cardPrint] : []);
  const checkedPrint = cardSamples.filter(id => id === referenskort.id);
  const oldPrints = [...new Set(cardSamples)].filter(id => id !== referenskort.id);
  const faceReferences = portraits.filter(r => r.photo?.review?.decision === "usable").length;
  const visualCount = found.filter(r => r.photo?.review).length;
  const exact = found.filter(r => r.exactDelivery).length;
  return <section id="utgavekontroll" aria-labelledby="edition-review" className={styles.utgavekontroll}>
    <header><h2 id="edition-review">Kontroll av bildutgåvan</h2><p>{project.dealer.charAt(0).toUpperCase() + project.dealer.slice(1)} · {project.edition}</p></header>
    <dl className={styles.reviewFacts}>
      <div><dt>Bildfiler</dt><dd>{found.length}/{rows.length} verifierade mot registret</dd></div>
      <div><dt>Porträtt</dt><dd>{faceReferences}/{portraits.length} bedömda som användbara</dd></div>
      <div><dt>Dagens pixelmått och PNG</dt><dd>{found.length ? exact + "/" + found.length + " matchar" : "Underlag saknas"}</dd></div>
      <div><dt>X och hörnpunkt</dt><dd>{cardSamples.length ? checkedPrint.length + "/" + cardSamples.length + " granskade kortbilder" : "Bedömning saknas"}</dd></div>
    </dl>
    <p>Visuell bedömning finns för {visualCount} av {found.length} tillgängliga vyer. Pixelmåtten jämförs med dagens leveransrecept.
      {oldPrints.length > 0 && <> I den här utgåvan förekommer korttrycket <b>{oldPrints.join(", ")}</b>. Nya handbilder använder <b>{referenskort.id}</b>.</>}</p>
    <details><summary>Se varje bilds användning och avvikelser</summary>
      <div className={styles.reviewTable}><table><thead><tr><th scope="col">Bildvy</th><th scope="col">Original och leveransmål</th><th scope="col">Användning</th><th scope="col">Visuell bedömning</th></tr></thead>
        <tbody>{rows.map(({ recipe, photo, roles, target }) => <tr key={recipe.id}>
          <th scope="row">{photo ? <a href={photo.url}>{recipe.namn}</a> : recipe.namn}{recipe.extra && <small>Extra vy</small>}</th>
          <td>{photo ? photo.format + " · " + photo.width + " × " + photo.height : "Original saknas"}<small>Mål · PNG · {target.ratio.replace(":", " × ")} px</small></td>
          <td>{!photo ? "–" : roles.length ? roles.map(r => roleName[r]).join(" och ") :
            recipe.grupp === "Stående" ? "Identitet och klädsel" : recipe.formatnyckel !== "person" ? "Greppreferens" : "Referens i serien"}</td>
          <td>{photo?.review ? <><strong>{photo.review.decision === "usable" ? "Användbar" : "Med förbehåll"}</strong> · {photo.review.note}</> : "Bedömning saknas för den här filversionen."}</td>
        </tr>)}</tbody></table></div>
    </details>
  </section>;
}
