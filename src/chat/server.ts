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
import { sistemskaPoruka } from "./alati.js";

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

  const { verzija, poruke, alati, kontekst } = ulaz.data;
  const sistem = [{ role: "system" as const, content: sistemskaPoruka(verzija) }];
  if (kontekst) sistem.push({ role: "system", content: `Šta korisnik trenutno gleda na ekranu: ${kontekst}` });

  const telo = JSON.stringify({
    model: MODEL,
    messages: [...sistem, ...poruke],
    tools: alati,
    tool_choice: "auto",
    temperature: 0.2,
    max_tokens: 1024,
  });

  const pocetak = Date.now();
  try {
    // Model ponekad pogrešno sroči poziv alata (Groq: 400 tool_use_failed) – tada jednom ponovo.
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
      if (kod !== "tool_use_failed") break;
    }
    if (!odgovor?.ok) {
      res.status(502).json({ greska: "AI trenutno nije dostupan. Pokušajte ponovo." });
      return;
    }
    const poruka = OdgovorGroqSema.parse(await odgovor.json()).choices[0].message;
    console.log(`[chat] ${MODEL}, ${Date.now() - pocetak} ms, ${poruka.tool_calls?.length ? `alati: ${poruka.tool_calls.map((p) => p.function.name).join(", ")}` : "odgovor"}`);
    res.json({ poruka: { role: "assistant", content: poruka.content ?? null, tool_calls: poruka.tool_calls } });
  } catch (e) {
    console.error(`[chat] greška posle ${Date.now() - pocetak} ms: ${e instanceof Error ? e.message : "nepoznata"}`);
    res.status(502).json({ greska: "AI trenutno nije dostupan. Pokušajte ponovo." });
  }
});

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
