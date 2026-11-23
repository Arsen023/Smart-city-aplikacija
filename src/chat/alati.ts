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
  A: "Verzija A · MCP App (HTML)",
  B: "Verzija B · A2UI (izvorno)",
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

/** Alat za vreme i prognozu (isti u obe verzije; odgovor je tekst, bez ekrana). */
export const ALAT_VREMENA = "get_weather";

/** Alati za kvalitet vode iz baze (FishNET), isti u obe verzije; odgovor je tekst, bez ekrana. */
export const ALATI_VODE = ["get_water_devices", "get_water_latest", "get_water_history"] as const;

/**
 * Alati koje model vidi: spisak stanica, procena vazduha za izabranu verziju, vreme i voda.
 * Alati samo za ekran (npr. get_dashboard, osvezi_a2ui) se ne nude.
 */
export function alatiZaVerziju(alati: McpAlat[], verzija: Verzija): McpAlat[] {
  const dozvoljeni = new Set<string>(["get_stations", ALAT_PROCENE[verzija], ALAT_VREMENA, ...ALATI_VODE]);
  return alati
    .filter((a) => dozvoljeni.has(a.name) && !samoZaEkran(a))
    .map((a) => (verzija === "B" ? bezParametraPrikaz(a) : a));
}

/**
 * U izvornom A2UI ekran sastavlja chat model, pa mu parametar `prikaz` (raspored koji pravi server,
 * za MCP hostove kao Claude Desktop) ne treba – inače bi ekran sastavljala dva modela.
 */
function bezParametraPrikaz(a: McpAlat): McpAlat {
  const props = a.inputSchema.properties;
  if (!props || !("prikaz" in props)) return a;
  const { prikaz: _p, ...ostalo } = props;
  void _p;
  return { ...a, inputSchema: { ...a.inputSchema, properties: ostalo } };
}

/**
 * Sažet razgovor za korak u kome AI sastavlja A2UI ekran: pitanje korisnika i rezultat procene
 * kao običan tekst – bez istorije poziva alata i bez alata (model tada ne pokušava nove pozive,
 * a troši se mnogo manje tokena).
 */
export function sazmiZaA2ui(poruke: ChatPoruka[]): ChatPoruka[] {
  const poslednjeUser = poruke.map((p) => p.role).lastIndexOf("user");
  const pitanje = poruke[poslednjeUser]?.content ?? "";
  const rezultati = poruke
    .slice(poslednjeUser + 1)
    .filter((p) => p.role === "tool" && p.content)
    .map((p) => p.content as string);
  return [
    { role: "user", content: pitanje },
    { role: "user", content: `Rezultat alata (podaci su već u data modelu ekrana):\n${rezultati.join("\n\n")}` },
  ];
}

/**
 * A2UI uputstvo za chat model ide tek kad u tekućem pitanju stigne rezultat procene verzije B
 * (ne posle get_stations) – tada model ima podatke i treba samo da sastavi ekran; štede se tokeni.
 */
export function trebaA2uiUputstvo(
  verzija: Verzija,
  poruke: Array<Pick<ChatPoruka, "role" | "tool_calls" | "tool_call_id">>,
): boolean {
  if (verzija !== "B") return false;
  const odPitanja = poruke.slice(poruke.map((p) => p.role).lastIndexOf("user") + 1);
  const pozivi = new Set(
    odPitanja.flatMap((p) => (p.tool_calls ?? []).filter((t) => t.function.name === ALAT_PROCENE.B).map((t) => t.id)),
  );
  return odPitanja.some((p) => p.role === "tool" && p.tool_call_id !== undefined && pozivi.has(p.tool_call_id));
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
    "Ti si asistent aplikacije Smart City Novi Sad. Pomažeš oko tri teme: kvalitet vazduha (i da li je dobro vreme za šetnju ili trening napolju), vreme i prognoza, i kvalitet vode.",
    "Odgovaraj samo na osnovu rezultata alata. Nikad ne izmišljaj brojeve, vremena merenja, stanice ni uređaje.",
    "",
    "VAZDUH",
    `- Kad korisnik pita o vazduhu, zagađenju, PM česticama, šetnji, trčanju, treningu ili izlasku napolje, pozovi ${ALAT_PROCENE[verzija]}, najviše jednom po pitanju.`,
    "- Za svako novo takvo pitanje ponovo pozovi alat, i kad je slično prethodnom – podaci se menjaju, a korisnik treba da vidi ekran.",
    "- stationId mora biti tačan id iz get_stations (npr. „demo-liman“), nikad naziv. Ako ga ne znaš, pozovi procenu bez stationId (koristi se prva stanica).",
    "- Rezultat se korisniku prikazuje kao ekran sa vrednostima, kategorijom, grafikonom i savetom; ti ga samo kratko prepričaš.",
    "- Kategoriju nikad ne računaš sam. Koristi samo kategoriju, brojeve i savet iz rezultata.",
    "- Ako rezultat kaže da nema preporuke (zastareli podaci, nema podataka ili greška), prenesi tu poruku i ne daj savet.",
    "",
    "VREME",
    `- Za temperaturu, kišu, vetar, vlažnost ili prognozu pozovi ${ALAT_VREMENA} i navedi samo brojeve iz rezultata.`,
    "- Kad korisnik pita da li je dobro za šetnju ili trening, posle procene vazduha možeš pozvati i ovaj alat i spojiti oba odgovora.",
    "",
    "VODA",
    "- Za kvalitet vode, temperaturu vode, pH, kiseonik, ORP, provodljivost ili CO2 pozovi get_water_latest (ako ne znaš id uređaja, izostavi deviceId – koristi se prvi uređaj); za kretanje kroz vreme pozovi get_water_history; za spisak uređaja get_water_devices.",
    "- To su merenja senzora u vodi (FishNET, DunavNET), ne ispitivanje vode za piće ili kupanje.",
    "- Navedi vrednosti sa jedinicama i vreme merenja. Možeš ukratko objasniti šta veličina znači, ali ne ocenjuj da li je voda dobra, bezbedna ili za piće – aplikacija za vodu nema pravila ni pragove.",
    "- Ako je merenje staro (npr. pre više dana), to jasno reci.",
    "",
    ...(verzija === "B"
      ? [
          "EKRAN (verzija B)",
          "- Za procenu vazduha ekran sastavljaš TI, u A2UI bloku (pravila dobijaš posle rezultata alata).",
          "- Ako korisnik kaže KAKO želi da vidi podatke (npr. „samo grafikon“, „samo kategoriju i savet“, „krupno vrednosti“), " +
            "složi ekran tačno po toj želji; inače napravi pregledan ekran sa stanicom, vrednostima, vremenom, kategorijom, grafikonom, savetom i osnovom.",
          "",
        ]
      : []),
    "STIL",
    "- Odgovaraj na srpskom jeziku, latinicom, obraćaj se sa „vi“. Brojevi sa decimalnim zarezom (3,7), uz jedinicu.",
    "- Alate pozivaj JEDAN PO JEDAN: pozovi jedan alat, sačekaj rezultat, pa po potrebi sledeći. Nikad više alata u istom pozivu.",
    "- Kratko: 1–3 rečenice. Kad pitanje pokriva više tema (npr. „kakvo je stanje u gradu“), pozovi potrebne alate redom i odgovori u par rečenica po temi.",
    "- Ako alat vrati grešku ili podaci nisu dostupni, reci to jednostavno (npr. „Podaci o vodi trenutno nisu dostupni.“) i ne nagađaj.",
    "- Ne daješ medicinske savete ni dijagnoze.",
    "- Za pitanja van ovih tema ljubazno reci da pomažeš oko kvaliteta vazduha, vremena i kvaliteta vode u Novom Sadu.",
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
