/**
 * Chat stranica: korisnik pita, Groq (preko chat servera) bira alat, alat se poziva na
 * MCP serveru, a ekran A ili B se prikazuje u razgovoru. Prekidač A/B bira verziju ekrana –
 * podaci, kategorija i savet su isti (isti MCP server, K1–K3).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import {
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
import { imaEkran, prikaziEkran } from "./ekran.js";

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

// ─── Verzija A/B ────────────────────────────────────────────────────────────

function verzija(): Verzija {
  const izabrana = document.querySelector<HTMLInputElement>('input[name="verzija"]:checked');
  return izabrana?.value === "B" ? "B" : "A";
}

if (parametri.get("verzija") === "B") {
  (document.getElementById("verzija-b") as HTMLInputElement).checked = true;
}

// Promena verzije počinje novi razgovor, da bi se na prezentaciji za svaku verziju videlo
// pitanje → poziv alata → ekran → odgovor.
document.querySelectorAll<HTMLInputElement>('input[name="verzija"]').forEach((r) =>
  r.addEventListener("change", () => {
    poruke.length = 0;
    kontekstEkrana = null;
    if (razgovor.childElementCount > 0) dodaj("razdelnik", `Prebačeno na ${OPIS_VERZIJE[verzija()]} – novi razgovor`);
  }),
);

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

async function pitajModel(v: Verzija): Promise<ChatPoruka> {
  const ponudjeni = alatiZaVerziju(alati as McpAlat[], v).map(uChatAlat);
  const odgovor = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ verzija: v, poruke, alati: ponudjeni, kontekst: kontekstEkrana ?? undefined }),
  });
  const telo = (await odgovor.json()) as { poruka?: ChatPoruka; greska?: string };
  if (!odgovor.ok || !telo.poruka) throw new Error(telo.greska ?? "AI trenutno nije dostupan.");
  return telo.poruka;
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
  dodaj("korisnik", tekst);
  poruke.push({ role: "user", content: tekst });
  zauzeto(true);
  const kuca = dodaj("asistent kuca", "…");

  try {
    for (let korak = 0; korak < MAX_KORAKA; korak++) {
      const odgovor = await pitajModel(v);
      poruke.push({ role: "assistant", content: odgovor.content ?? null, tool_calls: odgovor.tool_calls });

      if (!odgovor.tool_calls?.length) {
        kuca.remove();
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
    unos.focus();
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
    postaviStatus(`Povezano · ${new URL(mcpUrl).host} · ${konf.model}`);
    zauzeto(false);
    unos.focus();
  } catch {
    postaviStatus("Nema veze sa MCP serverom. Pokrenite „npm start“ i osvežite stranicu.", true);
  }
}

void povezi();
