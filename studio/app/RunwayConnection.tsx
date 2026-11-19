"use client";
import { useEffect, useState } from "react";

const messages = {
  loading: "Läser lokal inställning…",
  configured: "API-nyckel konfigurerad på servern.",
  missing: "API-nyckel saknas på servern.",
  checking: "Kontrollerar åtkomst hos Runway…",
  verified: "Runway bekräftade API-åtkomsten.",
  invalid: "Runway avvisade API-nyckeln.",
  forbidden: "Runway nekade åtkomst till organisationsuppgifterna.",
  limited: "Runway har begränsat antalet anrop. Försök senare.",
  unavailable: "Anslutningen kunde inte kontrolleras.",
};
type State = keyof typeof messages;

async function readState(method: "GET" | "POST", signal?: AbortSignal): Promise<State> {
  const response = await fetch("/api/runway", { method, signal, cache: "no-store" });
  if (response.ok) {
    const { state } = await response.json();
    if (typeof state === "string" && Object.hasOwn(messages, state)) return state as State;
  }
  return "unavailable";
}

export default function RunwayConnection() {
  const [state, setState] = useState<State>("loading");
  useEffect(() => {
    const controller = new AbortController();
    readState("GET", controller.signal)
      .then((value) => { if (!controller.signal.aborted) setState(value); })
      .catch(() => { if (!controller.signal.aborted) setState("unavailable"); });
    return () => controller.abort();
  }, []);

  async function check() {
    setState("checking");
    try { setState(await readState("POST")); }
    catch { setState("unavailable"); }
  }

  return <div className="runway-connection">
    <div><strong>Runway API · lokalt utkast</strong>
      <p role="status">{messages[state]}</p>
      <small>Kontrollen läser kontots åtkomst. En film via Runway MCP använder appens krediter.</small>
    </div>
    <button type="button" onClick={check} disabled={state === "checking" || state === "loading" || state === "missing"}>Testa API-anslutning</button>
  </div>;
}
