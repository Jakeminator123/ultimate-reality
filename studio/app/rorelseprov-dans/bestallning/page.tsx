import { ArrowLeft } from "lucide-react";
import DanceOrder from "./DanceOrder";
import styles from "../../giv-plats-4/deal.module.css";

export const metadata = { title: "Beställ Paulinas rörelseprov · Dealerstudio" };

export default function Page() {
  return <main className={styles.main}>
    <nav><a className={styles.back} href="/rorelseprov-dans"><ArrowLeft size={16} aria-hidden /> Till rörelseprovet</a></nav>
    <header className={styles.header}><h1>Beställ Paulinas rörelseprov</h1></header>
    <DanceOrder />
  </main>;
}
