/**
 * Verzija B (A2UI) preko CopilotKit-a – React deo stranice. Učitava se tek kad korisnik izabere verziju B,
 * da tabla i verzija A ostanu brze. Chat razgovara sa CopilotKit runtime-om (/api/copilotkit) koji
 * koristi isti MCP server – stranica ne računa ništa.
 *
 * AI slaže A2UI ekran iz našeg kataloga (katalog.tsx); podatke dodaje server (src/chat/copilotkit.ts).
 */
import { CopilotChat, CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import "leaflet/dist/leaflet.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { katalogCopilot } from "./katalog.js";

const LABELE = {
  chatInputPlaceholder: "Postavite pitanje…",
  welcomeMessageText: "Pitajte za vazduh, vreme ili vodu u Novom Sadu.",
  chatDisclaimerText: "Kategoriju vazduha računa modul pravila (EAQI).",
  chatConnectingLabel: "Povezivanje…",
};

let pokrenuto = false;

export function pokreniCopilotKit(koren: HTMLElement): void {
  if (pokrenuto) return;
  pokrenuto = true;
  createRoot(koren).render(
    <StrictMode>
      <CopilotKit runtimeUrl="/api/copilotkit" a2ui={{ catalog: katalogCopilot }} showDevConsole={false}>
        <CopilotChat agentId="a2ui" labels={LABELE} className="ck-chat" />
      </CopilotKit>
    </StrictMode>,
  );
}
