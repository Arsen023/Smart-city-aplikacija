/**
 * Verzija B (A2UI) preko CopilotKit-a: CopilotKit runtime u chat serveru (`/api/copilotkit`).
 *
 * Agent `a2ui` poziva MCP alate sa podacima, pa slaže A2UI ekran preko našeg alata prikazi_ekran;
 * podatke u ekran dodaje server. Koristi isti MCP server (K1–K3) i Groq (OpenAI-kompatibilan API).
 * Chat ne računa ništa: kategoriju računa src/core/pravila na MCP serveru (pravila 1 i 7). Ključ samo iz .env.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { BuiltInAgent, CopilotRuntime, defineTool, InMemoryAgentRunner } from "@copilotkit/runtime/v2";
import { createCopilotExpressHandler } from "@copilotkit/runtime/v2/express";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { ALAT_PROCENE } from "./alati.js";
import { ALAT_EKRANA, opisAlataEkrana, podaciProcene, podaciTable, sastaviEkran, tekstAlata } from "./copilotkit-ekran.js";

export const AGENTI = ["a2ui"] as const;
export type AgentCopilot = (typeof AGENTI)[number];

const PROMPT: Record<AgentCopilot, string> = {
  a2ui: [
    "Ti si asistent za kvalitet vazduha, vreme i kvalitet vode u Novom Sadu. Odgovaraš na srpskom, latinicom, sa „vi“, kratko (1–2 rečenice).",
    `Na svako pitanje o vazduhu, šetnji, treningu, vremenu, vodi ili senzorima pozovi ${ALAT_EKRANA} JEDNOM, sa rasporedom`,
    "prilagođenim pitanju. Za vazduh, šetnju ili trening postavi vazduhSaSavetom na true. Podatke ne tražiš drugim alatima –",
    "server ih sam dodaje u ekran i vraća ti sažetak.",
    "Odgovor piši samo iz tog sažetka: kategoriju vazduha nikad ne računaš sam i ne izmišljaš brojeve.",
    "Ako sažetak kaže da nema preporuke (zastareli podaci, nema podataka, greška), prenesi tu poruku i ne daj savet.",
    "Ne daješ medicinske savete. Za pitanja van ove teme ljubazno reci da pomažeš samo oko vazduha, vremena i vode.",
  ].join("\n"),
};

type Okruzenje = Readonly<Record<string, string | undefined>>;

/** Alati koje model sme da vidi (manje alata = manji zahtev, Groq limit 8000 tokena/min). */
export const ALATI_NACINA: Record<AgentCopilot, readonly string[]> = {
  a2ui: [ALAT_EKRANA],
};

/** Početak konteksta koji CopilotKit dodaje u sistemsku poruku (šema A2UI kataloga). */
export const KONTEKST_APLIKACIJE = "## Context from the application";

/** Koliko poslednjih pitanja (sa odgovorima) AI vidi u istoriji razgovora. */
export const MAX_PITANJA_U_ISTORIJI = 3;

/** Najviše znakova rezultata nekog drugog alata koje AI vidi. */
const MAX_REZULTAT_ALATA = 1500;

/** Ono što AI vidi umesto rezultata alata: za A2UI ekran samo `sazetak`, za ostale skraćen tekst. */
export function rezultatZaModel(sadrzaj: string): string {
  if (sadrzaj.includes('"a2ui_operations"')) {
    try {
      const o = JSON.parse(sadrzaj) as { sazetak?: unknown };
      if (typeof o.sazetak === "string") return o.sazetak;
    } catch {
      // nije JSON – skraćuje se ispod
    }
    return "Ekran je prikazan korisniku.";
  }
  return sadrzaj.length > MAX_REZULTAT_ALATA ? `${sadrzaj.slice(0, MAX_REZULTAT_ALATA)}…` : sadrzaj;
}

/**
 * Prilagođava zahtev Groq-u (besplatni limit je 8000 tokena/min, a CopilotKit šalje mnogo):
 * - uklanja `reasoning_content` iz prethodnih poruka – Groq ga ne prima nazad (greška 400);
 * - iz sistemske poruke izbacuje šemu A2UI kataloga (~50 000 znakova) – AI je dobija u opisu alata;
 * - rezultat alata prikazi_ekran (ceo data model ekrana) zamenjuje kratkim sažetkom;
 * - ostavlja samo dozvoljene alate (alat sa MCP servera može imati prefiks, npr. `mcp1_x`);
 * - gpt-oss modelima smanjuje „razmišljanje“ (manje tokena i brži odgovor).
 */
export function prilagodiZahtev(telo: unknown, dozvoljeni: readonly string[]): unknown {
  if (!telo || typeof telo !== "object") return telo;
  const z = { ...(telo as Record<string, unknown>) };
  if (Array.isArray(z.messages)) {
    z.messages = z.messages.map((m) => {
      if (!m || typeof m !== "object") return m;
      const { reasoning_content: _r, ...ostalo } = m as Record<string, unknown>;
      void _r;
      if (ostalo.role === "system" && typeof ostalo.content === "string") {
        const i = ostalo.content.indexOf(KONTEKST_APLIKACIJE);
        if (i >= 0) ostalo.content = ostalo.content.slice(0, i).trimEnd();
      }
      if (ostalo.role === "tool" && typeof ostalo.content === "string") ostalo.content = rezultatZaModel(ostalo.content);
      return ostalo;
    });
  }
  // Samo poslednjih nekoliko pitanja: istorija bi inače rasla dok ne probije limit od 8000 tokena/min.
  // Seče se uvek na poruci korisnika, da poziv alata i njegov rezultat ostanu zajedno.
  if (Array.isArray(z.messages)) {
    const sistem = z.messages.filter((m) => (m as { role?: unknown })?.role === "system");
    const ostale = z.messages.filter((m) => (m as { role?: unknown })?.role !== "system");
    const pitanja = ostale.map((m, i) => ((m as { role?: unknown })?.role === "user" ? i : -1)).filter((i) => i >= 0);
    if (pitanja.length > MAX_PITANJA_U_ISTORIJI) {
      z.messages = [...sistem, ...ostale.slice(pitanja[pitanja.length - MAX_PITANJA_U_ISTORIJI])];
    }
  }
  // Stari rasporedi ekrana (argumenti ranijih poziva alata) AI-ju više ne trebaju – istorija ne raste
  // sa svakim pitanjem. Ostaje samo poslednji poziv (može da treba za ispravku rasporeda).
  if (Array.isArray(z.messages)) {
    const poslednji = z.messages.map((m) => Array.isArray((m as { tool_calls?: unknown })?.tool_calls)).lastIndexOf(true);
    z.messages = z.messages.map((m, i) => {
      const pozivi = (m as { tool_calls?: unknown })?.tool_calls;
      if (i === poslednji || !Array.isArray(pozivi)) return m;
      return {
        ...(m as Record<string, unknown>),
        tool_calls: pozivi.map((t: { function?: Record<string, unknown> }) => ({
          ...t,
          function: { ...t.function, arguments: "{}" },
        })),
      };
    });
  }
  if (typeof z.model === "string" && z.model.startsWith("openai/gpt-oss") && z.reasoning_effort === undefined) {
    z.reasoning_effort = "low";
  }
  if (Array.isArray(z.tools)) {
    z.tools = z.tools.filter((t) => {
      const ime = (t as { function?: { name?: unknown } })?.function?.name;
      return typeof ime === "string" && dozvoljeni.some((d) => ime === d || ime.endsWith(`_${d}`));
    });
    if ((z.tools as unknown[]).length === 0) {
      delete z.tools;
      delete z.tool_choice;
    }
  }
  return z;
}

/** fetch za Groq koji pre slanja prilagodi telo zahteva (vidi prilagodiZahtev). */
function fetchZaNacin(dozvoljeni: readonly string[]): typeof fetch {
  return async (ulaz, init) => {
    let telo: Record<string, unknown> | null = null;
    if (init?.body && typeof init.body === "string") {
      try {
        telo = prilagodiZahtev(JSON.parse(init.body), dozvoljeni) as Record<string, unknown>;
        const body = JSON.stringify(telo);
        if (process.env.COPILOTKIT_DEBUG) console.log(`[copilotkit] zahtev ka Groq-u: ${init.body.length} → ${body.length} znakova`);
        init = { ...init, body };
      } catch {
        telo = null; // telo nije JSON – šalje se nepromenjeno
      }
    }
    const odgovor = await fetch(ulaz, init);
    // Model povremeno napiše neispravan JSON za argumente alata (Groq: tool_use_failed, 400).
    // Jedan ponovni pokušaj, sa nižom temperaturom, skoro uvek uspe.
    if (odgovor.status === 400 && telo && (await odgovor.clone().text()).includes("tool_use_failed")) {
      console.info("[copilotkit] Groq tool_use_failed – ponovni pokušaj");
      return fetch(ulaz, { ...init, body: JSON.stringify({ ...telo, temperature: 0.2 }) });
    }
    return odgovor;
  };
}

/** Jedan poziv MCP alata sa servera (za prikazi_ekran). Greška → null, ekran tada kaže da podaci nisu dostupni. */
async function pozoviMcp(mcpUrl: string, ime: string, argumenti: Record<string, unknown>): Promise<unknown> {
  const klijent = new Client({ name: "Smart City CopilotKit", version: "1.0.0" });
  try {
    await klijent.connect(new StreamableHTTPClientTransport(new URL(mcpUrl)));
    return await klijent.callTool({ name: ime, arguments: argumenti });
  } catch (e) {
    console.error(`[copilotkit] MCP ${ime}: ${e instanceof Error ? e.message : "greška"}`);
    return null;
  } finally {
    await klijent.close().catch(() => {});
  }
}

let brojEkrana = 0;

/** Naš A2UI alat: AI šalje raspored, server dodaje podatke iz MCP-a i proverava raspored. */
function alatEkrana(mcpUrl: string) {
  return defineTool({
    name: ALAT_EKRANA,
    description: opisAlataEkrana(),
    parameters: z.object({
      komponente: z
        .array(z.object({ id: z.string(), component: z.string() }).passthrough())
        .min(1)
        .max(60)
        .describe("Raspored ekrana: A2UI komponente, koren ima id \"root\"."),
      // nullable: model često pošalje null za polje koje ne koristi, a Groq strogo proverava šemu
      vazduhSaSavetom: z.boolean().nullable().optional().describe("true ako ekran prikazuje savet za šetnju/trening (/savet, /osnov)."),
      stationId: z.string().nullable().optional().describe("Stanica za procenu vazduha (id iz get_stations), ako je poznata."),
    }),
    execute: async ({ komponente, vazduhSaSavetom, stationId }) => {
      const [tabla, procena] = await Promise.all([
        pozoviMcp(mcpUrl, "get_dashboard", {}),
        vazduhSaSavetom ? pozoviMcp(mcpUrl, ALAT_PROCENE.B, stationId ? { stationId } : {}) : Promise.resolve(null),
      ]);
      // Sažetak za AI: tekst procene (kategorija, vrednosti, savet) i tekst table (vreme, voda, senzori).
      const sazetak = [tekstAlata(procena), tekstAlata(tabla)].filter(Boolean).join(" ");
      const ishod = sastaviEkran(
        komponente,
        { tabla: podaciTable(tabla), procena: podaciProcene(procena), sazetak },
        `copilot-${++brojEkrana}`,
      );
      if (!ishod.ok) {
        console.info(`[copilotkit] ${ALAT_EKRANA} odbijen: ${ishod.greska}`);
        return ishod.greska;
      }
      console.log(`[copilotkit] ${ALAT_EKRANA}: ekran od ${komponente.length} komponenti${ishod.razlog ? ` (${ishod.razlog})` : ""}`);
      return ishod.rezultat;
    },
  });
}

/** Express ruter sa CopilotKit runtime-om, ili null kad nema Groq ključa (chat verzije A radi i bez toga). */
export function copilotKitRuter(mcpUrl: string, env: Okruzenje = process.env) {
  const kljuc = env.GROQ_API_KEY;
  if (!kljuc) return null;
  // Bez slanja telemetrije CopilotKit-u (podrazumevano je uključena).
  process.env.COPILOTKIT_TELEMETRY_DISABLED ??= "true";
  const model = env.GROQ_COPILOT_MODEL || "openai/gpt-oss-120b";

  const agent = (ime: AgentCopilot, dodatno: Partial<ConstructorParameters<typeof BuiltInAgent>[0]> = {}) => {
    const groq = createOpenAICompatible({
      name: "groq",
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: kljuc,
      fetch: fetchZaNacin(ALATI_NACINA[ime]),
    });
    return new BuiltInAgent({
      model: groq.chatModel(model),
      prompt: PROMPT[ime],
      // malo viša temperatura: raspored prati pitanje i ne izgleda uvek isto (provere ostaju iste)
      temperature: 0.5,
      // pitanje → prikazi_ekran → odgovor (i jedna ispravka rasporeda, ako zatreba)
      maxSteps: 4,
      // Groq računa i traženi broj izlaznih tokena u limit od 8000/min
      maxOutputTokens: 1500,
      // 429 (limit u minuti) se ponavlja posle pauze koju Groq traži
      maxRetries: 3,
      ...dodatno,
    } as ConstructorParameters<typeof BuiltInAgent>[0]);
  };

  const runtime = new CopilotRuntime({
    // Bez mcpServers: AI ne zove MCP alate direktno – prikazi_ekran sam uzima podatke sa MCP servera,
    // pa je po pitanju potrebno samo 2 zahteva ka Groq-u umesto 3–4.
    agents: { a2ui: agent("a2ui", { tools: [alatEkrana(mcpUrl)] }) },
    runner: new InMemoryAgentRunner(),
    // A2UI: crta { a2ui_operations } iz našeg alata; ugrađeni alat koji bi AI pustio da upisuje podatke je isključen.
    a2ui: { injectA2UITool: false, agents: ["a2ui"] },
  });

  return createCopilotExpressHandler({ runtime, basePath: "/api/copilotkit", cors: false });
}
