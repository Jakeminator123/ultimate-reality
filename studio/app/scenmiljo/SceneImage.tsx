"use client";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import styles from "./scene.module.css";

export default function SceneImage({ src, alt, contain }: { src: string; alt: string; contain?: boolean }) {
  const [missing, setMissing] = useState(false);
  return missing
    ? <span className={styles.missing}><ImageOff size={20} aria-hidden/> Bildprovet saknas lokalt</span>
    : <img className={contain ? styles.contain : undefined} src={src} alt={alt} onError={() => setMissing(true)}/>;
}
