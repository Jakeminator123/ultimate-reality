"use client";
import { useEffect, useState } from "react";
import type { ModelingInventory } from "../lib/modeling";
import type { DealerMaterial } from "../lib/material-types";

function useLocalModelData<T>(url: string) {
  const [inventory, setInventory] = useState<T | null>(null);
  const [loadedUrl, setLoadedUrl] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Modelleringsunderlaget kunde inte läsas.");
        if (!controller.signal.aborted) { setInventory(data); setLoadedUrl(url); }
      } catch (e) {
        if (!controller.signal.aborted) { setError((e as Error).message); setInventory(null); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [revision, url]);

  return { inventory: loadedUrl === url ? inventory : null, loading, error, refresh: () => setRevision(value => value + 1) };
}

export function useModelingInventory() {
  return useLocalModelData<ModelingInventory>("/api/modeling");
}

export function useCurrentModel(edition?: string, dealer = "paulina") {
  const revision = edition ? "&revision=" + encodeURIComponent(edition) : "";
  return useLocalModelData<DealerMaterial>("/api/material?report=json&dealer=" + encodeURIComponent(dealer) + revision);
}
