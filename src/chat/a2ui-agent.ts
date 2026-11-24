/**
 * Chat – izvorni A2UI za verziju B (Node, chat server).
 *
 * AI u chatu odgovara tekstom i <a2ui> blokom (A2UI Express). Zvanični SDK (@a2ui/agent) gradi
 * uputstvo iz našeg kataloga i pretvara blok u A2UI poruke uz proveru po katalogu.
 * Naše dodatne provere (pravila 1 i 7):
 * - AI ne sme da piše podatke (updateDataModel / `$/x = …`) – podaci dolaze samo iz MCP alata;
 * - statički tekst ne sme da sadrži cifre; vezivati se sme samo na poznate putanje;
 * - savet uvek ide uz osnov (FR-11).
 * Ako bilo šta ne prođe, chat crta rezervni (fiksni) ekran koji vraća MCP alat.
 */
import {
  A2uiGenerator,
  CatalogConfig,
  ComponentPruningTransformer,
  FunctionPruningTransformer,
  InMemoryCatalogProvider,
  type A2uiRequestProcessor,
} from "@a2ui/agent";
import fs from "node:fs";
import path from "node:path";
import {
  KATALOG_ID,
  KOMPONENTA_GRAFIKON,
  KOMPONENTA_KATEGORIJA,
  KOMPONENTA_MAPA,
  KOMPONENTA_NIZ,
  KOMPONENTA_PROGNOZA,
  PUTANJE_DASHBOARD_KOMPONENTI,
  PUTANJE_DASHBOARDA,
  PUTANJE_KOMPONENTI,
  PUTANJE_PODATAKA,
} from "../zajednicko/a2ui-katalog.js";

const COMMON = "https://a2ui.org/specification/v0_9/common_types.json#/$defs";
const OSNOVNE = ["Column", "Row", "Card", "Text", "Divider"] as const;
const MAX_STATICKOG_TEKSTA = 60;

/** Sopstvene komponente kao JSON šema (isto kao u src/a2ui/komponente/, za AI). */
function sopstveneKomponente(): Record<string, unknown> {
  const sema = (ime: string, opis: string, polja: Record<string, unknown>, obavezna: string[]) => ({
    type: "object",
    description: opis,
    allOf: [
      { $ref: `${COMMON}/ComponentCommon` },
      { $ref: "#/$defs/CatalogComponentCommon" },
      {
        type: "object",
        properties: { component: { const: ime }, ...polja },
        required: ["component", ...obavezna],
      },
    ],
    unevaluatedProperties: false,
  });
  return {
    [KOMPONENTA_KATEGORIJA]: sema(
      KOMPONENTA_KATEGORIJA,
      "Značka sa EAQI kategorijom kvaliteta vazduha (boja i naziv). Uvek veži naziv na /kategorija/naziv i nivo na /kategorija/nivo.",
      { naziv: { $ref: `${COMMON}/DynamicString` }, nivo: { $ref: `${COMMON}/DynamicNumber` } },
      ["naziv", "nivo"],
    ),
    [KOMPONENTA_GRAFIKON]: sema(
      KOMPONENTA_GRAFIKON,
      "Linijski grafikon PM2.5 i PM10 za poslednja 24 h. Uvek veži tacke na /istorija.",
      { tacke: { $ref: `${COMMON}/DataBinding` }, jedinica: { $ref: `${COMMON}/DynamicString` } },
      ["tacke"],
    ),
    [KOMPONENTA_NIZ]: sema(
      KOMPONENTA_NIZ,
      "Linijski grafikon jednog niza: temperatura ili vlažnost vazduha (/meteo/…24h) ili kvalitet vode (/voda/…24h). " +
        "tacke se vezuju na niz, jedinica je kratak tekst (°C, %, mg/L, pH), naslov kratak tekst bez cifara.",
      {
        tacke: { $ref: `${COMMON}/DataBinding` },
        jedinica: { $ref: `${COMMON}/DynamicString` },
        naslov: { $ref: `${COMMON}/DynamicString` },
      },
      ["tacke"],
    ),
    [KOMPONENTA_PROGNOZA]: sema(
      KOMPONENTA_PROGNOZA,
      "Prognoza vremena po satima (sat, ikona, temperatura) u jednom redu. Uvek veži sati na /meteo/prognoza.",
      { sati: { $ref: `${COMMON}/DataBinding` } },
      ["sati"],
    ),
    [KOMPONENTA_MAPA]: sema(
      KOMPONENTA_MAPA,
      "Mapa Novog Sada sa senzorima kvaliteta vazduha, obojenim po EAQI kategoriji. Uvek veži tacke na /senzori.",
      { tacke: { $ref: `${COMMON}/DataBinding` } },
      ["tacke"],
    ),
  };
}

const NOVI_RED = String.fromCharCode(10);

export function uputstvoKataloga(): string {
  const spisak = (o: Record<string, string>) =>
    Object.entries(o)
      .map(([p, opis]) => `- ${p}: ${opis}`)
      .join(NOVI_RED);
  return [
    "Ovaj katalog služi za ekrane o kvalitetu vazduha, vremenu i kvalitetu vode u Novom Sadu.",
    "Podaci su već u data modelu – ti ih samo vezuješ preko putanja ($/putanja).",
    "NIKAD ne dodeljuj vrednosti podacima (bez `$/x = …`) i ne piši brojeve u tekst.",
    "Statički tekst (naslovi, oznake) je kratak, na srpskom, bez cifara.",
    "Vazduh – putanje za Text:",
    spisak(PUTANJE_PODATAKA),
    `Kategorija vazduha: ${KOMPONENTA_KATEGORIJA}(naziv=$/kategorija/naziv, nivo=$/kategorija/nivo). Grafikon PM: ${KOMPONENTA_GRAFIKON}(tacke=$/istorija).`,
    "Vreme, voda, senzori – putanje za Text:",
    spisak(PUTANJE_DASHBOARDA),
    "Nizovi – samo za sopstvene komponente:",
    spisak(PUTANJE_DASHBOARD_KOMPONENTI),
    "Ako prikazuješ $/savet, prikaži i $/osnov. Napravi tačno jedan surface.",
  ].join(NOVI_RED);
}

/**
 * Kako AI slaže izgled: prema pitanju, ne uvek isto. Ide u sistemsku poruku koraka sa ekranom.
 */
export const UPUTSTVO_DIZAJNA = [
  "Ti si dizajner ekrana. Izgled sastavi PREMA PITANJU – ne pravi uvek isti ekran:",
  "- pitanje o vazduhu, šetnji ili treningu: kategorija, PM vrednosti, savet i osnov (ako postoje), po želji grafikon PM;",
  "- pitanje o vremenu: velika temperatura sa ikonom i opisom, red sa vlažnošću, vetrom i padavinama, prognoza po satima, po želji grafikon temperature;",
  "- pitanje o vodi: kartice sa kiseonikom, pH i temperaturom vode, vreme merenja, grafikon koji je korisnik tražio (kiseonik, pH ili temperatura);",
  "- pitanje o senzorima, mapi ili lokacijama: mapa senzora i opis senzora;",
  "- opšte pitanje („kakvo je stanje“, „pregled“): kratak pregled svih dostupnih delova, po jedna kartica za svaki.",
  "Koristi Card za grupe, Row da vrednosti stoje jedna pored druge, Text sa variant h2/h3 za naslove i caption za sitne napomene, Divider između celina.",
  "Prikazuj samo delove koji su navedeni kao dostupni. Ako korisnik kaže kako želi da vidi podatke, uradi tačno to.",
].join(NOVI_RED);

/** Naš katalog za AI: osnovni v0.9 (skraćen) + sopstvene komponente, sa uputstvom. */
export function katalogZaAgenta(putanjaOsnovnog?: string): CatalogConfig {
  const fajl =
    putanjaOsnovnog ??
    path.join(import.meta.dirname, "..", "..", "node_modules", "@a2ui", "web_core", "src", "v0_9", "schemas", "catalogs", "basic", "catalog.json");
  const osnovni = JSON.parse(fs.readFileSync(fajl, "utf8")) as Record<string, unknown> & {
    components: Record<string, unknown>;
    $defs: Record<string, unknown> & { anyComponent?: { oneOf?: unknown[] } };
  };
  const sopstvene = sopstveneKomponente();
  // Komponente su dozvoljene samo ako su navedene u $defs.anyComponent.oneOf.
  const anyComponent = {
    ...osnovni.$defs.anyComponent,
    oneOf: [
      ...(osnovni.$defs.anyComponent?.oneOf ?? []),
      ...Object.keys(sopstvene).map((ime) => ({ $ref: `#/components/${ime}` })),
    ],
  };
  const nas = {
    ...osnovni,
    $id: KATALOG_ID,
    catalogId: KATALOG_ID,
    title: "Kvalitet vazduha, vreme i voda",
    instructions: uputstvoKataloga(),
    components: { ...osnovni.components, ...sopstvene },
    $defs: { ...osnovni.$defs, anyComponent },
  };
  const katalog = new InMemoryCatalogProvider(nas, "v0.9", KATALOG_ID).load();
  return new CatalogConfig(katalog, [
    new ComponentPruningTransformer([
      ...OSNOVNE,
      KOMPONENTA_KATEGORIJA,
      KOMPONENTA_GRAFIKON,
      KOMPONENTA_NIZ,
      KOMPONENTA_PROGNOZA,
      KOMPONENTA_MAPA,
    ]),
    new FunctionPruningTransformer(null),
  ]);
}

export function napraviProcesor(katalog: CatalogConfig = katalogZaAgenta()): A2uiRequestProcessor {
  return new A2uiGenerator([katalog]).createProcessor({ "v0.9": { supportedCatalogIds: [KATALOG_ID] } });
}

// ─── Naše provere (čiste funkcije) ──────────────────────────────────────────

type Komponenta = { id: string; component: string } & Record<string, unknown>;
export type IshodA2ui = { ok: true; komponente: Komponenta[] } | { ok: false; razlog: string };

const DOZVOLJENE = new Set<string>([
  ...Object.keys(PUTANJE_PODATAKA),
  ...PUTANJE_KOMPONENTI,
  ...Object.keys(PUTANJE_DASHBOARDA),
  ...Object.keys(PUTANJE_DASHBOARD_KOMPONENTI),
]);

function sveVeze(v: unknown, izlaz: string[]) {
  if (Array.isArray(v)) v.forEach((x) => sveVeze(x, izlaz));
  else if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.path === "string" && Object.keys(o).length === 1) izlaz.push(o.path);
    Object.values(o).forEach((x) => sveVeze(x, izlaz));
  }
}

/** Proverava A2UI poruke koje je SDK napravio iz AI odgovora i vraća komponente za crtanje. */
export function proveriA2uiPoruke(poruke: unknown[]): IshodA2ui {
  let komponente: Komponenta[] | null = null;
  for (const p of poruke) {
    const m = p as Record<string, unknown>;
    if ("updateDataModel" in m) return { ok: false, razlog: "AI je pokušao da upiše podatke" };
    if ("updateComponents" in m) {
      const uc = m.updateComponents as { components?: Komponenta[] };
      if (komponente) return { ok: false, razlog: "više od jednog ekrana" };
      komponente = uc.components ?? [];
    }
  }
  if (!komponente?.length) return { ok: false, razlog: "nema komponenti" };
  if (!komponente.some((k) => k.id === "root")) return { ok: false, razlog: "nema root" };

  const veze: string[] = [];
  for (const k of komponente) {
    if (k.component === "Text" && typeof k.text === "string") {
      const t = k.text.trim();
      if (/\d/.test(t)) return { ok: false, razlog: `tekst sadrži broj: „${t}“` };
      if (t.length > MAX_STATICKOG_TEKSTA) return { ok: false, razlog: "predugačak tekst" };
    }
    sveVeze(k, veze);
  }
  const nepoznata = veze.find((p) => !DOZVOLJENE.has(p));
  if (nepoznata) return { ok: false, razlog: `nepoznata putanja ${nepoznata}` };

  // Savet uvek uz osnov (FR-11).
  if (veze.includes("/savet") && !veze.includes("/osnov")) {
    const osnov: Komponenta = { id: "osnov_auto", component: "Text", text: { path: "/osnov" }, variant: "caption" };
    const koren = komponente.find((k) => k.id === "root") as Komponenta;
    if (koren.component === "Column" && Array.isArray(koren.children)) {
      komponente = komponente.map((k) => (k.id === "root" ? { ...k, children: [...(k.children as string[]), osnov.id] } : k));
      komponente.push(osnov);
    } else {
      komponente = komponente.map((k) => (k.id === "root" ? { ...k, id: "root_ai" } : k));
      komponente.push(osnov, { id: "root", component: "Column", children: ["root_ai", osnov.id] });
    }
  }
  return { ok: true, komponente };
}

// ─── Obrada odgovora modela ─────────────────────────────────────────────────

export interface ObradjenOdgovor {
  /** Tekst odgovora bez <a2ui> bloka. */
  tekst: string;
  /** Komponente za izvorni ekran, ili null (tada chat crta rezervni ekran). */
  komponente: Komponenta[] | null;
  /** Zašto nema AI ekrana (za log), ako ga nema. */
  razlog?: string;
}

const BLOK = /<a2ui(?:-json)?>[\s\S]*?(<\/a2ui(?:-json)?>|$)/g;

export function obradiOdgovor(procesor: A2uiRequestProcessor, sadrzaj: string): ObradjenOdgovor {
  if (!/<a2ui/.test(sadrzaj)) return { tekst: sadrzaj.trim(), komponente: null, razlog: "AI nije poslao ekran" };
  try {
    const delovi = procesor.parseResponse(sadrzaj);
    const tekst = delovi
      .filter((d) => d.type === "text")
      .map((d) => (d as { text: string }).text)
      .join(" ")
      .trim();
    const poruke = delovi.flatMap((d) => (d.type === "text" ? [] : ((d as { a2ui?: unknown[] }).a2ui ?? [])));
    const ishod = proveriA2uiPoruke(poruke);
    return ishod.ok ? { tekst, komponente: ishod.komponente } : { tekst, komponente: null, razlog: ishod.razlog };
  } catch (e) {
    return {
      tekst: sadrzaj.replace(BLOK, " ").replace(/\s+/g, " ").trim(),
      komponente: null,
      razlog: `SDK: ${e instanceof Error ? e.message.slice(0, 200) : "greška"}`,
    };
  }
}
