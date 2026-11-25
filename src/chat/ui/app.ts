/**
 * Chat stranica: korisnik pita, Groq (preko chat servera) bira alat, alat se poziva na
 * MCP serveru, a ekran A ili B se prikazuje u razgovoru. Prekidač A/B bira verziju ekrana –
 * podaci, kategorija i savet su isti (isti MCP server, K1–K3).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ActionPayload } from "@a2ui/web_core/v0_9";
import {
  ALAT_PROCENE,
  ALATI_ZA_EKRAN_B,
  alatiZaVerziju,
  argumentiPoziva,
  jeGreskaProcene,
  MAX_KORAKA,
  OPIS_VERZIJE,
  tekstZaModel,
  uChatAlat,
  type ChatPoruka,
  type McpAlat,
  type Verzija,
} from "../alati.js";
import { a2uiIzRezultata, prikaziA2ui, type A2uiIzAlata } from "./a2ui-prikaz.js";
import { pokreniTablu } from "./dashboard.js";
import { imaEkran, prikaziEkran } from "./ekran.js";

type Komponenta = { id: string; component: string } & Record<string, unknown>;
interface OdgovorChata {
  poruka: ChatPoruka;
  /** Samo u verziji B, uz konačan odgovor: raspored koji je sastavio AI (null = rezervni ekran). */
  a2ui?: { komponente: Komponenta[] | null; razlog?: string };
}

const razgovor = document.getElementById("razgovor") as HTMLElement;
const forma = document.getElementById("forma") as HTMLFormElement;
const unos = document.getElementById("unos") as HTMLInputElement;
const dugme = document.getElementById("posalji") as HTMLButtonElement;
const status = document.getElementById("status") as HTMLElement;
const predlozi = document.getElementById("predlozi") as HTMLElement;

const parametri = new URLSearchParams(location.search);

let klijent: Client | null = null;
let alati: Tool[] = [];
let sandboxUrl = "";
let kontekstEkrana: string | null = null;
const poruke: ChatPoruka[] = [];

// ─── Verzija ────────────────────────────────────────────────────────────────

/**
 * Prekidač u zaglavlju chata: A = naš chat sa MCP App ekranom; B = A2UI preko CopilotKit-a
 * (src/chat/ui/copilot/). Ovaj razgovor (pitajModel, posalji) zato uvek radi kao verzija A.
 * `?verzija=B` odmah bira B.
 */
function verzija(): Verzija {
  return "A";
}

// Promena verzije: B prikazuje CopilotKit chat; povratak na A počinje novi razgovor.
document.querySelectorAll<HTMLInputElement>('input[name="verzija"]').forEach((r) =>
  r.addEventListener("change", () => {
    if (prikaziCopilotKit(r.value === "B")) return;
    poruke.length = 0;
    kontekstEkrana = null;
    if (razgovor.childElementCount > 0) dodaj("razdelnik", `Prebačeno na ${OPIS_VERZIJE.A} – novi razgovor`);
  }),
);

/**
 * Verzija B: umesto našeg razgovora prikazuje se CopilotKit chat (React). Kod se učitava tek pri
 * prvom izboru, da tabla i verzija A ostanu brze. Vraća true kad je B uključena.
 */
function prikaziCopilotKit(ukljuci: boolean): boolean {
  const panel = document.getElementById("chat") as HTMLElement;
  const koren = document.getElementById("copilotkit") as HTMLElement;
  panel.classList.toggle("ck-aktivan", ukljuci);
  koren.hidden = !ukljuci;
  if (ukljuci) {
    void import("./copilot/index.js")
      .then((m) => m.pokreniCopilotKit(koren))
      .catch(() => {
        koren.textContent = "CopilotKit nije mogao da se učita.";
      });
  }
  return ukljuci;
}

if (parametri.get("verzija") === "B") {
  (document.getElementById("verzija-b") as HTMLInputElement).checked = true;
  prikaziCopilotKit(true);
}

// ─── Otvaranje i zatvaranje chata (okrugla ikonica dole desno) ──────────────

const panelChata = document.getElementById("chat") as HTMLElement;
const dugmeChata = document.getElementById("chat-dugme") as HTMLButtonElement;

function otvoriChat(otvoren: boolean) {
  panelChata.hidden = !otvoren;
  dugmeChata.setAttribute("aria-expanded", String(otvoren));
  dugmeChata.setAttribute("aria-label", otvoren ? "Zatvori chat" : "Otvori chat");
  dugmeChata.textContent = otvoren ? "✕" : "💬";
  if (otvoren) {
    razgovor.scrollTop = razgovor.scrollHeight;
    if (!dugme.disabled) unos.focus();
  } else {
    dugmeChata.focus();
  }
}

dugmeChata.addEventListener("click", () => otvoriChat(Boolean(panelChata.hidden)));
document.getElementById("zatvori-chat")?.addEventListener("click", () => otvoriChat(false));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !panelChata.hidden) otvoriChat(false);
});
// ?chat=1 otvara chat odmah (npr. za demo)
if (parametri.get("chat") === "1" || parametri.has("verzija")) otvoriChat(true);

// ─── Prikaz poruka ──────────────────────────────────────────────────────────

function dodaj(klasa: string, tekst?: string): HTMLElement {
  const el = document.createElement("div");
  el.className = `poruka ${klasa}`;
  if (tekst !== undefined) el.textContent = tekst.replace(/\*\*/g, "");
  razgovor.appendChild(el);
  el.scrollIntoView({ behavior: "smooth", block: "end" });
  return el;
}

function postaviStatus(tekst: string, greska = false) {
  status.textContent = tekst;
  status.classList.toggle("greska", greska);
}

function zauzeto(da: boolean) {
  dugme.disabled = da;
  unos.disabled = da;
}

// ─── Razgovor ───────────────────────────────────────────────────────────────

async function pitajModel(v: Verzija): Promise<OdgovorChata> {
  const ponudjeni = alatiZaVerziju(alati as McpAlat[], v).map(uChatAlat);
  const odgovor = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      verzija: v,
      poruke,
      alati: ponudjeni,
      kontekst: kontekstEkrana ?? undefined,
      a2uiPodaci: v === "B" && (procitajA2ui() !== null || procitajBazu() !== null),
      a2uiDelovi: v === "B" ? deloviB() : undefined,
    }),
  });
  const telo = (await odgovor.json()) as Partial<OdgovorChata> & { greska?: string };
  if (!odgovor.ok || !telo.poruka) throw new Error(telo.greska ?? "AI trenutno nije dostupan.");
  return { poruka: telo.poruka, a2ui: telo.a2ui };
}

// ─── Verzija B: izvorni A2UI ────────────────────────────────────────────────

/** Podaci i rezervni raspored iz poslednjeg poziva alata verzije B u ovom pitanju. */
type PodaciB = { izAlata: A2uiIzAlata; argumenti: Record<string, unknown> };
let poslednjiA2ui: PodaciB | null = null;
const procitajA2ui = (): PodaciB | null => poslednjiA2ui;

/**
 * Podaci iz baze za ekran verzije B (vreme, voda, senzori, vazduh bez saveta) – MCP alat get_dashboard
 * vraća ih kao gotov data model (`a2ui.podaci`). Uzimaju se jednom po pitanju, kad AI pozove alat sa podacima.
 */
type PodaciBaze = { podaci: Record<string, unknown>; delovi: string[] };
let podaciBaze: PodaciBaze | null = null;
const procitajBazu = (): PodaciBaze | null => podaciBaze;

async function ucitajPodatkeBaze(): Promise<PodaciBaze | null> {
  if (!klijent || !alati.some((a) => a.name === "get_dashboard")) return null;
  try {
    const r = (await klijent.callTool({ name: "get_dashboard", arguments: {} })) as CallToolResult;
    const a2ui = (r.structuredContent as { a2ui?: { podaci?: unknown; delovi?: unknown } } | undefined)?.a2ui;
    if (r.isError || !a2ui || typeof a2ui.podaci !== "object" || a2ui.podaci === null || !Array.isArray(a2ui.delovi)) return null;
    return { podaci: a2ui.podaci as Record<string, unknown>, delovi: a2ui.delovi.filter((d): d is string => typeof d === "string") };
  } catch {
    return null;
  }
}

/** Delovi data modela koje AI sme da prikaže (savet samo ako ga je procena vratila). */
function deloviB(): string[] {
  const delovi = new Set(procitajBazu()?.delovi ?? []);
  const zaB = procitajA2ui();
  if (zaB) delovi.add("vazduh");
  if (typeof zaB?.izAlata.podaci.savet === "string" && zaB.izAlata.podaci.savet) delovi.add("savet");
  return [...delovi];
}

function stanicaIzAkcije(akcija: ActionPayload | null, podrazumevana: unknown): string | undefined {
  const izbor = akcija?.context.izbor;
  const prvi = Array.isArray(izbor) ? izbor[0] : izbor;
  if (typeof prvi === "string" && prvi) return prvi;
  return typeof podrazumevana === "string" ? podrazumevana : undefined;
}

/**
 * Crta ekran verzije B u razgovoru. Raspored: od AI-ja, ili rezervni ekran procene vazduha.
 * Podaci: iz MCP alata – podaci iz baze (get_dashboard) + procena vazduha sa savetom (ako je pozvana).
 */
function prikaziVerzijuB(zaB: PodaciB | null, baza: PodaciBaze | null, aiKomponente: Komponenta[] | null) {
  const izAlata: A2uiIzAlata | null = zaB?.izAlata ?? null;
  const argumenti = zaB?.argumenti ?? {};
  // Za stale / no_data / error procene vazduha uvek fiksni ekran sa porukom (FR-09).
  const procenaNijeOk = izAlata !== null && izAlata.status !== "ok";
  const koristiAi = !procenaNijeOk && aiKomponente !== null;
  // Bez AI ekrana i bez procene vazduha (npr. pitanje o vremenu) – samo tekst odgovora.
  if (!koristiAi && !izAlata) return;
  const spoji = (vazduh: Record<string, unknown> | undefined, iz: PodaciBaze | null) => ({ ...(iz?.podaci ?? {}), ...(vazduh ?? {}) });
  const podaci = spoji(izAlata?.podaci, baza);

  const blok = dodaj("ekran-blok");
  const oznaka = document.createElement("div");
  oznaka.className = "oznaka oznaka-b";
  oznaka.textContent = `${OPIS_VERZIJE.B} · ${koristiAi ? "ekran složio AI" : "standardni ekran"}`;
  blok.appendChild(oznaka);
  const povrsina = document.createElement("div");
  povrsina.className = "a2ui-povrsina";
  blok.appendChild(povrsina);

  // „Osveži“: ponovo isti alati (bez LLM-a), isti raspored, novi podaci.
  const osvezi = async (akcija: ActionPayload | null) => {
    if (!klijent) return;
    let vazduh: Record<string, unknown> | undefined;
    if (izAlata) {
      const stationId = stanicaIzAkcije(akcija, argumenti.stationId);
      const r = (await klijent.callTool({ name: ALAT_PROCENE.B, arguments: stationId ? { stationId } : {} })) as CallToolResult;
      vazduh = a2uiIzRezultata(r)?.podaci;
    }
    const novaBaza = baza ? await ucitajPodatkeBaze() : null;
    ekran.azurirajPodatke(spoji(vazduh ?? izAlata?.podaci, novaBaza ?? baza));
  };
  const komponente = koristiAi ? (aiKomponente as Komponenta[]) : (izAlata as A2uiIzAlata).komponente;
  const ekran = prikaziA2ui(povrsina, komponente, podaci, (a) => osvezi(a));

  // AI raspored nema svoje dugme – „Osveži“ je deo chata, van A2UI ekrana (FR-15).
  if (koristiAi) {
    const dugmeOsvezi = Object.assign(document.createElement("button"), { type: "button", className: "osvezi", textContent: "Osveži" });
    dugmeOsvezi.addEventListener("click", () => {
      dugmeOsvezi.disabled = true;
      void osvezi(null).finally(() => (dugmeOsvezi.disabled = false));
    });
    blok.appendChild(dugmeOsvezi);
  }
}

/** Rezultati alata u okviru jednog pitanja – isti poziv dvaput ne pravi drugi ekran. */
let pozivi = new Map<string, Promise<string>>();

function pozoviAlat(ime: string, argumenti: Record<string, unknown>, v: Verzija): Promise<string> {
  const kljuc = `${ime}|${JSON.stringify(argumenti)}`;
  const prethodni = pozivi.get(kljuc);
  if (prethodni) return prethodni;
  const novi = pozoviAlatPrviPut(ime, argumenti, v);
  pozivi.set(kljuc, novi);
  return novi;
}

async function pozoviAlatPrviPut(ime: string, argumenti: Record<string, unknown>, v: Verzija): Promise<string> {
  if (!klijent) throw new Error("Nema veze sa MCP serverom.");
  const alat = alati.find((a) => a.name === ime);
  if (!alat) return `Alat ${ime} ne postoji.`;

  const rezultat = klijent.callTool({ name: ime, arguments: argumenti }) as Promise<CallToolResult>;
  const gotov = await rezultat;

  // Verzija B: bez iframe-a – pamte se podaci (i rezervni raspored procene); ekran se crta uz odgovor AI-ja.
  if (v === "B" && ALATI_ZA_EKRAN_B.includes(ime)) {
    if (ime === ALAT_PROCENE.B) {
      const izAlata = jeGreskaProcene(gotov) ? null : a2uiIzRezultata(gotov);
      if (izAlata) poslednjiA2ui = { izAlata, argumenti };
    }
    // Za vreme, vodu i mapu AI-ju trebaju svi podaci iz baze – jednom po pitanju.
    if (!gotov.isError && procitajBazu() === null) podaciBaze = await ucitajPodatkeBaze();
    return tekstZaModel(gotov);
  }

  // Ekran tek kad stigne rezultat, i samo ako nije greška (npr. pogrešan id stanice) –
  // tada model pokuša ponovo, a u razgovoru ne ostaje prazan ekran. Stale / no_data se prikazuju.
  if (imaEkran(alat) && !jeGreskaProcene(gotov)) {
    const blok = dodaj("ekran-blok");
    const oznaka = document.createElement("div");
    oznaka.className = `oznaka oznaka-${v.toLowerCase()}`;
    oznaka.textContent = OPIS_VERZIJE[v];
    blok.appendChild(oznaka);
    prikaziEkran({
      klijent,
      alat,
      argumenti,
      rezultat,
      sandboxUrl,
      kontejner: blok,
      naKontekst: (t) => {
        kontekstEkrana = t;
      },
    }).catch((e: unknown) => {
      blok.appendChild(Object.assign(document.createElement("p"), { className: "greska", textContent: `Ekran nije mogao da se prikaže: ${e instanceof Error ? e.message : ""}` }));
    });
  }

  return tekstZaModel(gotov);
}

async function posalji(tekst: string) {
  const v = verzija();
  pozivi = new Map();
  poslednjiA2ui = null;
  podaciBaze = null;
  dodaj("korisnik", tekst);
  poruke.push({ role: "user", content: tekst });
  zauzeto(true);
  const kuca = dodaj("asistent kuca", "…");

  try {
    for (let korak = 0; korak < MAX_KORAKA; korak++) {
      const { poruka: odgovor, a2ui } = await pitajModel(v);
      poruke.push({ role: "assistant", content: odgovor.content ?? null, tool_calls: odgovor.tool_calls });

      if (!odgovor.tool_calls?.length) {
        kuca.remove();
        // poslednjiA2ui postavlja pozoviAlatPrviPut (TypeScript to ne vidi kroz await), zato čitanje preko funkcije.
        const zaB = procitajA2ui();
        const baza = procitajBazu();
        if (v === "B" && (zaB || baza)) {
          if (a2ui?.razlog) console.info("[chat] A2UI bez AI ekrana:", a2ui.razlog);
          prikaziVerzijuB(zaB, baza, a2ui?.komponente ?? null);
        }
        dodaj("asistent", odgovor.content || "…");
        return;
      }
      for (const poziv of odgovor.tool_calls) {
        postaviStatus(`AI poziva alat ${poziv.function.name}…`);
        const sadrzaj = await pozoviAlat(poziv.function.name, argumentiPoziva(poziv.function.arguments), v);
        poruke.push({ role: "tool", tool_call_id: poziv.id, content: sadrzaj });
      }
      razgovor.appendChild(kuca); // „kucanje“ ostaje ispod ekrana dok AI ne odgovori
    }
    kuca.remove();
    dodaj("asistent", "Nisam uspeo da završim odgovor. Pokušajte ponovo.");
  } catch (e) {
    kuca.remove();
    dodaj("asistent greska", e instanceof Error ? e.message : "Došlo je do greške. Pokušajte ponovo.");
  } finally {
    postaviStatus(klijent ? "Povezano" : "");
    zauzeto(false);
    if (!panelChata.hidden) unos.focus();
  }
}

forma.addEventListener("submit", (e) => {
  e.preventDefault();
  const tekst = unos.value.trim();
  if (!tekst || dugme.disabled) return;
  unos.value = "";
  void posalji(tekst);
});

predlozi.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest("button");
  if (t?.textContent && !dugme.disabled) void posalji(t.textContent.trim());
});

// ─── Povezivanje ────────────────────────────────────────────────────────────

async function povezi() {
  zauzeto(true);
  try {
    const konf = (await (await fetch("/api/konfiguracija")).json()) as { mcpUrl: string; sandboxUrl: string; model: string };
    sandboxUrl = konf.sandboxUrl;
    const mcpUrl = parametri.get("mcp") || konf.mcpUrl;
    klijent = new Client({ name: "Smart City chat", version: "1.0.0" });
    await klijent.connect(new StreamableHTTPClientTransport(new URL(mcpUrl)));
    alati = (await klijent.listTools()).tools;
    pokreniKontrolnuTablu(klijent);
    postaviStatus(`Povezano · ${new URL(mcpUrl).host} · ${konf.model}`);
    zauzeto(false);
    if (!panelChata.hidden) unos.focus();
  } catch {
    postaviStatus("Nema veze sa MCP serverom. Pokrenite „npm start“ i osvežite stranicu.", true);
  }
}

/** Kontrolna tabla levo od chata: isti MCP klijent, alat get_dashboard; osvežava se na 5 min. */
function pokreniKontrolnuTablu(k: Client) {
  const koren = document.getElementById("tabla");
  if (!koren) return;
  const tabla = pokreniTablu(koren, async (ime, argumenti) => (await k.callTool({ name: ime, arguments: argumenti })) as CallToolResult);
  void tabla.osvezi();
  setInterval(() => void tabla.osvezi(), 5 * 60_000);
}

void povezi();
