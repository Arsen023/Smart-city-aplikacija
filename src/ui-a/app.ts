/**
 * Verzija A (T10): MCP App ekran nad Rezultat-om iz assess_air_quality.
 *
 * Tok: host pošalje rezultat alata → provera oblika (sema.ts) → modelEkrana (prikaz.ts) → crtaj (crtaj.ts).
 * „Osveži“, promena stanice i „Pokušaj ponovo“ → callServerTool("assess_air_quality", { stationId }).
 * Ekran ne računa ništa (pravilo 4): samo crta ono što server vrati.
 */
import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { crtaj, crtajStanice, crtajZauzeto, dom } from "./crtaj.js";
import { modelEkrana, tekstZaModel, type ModelEkrana, type StanjeEkrana } from "./prikaz.js";
import { procitajRezultat, procitajStanice, type StanicaZaIzbor } from "./sema.js";

const ALAT_PROCENA = "assess_air_quality";
const ALAT_STANICE = "get_stations";
/** Isti ključ kao META_SADA u src/server/alati.ts (ekran ne uvozi server). */
const META_SADA = "smartcity/sada";

const app = new App({ name: "Kvalitet vazduha", version: "1.0.0" });

let trenutni: ModelEkrana = modelEkrana({ vrsta: "ucitavanje" });
let stanice: StanicaZaIzbor[] = [];
let staniceUcitane = false;
let zauzeto = false;

// ─── Tema hosta ────────────────────────────────────────────────────────────

function primeniKontekst(ctx: McpUiHostContext | undefined) {
  if (!ctx) return;
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
  if (ctx.safeAreaInsets) {
    const { top, right, bottom, left } = ctx.safeAreaInsets;
    document.body.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
  }
}

app.onhostcontextchanged = primeniKontekst;

// ─── Rezultat alata → ekran ────────────────────────────────────────────────

/** „sada“ servera; ako ga nema ili nije ispravan, ekran samo ne prikazuje „pre X min“. */
function procitajSada(v: unknown): Date | undefined {
  if (typeof v !== "string") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function stanjeIzRezultata(rezultat: CallToolResult): StanjeEkrana {
  const r = rezultat.isError ? null : procitajRezultat(rezultat.structuredContent);
  if (r) return { vrsta: "rezultat", rezultat: r, sada: procitajSada(rezultat._meta?.[META_SADA]) };
  const stanica = trenutni.stanicaId ? { id: trenutni.stanicaId, naziv: dom.izbor.selectedOptions[0]?.text ?? "" } : undefined;
  // isError bez Rezultat-a ili neispravan oblik: opšta poruka, bez tehničkih detalja.
  return { vrsta: "greska", stanica };
}

function prikazi(stanje: StanjeEkrana) {
  trenutni = modelEkrana(stanje);
  crtaj(trenutni);
  crtajStanice(stanice, trenutni.stanicaId);
  crtajZauzeto(zauzeto, stanice.length);
  // Javi modelu šta korisnik gleda; ne utiče na prikaz ako host to ne podržava.
  app.updateModelContext({ content: [{ type: "text", text: tekstZaModel(trenutni) }] }).catch(() => {});
}

async function ucitajStanice() {
  if (staniceUcitane) return;
  staniceUcitane = true;
  try {
    const odgovor = await app.callServerTool({ name: ALAT_STANICE, arguments: {} });
    const lista = odgovor.isError ? null : procitajStanice(odgovor.structuredContent);
    if (lista) stanice = lista;
  } catch {
    // Izbor ostaje sa trenutnom stanicom; ostatak ekrana radi.
  }
  crtajStanice(stanice, trenutni.stanicaId);
  crtajZauzeto(zauzeto, stanice.length);
}

app.ontoolresult = (rezultat) => {
  prikazi(stanjeIzRezultata(rezultat));
  void ucitajStanice();
};

// ─── Akcije korisnika ──────────────────────────────────────────────────────

async function proceni(stationId: string | null) {
  if (zauzeto) return;
  zauzeto = true;
  crtajZauzeto(true, stanice.length);
  let stanje: StanjeEkrana;
  try {
    const odgovor = await app.callServerTool({
      name: ALAT_PROCENA,
      arguments: stationId ? { stationId } : {},
    });
    stanje = stanjeIzRezultata(odgovor);
  } catch {
    const naziv = stanice.find((s) => s.id === stationId)?.naziv ?? "";
    stanje = { vrsta: "greska", stanica: stationId ? { id: stationId, naziv } : undefined };
  }
  zauzeto = false;
  prikazi(stanje);
  void ucitajStanice();
}

dom.osvezi.addEventListener("click", () => void proceni(trenutni.stanicaId));
dom.pokusajPonovo.addEventListener("click", () => void proceni(trenutni.stanicaId));
dom.izbor.addEventListener("change", () => void proceni(dom.izbor.value || null));

// ─── Povezivanje ───────────────────────────────────────────────────────────

crtaj(trenutni);
app
  .connect()
  .then(() => {
    primeniKontekst(app.getHostContext());
    dom.osvezi.disabled = false;
  })
  .catch(() => prikazi({ vrsta: "greska", poruka: "Veza sa aplikacijom domaćinom nije uspostavljena." }));
