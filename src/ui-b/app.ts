/**
 * Verzija B (PROBA, T03): A2UI renderer unutar MCP App iframe-a.
 *
 * Tok: host pošalje rezultat alata → iz njega uzmemo A2UI poruke (application/a2ui+json)
 * → MessageProcessor ih primeni → <a2ui-surface> iscrta ekran.
 * Klik na dugme → akcija → callServerTool("osvezi_a2ui") → nove poruke → isti tok.
 */
import { App } from "@modelcontextprotocol/ext-apps";
import { A2uiSurface, basicCatalog } from "@a2ui/lit/v0_9";
import { injectBasicCatalogStyles } from "@a2ui/web_core/v0_9/basic_catalog";
import { MessageProcessor, type ActionPayload, type ProcessableMessagePayload } from "@a2ui/web_core/v0_9";
import { html, render } from "lit";

const A2UI_MIME_TYPE = "application/a2ui+json";

// Referenca na klasu osigurava da je <a2ui-surface> registrovan (bundler ga ne izbaci).
void A2uiSurface;
injectBasicCatalogStyles();

const koren = document.getElementById("app") as HTMLElement;
const greska = document.getElementById("greska") as HTMLElement;

const app = new App({ name: "Kvalitet vazduha (A2UI)", version: "0.1.0" });

type SadrzajAlata = { content?: Array<{ type: string; resource?: { mimeType?: string; text?: string } }> };

/** Izvlači A2UI poruke iz rezultata alata. */
function a2uiPoruke(rezultat: SadrzajAlata): unknown[] {
  const poruke: unknown[] = [];
  for (const c of rezultat.content ?? []) {
    if (c.type === "resource" && c.resource?.mimeType === A2UI_MIME_TYPE && c.resource.text) {
      poruke.push(...(JSON.parse(c.resource.text) as unknown[]));
    }
  }
  return poruke;
}

function prikaziGresku(tekst: string | null) {
  greska.textContent = tekst ?? "";
  greska.hidden = !tekst;
}

async function naAkciju(akcija: ActionPayload) {
  if (akcija.name !== "osvezi") return;
  try {
    const rezultat = await app.callServerTool({ name: "osvezi_a2ui", arguments: akcija.context });
    primeni(rezultat as SadrzajAlata);
  } catch {
    prikaziGresku("Osvežavanje nije uspelo. Pokušajte ponovo.");
  }
}

const processor = new MessageProcessor([basicCatalog], naAkciju);
const postojeciSurface = new Set<string>();

processor.onSurfaceCreated((surface) => {
  postojeciSurface.add(surface.id);
  // lit render() ne briše postojeći sadržaj, pa prvo uklanjamo „Učitavanje…“
  koren.replaceChildren();
  render(html`<a2ui-surface .surface=${surface}></a2ui-surface>`, koren);
});

function primeni(rezultat: SadrzajAlata) {
  try {
    // Ako host ponovo pošalje ceo ekran, ne pravimo isti surface dvaput.
    const poruke = a2uiPoruke(rezultat).filter((p) => {
      const id = (p as { createSurface?: { surfaceId: string } }).createSurface?.surfaceId;
      return !(id && postojeciSurface.has(id));
    });
    if (poruke.length === 0) return;
    processor.processMessages(poruke as ProcessableMessagePayload);
    prikaziGresku(null);
  } catch (e) {
    console.error("A2UI greška:", e);
    prikaziGresku("Prikaz nije mogao da se iscrta (neispravne A2UI poruke).");
  }
}

app.ontoolresult = (rezultat) => primeni(rezultat as SadrzajAlata);

app.connect();
