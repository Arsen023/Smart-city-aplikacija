/**
 * Chat aplikacija – čiste funkcije, bez DOM-a i I/O-a (koriste ih i chat server i chat stranica).
 *
 * Chat je naš MCP host: korisnik piše pitanje, Groq odlučuje koji alat da pozove,
 * a ekran verzije A ili B se prikazuje u razgovoru. Kategoriju i savet i dalje
 * prave K2 i K3 na MCP serveru – chat model samo prepričava rezultat (pravila 1 i 7).
 */

/** Koja verzija ekrana se prikazuje u chatu. */
export type Verzija = "A" | "B";

/** Alat koji daje ekran za svaku verziju. Isti tok proceniKvalitet, različit prikaz. */
export const ALAT_PROCENE: Record<Verzija, string> = {
  A: "assess_air_quality",
  B: "assess_air_quality_a2ui",
};

export const OPIS_VERZIJE: Record<Verzija, string> = {
  A: "Verzija A · HTML",
  B: "Verzija B · A2UI",
};

/** Najmanji oblik MCP alata koji nam treba (iz tools/list). */
export interface McpAlat {
  name: string;
  description?: string;
  inputSchema: { type: "object"; properties?: Record<string, unknown>; required?: string[] } & Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

/** Alat u formatu koji Groq (OpenAI chat completions) očekuje. */
export interface ChatAlat {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

/** Alati koje model vidi: spisak stanica + procena za izabranu verziju. Alati samo za ekran se ne nude. */
export function alatiZaVerziju(alati: McpAlat[], verzija: Verzija): McpAlat[] {
  const dozvoljeni = new Set(["get_stations", ALAT_PROCENE[verzija]]);
  return alati.filter((a) => dozvoljeni.has(a.name) && !samoZaEkran(a));
}

function samoZaEkran(a: McpAlat): boolean {
  const ui = a._meta?.ui as { visibility?: string[] } | undefined;
  return Array.isArray(ui?.visibility) && !ui.visibility.includes("model");
}

/** MCP alat → Groq alat. inputSchema je već JSON Schema; uklanjamo samo $schema. */
export function uChatAlat(a: McpAlat): ChatAlat {
  const { $schema: _schema, ...parameters } = a.inputSchema;
  void _schema;
  return {
    type: "function",
    function: {
      name: a.name,
      description: a.description ?? a.name,
      parameters: { ...parameters, type: "object", properties: parameters.properties ?? {} },
    },
  };
}

/** Najmanji oblik rezultata alata (CallToolResult). */
export interface RezultatAlata {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

/** Strukturisani podaci idu modelu samo kad su mali (npr. spisak stanica sa id-jevima). */
export const MAX_JSON_ZA_MODEL = 1500;

/**
 * Šta model dobija kao rezultat alata: tekst (isti kao za hostove bez MCP Apps) i, ako je mali,
 * strukturisani rezultat – da bi npr. iz get_stations uzeo tačan id stanice.
 * A2UI poruke i ostali resursi se ne šalju modelu – to je za ekran, a i troši tokene.
 */
export function tekstZaModel(r: RezultatAlata): string {
  const tekst = (r.content ?? [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("\n")
    .trim();
  let osnova = tekst || "Alat nije vratio tekst.";
  if (r.structuredContent !== undefined) {
    const json = JSON.stringify(r.structuredContent);
    if (json.length <= MAX_JSON_ZA_MODEL) osnova += `\nPodaci (JSON): ${json}`;
  }
  return r.isError ? `Greška alata: ${osnova}` : osnova;
}

/** Da li rezultat procene ima status "error" (npr. nepostojeća stanica) – tada se ekran ne prikazuje. */
export function jeGreskaProcene(r: RezultatAlata): boolean {
  if (r.isError) return true;
  const s = r.structuredContent as { status?: unknown } | undefined;
  return s?.status === "error";
}

/** Sistemska poruka za chat model. */
export function sistemskaPoruka(verzija: Verzija): string {
  return [
    "Ti si asistent u aplikaciji za kvalitet vazduha i odgovaraš na pitanje: „Da li je sada dobro vreme za šetnju ili trening napolju?“",
    `Kad korisnik pita o vazduhu, šetnji, trčanju, treningu ili izlasku napolje, pozovi alat ${ALAT_PROCENE[verzija]}, najviše jednom po pitanju.`,
    "Za svako novo takvo pitanje ponovo pozovi alat, i kad je slično prethodnom – podaci se menjaju, a korisnik treba da vidi ekran.",
    "stationId mora biti tačan id iz get_stations (npr. „demo-liman“), nikad naziv stanice.",
    "Ako ne znaš id, prvo pozovi get_stations, ili pozovi procenu bez stationId (tada se koristi prva stanica).",
    "Rezultat alata se korisniku prikazuje kao ekran sa vrednostima, kategorijom, grafikonom i savetom.",
    ...(verzija === "B"
      ? [
          "Ekran verzije B može da se složi po želji korisnika. Ako korisnik kaže KAKO želi da vidi podatke " +
            "(npr. „samo grafikon“, „samo kategoriju i savet“, „krupno vrednosti“), prosledi tu želju u parametru prikaz, na srpskom, " +
            "i ponovo pozovi alat. Za obično pitanje o vazduhu ne šalji prikaz.",
        ]
      : []),
    "Posle alata odgovori kratko, u 1–2 rečenice, na srpskom jeziku, latinicom, i obraćaj se sa „vi“.",
    "Koristi samo kategoriju, brojeve i savet iz rezultata alata. Kategoriju nikad ne računaš sam i ne izmišljaš brojeve.",
    "Ako rezultat kaže da nema preporuke (zastareli podaci, nema podataka ili greška), prenesi tu poruku i ne daj savet.",
    "Ne daješ medicinske savete ni dijagnoze.",
    "Za pitanja van ove teme ljubazno reci da pomažeš samo oko kvaliteta vazduha za šetnju i trening.",
  ].join("\n");
}

/** Poruka u razgovoru (OpenAI format). */
export interface ChatPoruka {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

/** Argumenti poziva alata iz modela; nevažeći JSON postaje prazan objekat. */
export function argumentiPoziva(json: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(json || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Najviše koraka alat → model u jednom pitanju (zaštita od beskonačne petlje). */
export const MAX_KORAKA = 5;
