/**
 * Chat aplikacija – server (naš MCP host).
 *
 *   http://localhost:3010  chat stranica + POST /api/chat (Groq; ključ ostaje ovde, NFR-04)
 *   http://localhost:3011  sandbox stranica za ekran A/B (drugi origin + CSP, kako MCP Apps traži)
 *
 * Alate poziva sama chat stranica preko MCP klijenta (http://localhost:3001/mcp),
 * isto kao basic-host. Ovaj server samo prosleđuje razgovor Groq-u.
 *
 * Pokretanje: npm run build, npm start (MCP server), pa npm run chat.
 */
import express, { type Request, type Response } from "express";
import path from "node:path";
import { z } from "zod";
import { obradiOdgovor, napraviProcesor } from "./a2ui-agent.js";
import { sazmiZaA2ui, sistemskaPoruka, trebaA2uiUputstvo } from "./alati.js";

/** A2UI procesor (zvanični SDK) – pravi se jednom, katalog se ne menja. */
let a2uiProcesor: ReturnType<typeof napraviProcesor> | undefined;
const dobijA2ui = () => (a2uiProcesor ??= napraviProcesor());

try {
  process.loadEnvFile();
} catch (e) {
  const kod = (e as NodeJS.ErrnoException).code;
  if (kod !== "ENOENT") console.error(".env nije učitan:", e instanceof Error ? e.message : e);
}

const CHAT_PORT = Number.parseInt(process.env.CHAT_PORT ?? "3010", 10);
const SANDBOX_PORT = Number.parseInt(process.env.CHAT_SANDBOX_PORT ?? String(CHAT_PORT + 1), 10);
const MCP_URL = process.env.CHAT_MCP_URL || "http://localhost:3001/mcp";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_CHAT_MODEL || process.env.GROQ_MODEL || "openai/gpt-oss-120b";
/**
 * Model za korak u kome AI sastavlja A2UI ekran (verzija B). Poseban model ima poseban Groq limit
 * (besplatni nivo: 8000 tokena/min po modelu), pa se ne troši limit chat modela i K3 saveta.
 */
const A2UI_MODEL = process.env.GROQ_A2UI_MODEL || "openai/gpt-oss-120b";
const TIMEOUT_MS = 20_000;

const DIST = path.join(import.meta.dirname, "..", "..", "dist");

// ─── Ulaz /api/chat (Zod) ───────────────────────────────────────────────────

const PozivSema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({ name: z.string(), arguments: z.string() }),
});

const PorukaSema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string().nullable(),
  tool_calls: z.array(PozivSema).optional(),
  tool_call_id: z.string().optional(),
});

const ZahtevSema = z.object({
  verzija: z.enum(["A", "B"]),
  poruke: z.array(PorukaSema).min(1).max(60),
  alati: z
    .array(
      z.object({
        type: z.literal("function"),
        function: z.object({ name: z.string(), description: z.string(), parameters: z.record(z.string(), z.unknown()) }),
      }),
    )
    .max(10),
  /** Šta korisnik trenutno gleda na ekranu (ui/update-model-context), ako postoji. */
  kontekst: z.string().max(4000).optional(),
  /** Verzija B: chat stranica ima ispravne A2UI podatke iz alata (procena nije greška). */
  a2uiPodaci: z.boolean().optional(),
});

const OdgovorGroqSema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          tool_calls: z.array(PozivSema).optional(),
        }),
      }),
    )
    .min(1),
});

// ─── Chat server ────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/konfiguracija", (_req: Request, res: Response) => {
  res.json({ mcpUrl: MCP_URL, sandboxUrl: `http://localhost:${SANDBOX_PORT}/`, model: MODEL });
});

app.post("/api/chat", async (req: Request, res: Response) => {
  const ulaz = ZahtevSema.safeParse(req.body);
  if (!ulaz.success) {
    res.status(400).json({ greska: "Neispravan zahtev." });
    return;
  }
  const kljuc = process.env.GROQ_API_KEY;
  if (!kljuc) {
    res.status(500).json({ greska: "GROQ_API_KEY nije postavljen u .env." });
    return;
  }

  const { verzija, poruke, alati, kontekst, a2uiPodaci } = ulaz.data;
  const sistem = [{ role: "system" as const, content: sistemskaPoruka(verzija) }];
  if (kontekst) sistem.push({ role: "system", content: `Šta korisnik trenutno gleda na ekranu: ${kontekst}` });
  // Samo kad je procena uspela – posle greške (npr. pogrešan id stanice) model normalno pokuša ponovo.
  const sastaviEkran = a2uiPodaci === true && trebaA2uiUputstvo(verzija, poruke);
  if (sastaviEkran) {
    sistem.push({
      role: "system",
      content:
        "Sada odgovori: najviše 2 rečenice teksta, pa ekran u JEDNOM <a2ui> bloku po pravilima ispod. " +
        "Podatke ne upisuj – samo ih veži preko putanja.\n\n" +
        dobijA2ui().promptSnippet,
    });
  }

  // Korak sa A2UI ekranom: sažet razgovor (pitanje + rezultat procene), bez alata – vidi sazmiZaA2ui.
  const telo = JSON.stringify(
    sastaviEkran
      ? { model: A2UI_MODEL, messages: [...sistem, ...sazmiZaA2ui(poruke)], temperature: 0.2, max_tokens: 1500 }
      : { model: MODEL, messages: [...sistem, ...poruke], tools: alati, tool_choice: "auto", temperature: 0.2, max_tokens: 1024 },
  );

  const pocetak = Date.now();
  try {
    // Ponovni pokušaj (najviše jednom):
    // - 400 tool_use_failed: model je pogrešno sročio poziv alata;
    // - 429 rate_limit_exceeded: besplatni Groq nivo – sačekaj koliko Groq kaže (najviše 4 s).
    let odgovor: globalThis.Response | undefined;
    for (let pokusaj = 1; pokusaj <= 2; pokusaj++) {
      odgovor = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${kljuc}`, "Content-Type": "application/json" },
        body: telo,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (odgovor.ok) break;
      const kod = await odgovor
        .clone()
        .json()
        .then((t: { error?: { code?: string } }) => t.error?.code)
        .catch(() => undefined);
      console.error(`[chat] Groq HTTP ${odgovor.status}${kod ? ` (${kod})` : ""} posle ${Date.now() - pocetak} ms, pokušaj ${pokusaj}`);
      if (odgovor.status === 429 && pokusaj === 1) {
        const sekundi = Number.parseFloat(odgovor.headers.get("retry-after") ?? "2");
        await new Promise((r) => setTimeout(r, Math.min(Number.isFinite(sekundi) ? sekundi : 2, 4) * 1000));
        continue;
      }
      if (kod !== "tool_use_failed") break;
    }
    if (!odgovor?.ok) {
      res.status(502).json({ greska: "AI trenutno nije dostupan. Pokušajte ponovo." });
      return;
    }
    const poruka = OdgovorGroqSema.parse(await odgovor.json()).choices[0].message;
    console.log(`[chat] ${sastaviEkran ? A2UI_MODEL : MODEL}, ${Date.now() - pocetak} ms, ${poruka.tool_calls?.length ? `alati: ${poruka.tool_calls.map((p) => p.function.name).join(", ")}` : "odgovor"}`);
    // Verzija B: tekst + A2UI ekran iz istog odgovora (SDK + naše provere).
    if (sastaviEkran && !poruka.tool_calls?.length && poruka.content) {
      let o = obradiOdgovor(dobijA2ui(), poruka.content);
      // Jedan pokušaj ispravke: AI dobija razlog odbijanja (kako preporučuje A2UI dokumentacija).
      if (!o.komponente && o.razlog && !o.razlog.startsWith("AI nije poslao")) {
        console.log(`[chat] A2UI odbijen (${o.razlog}), traži se ispravka`);
        const ispravka = await ispraviA2ui(JSON.parse(telo) as Record<string, unknown>, poruka.content, o.razlog, kljuc);
        if (ispravka) {
          const o2 = obradiOdgovor(dobijA2ui(), ispravka);
          if (o2.komponente) o = { ...o2, tekst: o2.tekst || o.tekst };
        }
      }
      console.log(`[chat] A2UI: ${o.komponente ? `ekran od ${o.komponente.length} komponenti` : `rezervni ekran (${o.razlog})`}`);
      res.json({ poruka: { role: "assistant", content: o.tekst || null }, a2ui: { komponente: o.komponente, razlog: o.razlog } });
      return;
    }
    res.json({ poruka: { role: "assistant", content: poruka.content ?? null, tool_calls: poruka.tool_calls } });
  } catch (e) {
    console.error(`[chat] greška posle ${Date.now() - pocetak} ms: ${e instanceof Error ? e.message : "nepoznata"}`);
    res.status(502).json({ greska: "AI trenutno nije dostupan. Pokušajte ponovo." });
  }
});

/** Jedan dodatni poziv: isti zahtev + neispravan odgovor + razlog → ispravljen odgovor (ili null). */
async function ispraviA2ui(zahtev: Record<string, unknown>, prethodni: string, razlog: string, kljuc: string): Promise<string | null> {
  const poruke = [
    ...(zahtev.messages as unknown[]),
    { role: "assistant", content: prethodni },
    {
      role: "user",
      content:
        `Ekran nije prošao proveru: ${razlog}. Pošalji ponovo kratak tekst i ispravljen <a2ui> blok. ` +
        "Stringove piši u dvostrukim navodnicima, koristi samo komponente iz kataloga i samo navedene putanje, bez upisivanja podataka.",
    },
  ];
  try {
    const r = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${kljuc}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...zahtev, messages: poruke }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok) {
      console.error(`[chat] ispravka A2UI: Groq HTTP ${r.status}`);
      return null;
    }
    return OdgovorGroqSema.parse(await r.json()).choices[0].message.content ?? null;
  } catch {
    return null;
  }
}

app.use(express.static(path.join(DIST, "chat")));

app.listen(CHAT_PORT, () => {
  console.log(`Chat aplikacija: http://localhost:${CHAT_PORT}  (MCP server: ${MCP_URL}, model: ${MODEL})`);
});

// ─── Sandbox server (drugi origin, CSP preko HTTP zaglavlja) ────────────────
// Prilagođeno iz ext-apps/examples/basic-host/serve.ts.

interface Csp {
  connectDomains?: string[];
  resourceDomains?: string[];
  frameDomains?: string[];
  baseUriDomains?: string[];
}

function cisti(domeni?: unknown): string[] {
  return Array.isArray(domeni) ? domeni.filter((d): d is string => typeof d === "string" && !/[;\r\n'" ]/.test(d)) : [];
}

export function cspZaglavlje(csp?: Csp): string {
  const resursi = cisti(csp?.resourceDomains).join(" ");
  const veze = cisti(csp?.connectDomains).join(" ");
  const okviri = cisti(csp?.frameDomains).join(" ");
  const baza = cisti(csp?.baseUriDomains).join(" ");
  return [
    "default-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: ${resursi}`.trim(),
    `style-src 'self' 'unsafe-inline' blob: data: ${resursi}`.trim(),
    `img-src 'self' data: blob: ${resursi}`.trim(),
    `font-src 'self' data: blob: ${resursi}`.trim(),
    `connect-src 'self' ${veze}`.trim(),
    okviri ? `frame-src ${okviri}` : "frame-src 'none'",
    "object-src 'none'",
    baza ? `base-uri ${baza}` : "base-uri 'none'",
  ].join("; ");
}

const sandbox = express();
sandbox.get(["/", "/index.html"], (req: Request, res: Response) => {
  let csp: Csp | undefined;
  if (typeof req.query.csp === "string") {
    try {
      csp = JSON.parse(req.query.csp) as Csp;
    } catch {
      csp = undefined;
    }
  }
  res.setHeader("Content-Security-Policy", cspZaglavlje(csp));
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.sendFile(path.join(DIST, "chat-sandbox", "index.html"));
});
sandbox.use((_req: Request, res: Response) => {
  res.status(404).send("Ovde se služi samo sandbox stranica.");
});
sandbox.listen(SANDBOX_PORT, () => {
  console.log(`Sandbox za ekrane: http://localhost:${SANDBOX_PORT}`);
});
