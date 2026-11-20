"use client";
import { useCallback, useEffect, useState } from "react";
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

  const refresh = useCallback(() => setRevision(value => value + 1), []);
  return { inventory: loadedUrl === url ? inventory : null, loading, error, refresh };
}

export function useModelingInventory() {
  return useLocalModelData<ModelingInventory>("/api/modeling");
}

export function useCurrentModel(edition?: string, dealer = "paulina") {
  const revision = edition ? "&revision=" + encodeURIComponent(edition) : "";
  const url = "/api/material?dealer=" + encodeURIComponent(dealer);
  const result = useLocalModelData<DealerMaterial>(url + "&report=json" + revision);
  const stamp = result.inventory?.stamp, refresh = result.refresh;
  useEffect(() => {
    if (!stamp) return;
    const controller = new AbortController();
    let checking = false;
    async function check() {
      if (document.hidden || checking) return;
      checking = true;
      try {
        const response = await fetch(url + "&stamp=1", { cache: "no-store", signal: controller.signal });
        if (response.ok && (await response.json()).stamp !== stamp && !controller.signal.aborted) refresh();
      } catch { /* The next visible check retries when the local preview reconnects. */ }
      finally { checking = false; }
    }
    const timer = window.setInterval(check, 15000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      controller.abort(); window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check); window.removeEventListener("focus", check);
    };
  }, [url, stamp, refresh]);
  return result;
}
