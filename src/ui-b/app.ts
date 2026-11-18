/**
 * Verzija B (T13): A2UI renderer unutar MCP App iframe-a.
 *
 * Tok: host pošalje rezultat alata → iz njega uzmemo A2UI poruke (application/a2ui+json)
 * → MessageProcessor ih primeni sa našim katalogom → <a2ui-surface> iscrta ekran.
 * „Osveži“ i „Prikaži“ → callServerTool("osvezi_a2ui", { stationId }) → nove poruke → isti tok.
 *
 * Ekran ne računa ništa (pravilo 4): samo crta ono što server pošalje.
 */
import { App } from "@modelcontextprotocol/ext-apps";
import { A2uiSurface } from "@a2ui/lit/v0_9";
import { injectBasicCatalogStyles } from "@a2ui/web_core/v0_9/basic_catalog";
import { MessageProcessor, type ActionPayload, type ProcessableMessagePayload } from "@a2ui/web_core/v0_9";
import { html, render } from "lit";
import { katalog } from "./katalog.js";

const A2UI_MIME_TYPE = "application/a2ui+json";
const AKCIJE = new Set(["osvezi", "izaberi_stanicu"]);

// Referenca na klasu osigurava da je <a2ui-surface> registrovan (bundler ga ne izbaci).
void A2uiSurface;
injectBasicCatalogStyles();

const koren = document.getElementById("app") as HTMLElement;
const greska = document.getElementById("greska") as HTMLElement;

const app = new App({ name: "Kvalitet vazduha (A2UI)", version: "1.0.0" });

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

/** stationId iz konteksta akcije: { izbor: ["demo-liman"] } (ChoicePicker vraća listu). */
function izabranaStanica(kontekst: Record<string, unknown>): string | undefined {
  const izbor = kontekst.izbor;
  const prvi = Array.isArray(izbor) ? izbor[0] : izbor;
  return typeof prvi === "string" && prvi.length > 0 ? prvi : undefined;
}

let zauzeto = false;
async function naAkciju(akcija: ActionPayload) {
  if (!AKCIJE.has(akcija.name) || zauzeto) return;
  zauzeto = true;
  try {
    const stationId = izabranaStanica(akcija.context);
    const rezultat = await app.callServerTool({ name: "osvezi_a2ui", arguments: stationId ? { stationId } : {} });
    primeni(rezultat as SadrzajAlata);
  } catch {
    prikaziGresku("Osvežavanje nije uspelo. Pokušajte ponovo.");
  } finally {
    zauzeto = false;
  }
}

const processor = new MessageProcessor([katalog], naAkciju);
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
    prikaziGresku("Prikaz nije mogao da se iscrta. Pokušajte ponovo.");
  }
}

app.ontoolresult = (rezultat) => primeni(rezultat as SadrzajAlata);

app.connect();
