/**
 * Verzija B preko CopilotKit-a – A2UI ekran koji AI slaže, a podatke daje server („fixed data“).
 *
 * CopilotKit-ov ugrađeni A2UI alat pušta AI da upiše i podatke (brojeve) u ekran, što krši pravilo 7.
 * Zato AI ovde poziva NAŠ alat `prikazi_ekran` i šalje samo raspored (komponente sa `path` vezama);
 * server proveri raspored istim proverama kao izvorni A2UI (src/chat/a2ui-agent.ts), uzme podatke
 * iz MCP alata i vrati gotove A2UI operacije ({ a2ui_operations: [...] }) koje CopilotKit nacrta.
 * Čiste funkcije – testiraju se bez mreže i bez LLM-a.
 */
import { KATALOG_ID } from "../zajednicko/a2ui-katalog.js";
import { proveriA2uiPoruke, UPUTSTVO_DIZAJNA, uputstvoKataloga } from "./a2ui-agent.js";

export const ALAT_EKRANA = "prikazi_ekran";
const VERZIJA = "v0.9";

type Komponenta = { id: string; component: string } & Record<string, unknown>;

/** Kratak opis komponenti za AI (JSON oblik koji šalje u `komponente`). */
export const OPIS_KOMPONENTI = [
  "Komponente su RAVNA lista JSON objekata; svaka ima jedinstven id, koren ima id \"root\".",
  "children i child sadrže SAMO id-jeve drugih komponenti iz liste (nikad ugnežđene objekte):",
  '- {"id","component":"Column","children":["id",…]} – kolona; {"component":"Row","children":[…]} – red jedno pored drugog',
  '- {"component":"Card","child":"id"} – kartica oko jedne komponente; {"component":"Divider"} – linija',
  '- {"component":"Text","text":"Naslov bez cifara" ili {"path":"/putanja"},"variant":"h2|h3|h4|body|caption"}',
  '- {"component":"KategorijaBadge","naziv":{"path":"/kategorija/naziv"},"nivo":{"path":"/kategorija/nivo"}}',
  '- {"component":"Grafikon24h","tacke":{"path":"/istorija"}} – PM2.5 i PM10 za 24 h',
  '- {"component":"GrafikonNiz","tacke":{"path":"/meteo/temperatura24h"},"jedinica":"°C","naslov":"Temperatura"}',
  '- {"component":"PrognozaSati","sati":{"path":"/meteo/prognoza"}}',
  '- {"component":"MapaSenzora","tacke":{"path":"/senzori"}}',
].join("\n");

export function opisAlataEkrana(): string {
  return [
    "Prikazuje korisniku ekran (A2UI) sa podacima iz baze: vazduh, vreme, voda, mapa senzora.",
    "Ti šalješ SAMO raspored – komponente koje se na podatke vezuju preko {\"path\": …}. Podatke (vazduh, vreme,",
    "voda, senzori) server sam uzima i dodaje; rezultat alata ti vraća kratak sažetak podataka za odgovor.",
    "Pozovi ovaj alat jednom po pitanju, pa korisniku napiši kratak odgovor samo iz sažetka.",
    "Ako alat vrati grešku, ispravi raspored i pozovi ga ponovo.",
    "",
    OPIS_KOMPONENTI,
    "",
    uputstvoKataloga(),
    "",
    UPUTSTVO_DIZAJNA,
  ].join("\n");
}

/** Podaci (data model) i status iz rezultata alata assess_air_quality_a2ui (A2UI resurs). */
export function podaciProcene(r: unknown): { podaci: Record<string, unknown>; komponente: Komponenta[]; status: string } | null {
  const rezultat = r as {
    content?: Array<{ type?: string; resource?: { mimeType?: string; text?: unknown } }>;
    structuredContent?: { status?: unknown };
  } | null;
  for (const c of rezultat?.content ?? []) {
    if (c.type !== "resource" || c.resource?.mimeType !== "application/a2ui+json" || typeof c.resource.text !== "string") continue;
    try {
      const poruke = JSON.parse(c.resource.text) as Array<Record<string, unknown>>;
      const uc = poruke.find((p) => "updateComponents" in p)?.updateComponents as { components?: Komponenta[] } | undefined;
      const dm = poruke.find((p) => "updateDataModel" in p)?.updateDataModel as { value?: Record<string, unknown> } | undefined;
      if (!uc?.components || !dm?.value) return null;
      const status = rezultat?.structuredContent?.status;
      return { podaci: dm.value, komponente: uc.components, status: typeof status === "string" ? status : "error" };
    } catch {
      return null;
    }
  }
  return null;
}

/** Data model iz rezultata get_dashboard (`structuredContent.a2ui.podaci`). */
export function podaciTable(r: unknown): Record<string, unknown> | null {
  const a2ui = (r as { structuredContent?: { a2ui?: { podaci?: unknown } } } | null)?.structuredContent?.a2ui;
  return a2ui && typeof a2ui.podaci === "object" && a2ui.podaci !== null ? (a2ui.podaci as Record<string, unknown>) : null;
}

export function operacije(surfaceId: string, komponente: Komponenta[], podaci: Record<string, unknown>): unknown[] {
  return [
    { version: VERZIJA, createSurface: { surfaceId, catalogId: KATALOG_ID } },
    { version: VERZIJA, updateComponents: { surfaceId, components: komponente } },
    { version: VERZIJA, updateDataModel: { surfaceId, path: "/", value: podaci } },
  ];
}

/** Svojstvo koje sadrži vrednost, po komponenti (AI ponekad stavi `path` direktno na komponentu). */
const GLAVNO_SVOJSTVO: Record<string, string> = {
  Text: "text",
  Grafikon24h: "tacke",
  GrafikonNiz: "tacke",
  PrognozaSati: "sati",
  MapaSenzora: "tacke",
};

/** Svojstva koja se vezuju na data model (tekst „/putanja“ u njima je zapravo putanja). */
const VEZANA_SVOJSTVA = ["text", "tacke", "sati", "naziv", "nivo"] as const;

/**
 * Ispravlja česte greške u rasporedu pre provere: `{"component":"Text","path":"/x"}` → `text: {path:"/x"}`.
 * Komponenta bez sadržaja (npr. Text bez teksta) postaje prazan tekst, da renderer ne padne.
 */
/**
 * AI ponekad ugnezdi komponente (`children: [{component:"Text",…}]`) umesto da ih navede po id-ju.
 * A2UI traži ravnu listu sa referencama, pa ugnežđene komponente izvlačimo u listu i dajemo im id.
 */
export function ispraviGnezdenje(komponente: unknown[]): unknown[] {
  const ravne: unknown[] = [];
  let brojac = 0;
  const kaoId = (dete: unknown): unknown => {
    if (!dete || typeof dete !== "object" || !("component" in dete)) return dete;
    const o = dete as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id ? o.id : `auto_${++brojac}`;
    dodaj({ ...o, id });
    return id;
  };
  const dodaj = (k: unknown) => {
    if (!k || typeof k !== "object") return void ravne.push(k);
    const o = { ...(k as Record<string, unknown>) };
    if (Array.isArray(o.children)) o.children = o.children.map(kaoId);
    if (o.child && typeof o.child === "object") o.child = kaoId(o.child);
    ravne.push(o);
  };
  komponente.forEach(dodaj);
  return ravne;
}

/** Da li svaki `children`/`child` pokazuje na komponentu koja postoji; vraća prvu nepostojeću referencu. */
export function nepostojecaReferenca(komponente: unknown[]): string | null {
  const idjevi = new Set(komponente.map((k) => (k as { id?: unknown })?.id).filter((x): x is string => typeof x === "string"));
  for (const k of komponente) {
    const o = k as { children?: unknown; child?: unknown };
    const reference = [...(Array.isArray(o.children) ? o.children : []), ...(o.child !== undefined ? [o.child] : [])];
    for (const r of reference) if (typeof r !== "string" || !idjevi.has(r)) return String(typeof r === "string" ? r : JSON.stringify(r));
  }
  return null;
}

export function popraviKomponente(komponente: unknown): unknown {
  if (!Array.isArray(komponente)) return komponente;
  return ispraviGnezdenje(komponente).map((k) => {
    if (!k || typeof k !== "object") return k;
    const o = { ...(k as Record<string, unknown>) };
    const glavno = GLAVNO_SVOJSTVO[String(o.component)];
    if (glavno && o[glavno] === undefined && typeof o.path === "string") {
      o[glavno] = { path: o.path };
    }
    delete o.path;
    // AI ponekad napiše putanju kao običan tekst ("sati": "/meteo/prognoza") umesto {"path": …}.
    for (const svojstvo of VEZANA_SVOJSTVA) {
      const v = o[svojstvo];
      if (typeof v === "string" && /^\/[A-Za-z0-9/_]+$/.test(v)) o[svojstvo] = { path: v };
    }
    if (o.component === "Text" && o.text === undefined) o.text = "";
    // Card ima jedno dete (child), Row/Column listu (children) – AI ih ponekad zameni.
    if (o.component === "Card" && o.child === undefined && Array.isArray(o.children)) {
      if (o.children.length === 1) o.child = o.children[0];
      else o.component = "Column";
      if (o.component === "Card") delete o.children;
    }
    if ((o.component === "Row" || o.component === "Column") && o.children === undefined && typeof o.child === "string") {
      o.children = [o.child];
      delete o.child;
    }
    // Samo kontejneri imaju decu: Row/Column → children, Card → child. Ostalo bi renderer odbio.
    if (o.component === "Row" || o.component === "Column") delete o.child;
    else if (o.component === "Card") delete o.children;
    else {
      delete o.child;
      delete o.children;
    }
    return o;
  });
}

export type IshodEkrana ={ ok: true; rezultat: string; razlog?: string } | { ok: false; greska: string };

/**
 * Sastavlja odgovor alata prikazi_ekran. Raspored od AI-ja prolazi naše provere; za procenu vazduha
 * koja nije „ok“ (zastareli podaci, nema podataka, greška) uvek ide fiksni ekran sa porukom (pravilo 2).
 */
/** Tekst iz rezultata MCP alata (content type "text") – kratak sažetak za AI, bez A2UI resursa. */
export function tekstAlata(r: unknown): string {
  const sadrzaj = (r as { content?: Array<{ type?: string; text?: unknown }> } | null)?.content ?? [];
  return sadrzaj
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string)
    .join(" ")
    .trim();
}

/**
 * Sastavlja odgovor alata prikazi_ekran: `{ a2ui_operations, sazetak }`. CopilotKit crta operacije,
 * a AI umesto njih vidi samo `sazetak` (prilagodiZahtev u copilotkit.ts) – manje tokena za Groq.
 * Raspored od AI-ja prolazi naše provere; za procenu vazduha koja nije „ok“ (zastareli podaci, nema
 * podataka, greška) uvek ide fiksni ekran sa porukom (pravilo 2).
 */
export function sastaviEkran(
  komponente: unknown,
  izvori: { tabla: Record<string, unknown> | null; procena: ReturnType<typeof podaciProcene>; sazetak?: string },
  surfaceId: string,
): IshodEkrana {
  const podaci = { ...(izvori.tabla ?? {}), ...(izvori.procena?.podaci ?? {}) };
  if (!izvori.tabla && !izvori.procena) return { ok: false, greska: "Podaci trenutno nisu dostupni (MCP server ne odgovara)." };
  const sazetak = `Ekran je prikazan korisniku. Podaci: ${izvori.sazetak || "nema sažetka"}`;

  if (izvori.procena && izvori.procena.status !== "ok") {
    return {
      ok: true,
      rezultat: JSON.stringify({ a2ui_operations: operacije(surfaceId, izvori.procena.komponente, podaci), sazetak }),
      razlog: `procena ${izvori.procena.status} – fiksni ekran`,
    };
  }

  const popravljene = popraviKomponente(komponente);
  const lista = Array.isArray(popravljene) ? popravljene : [];
  const losa = nepostojecaReferenca(lista);
  if (losa) {
    return {
      ok: false,
      greska: `Raspored nije prihvaćen: children/child mora da sadrži id postojeće komponente (nema „${losa}“). Ispravi ga i pozovi alat ponovo.`,
    };
  }
  const provera = proveriA2uiPoruke([{ updateComponents: { components: lista } }]);
  if (!provera.ok) return { ok: false, greska: `Raspored nije prihvaćen: ${provera.razlog}. Ispravi ga i pozovi alat ponovo.` };
  return { ok: true, rezultat: JSON.stringify({ a2ui_operations: operacije(surfaceId, provera.komponente, podaci), sazetak }) };
}
