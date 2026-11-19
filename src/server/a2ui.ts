/**
 * T12 – A2UI poruke za verziju B iz `Rezultat`-a koji vraća assess_air_quality.
 *
 * Deterministički, bez LLM-a (spec 8.3): isti Rezultat → iste poruke. Nema pravila ni
 * računanja kategorije – sve vrednosti dolaze iz Rezultat-a (pravila 1 i 4).
 *
 * - updateComponents opisuje izgled; zavisi od statusa (ok / stale / no_data / error),
 *   pa se šalje i pri osvežavanju.
 * - updateDataModel nosi tekstove i podatke; komponente ih čitaju preko `path`.
 */
import type { PoslednjaVrednost, Rezultat, SatnaVrednost, Stanica } from "../core/tipovi.js";
import { prikazDatumVreme } from "../core/vreme.js";
import { KATALOG_ID, KOMPONENTA_GRAFIKON, KOMPONENTA_KATEGORIJA } from "../zajednicko/a2ui-katalog.js";
import { protekloVreme } from "../zajednicko/format.js";
import type { AiRasporedA2ui } from "./a2ui-ai.js";
import { PORUKA_BEZ_SAVETA, tekstVrednosti } from "./procena.js";

export const A2UI_MIME_TYPE = "application/a2ui+json";
export const A2UI_VERZIJA = "v0.9";
export const SURFACE_ID = "kvalitet-vazduha";

/** Imena akcija koje ekran šalje serveru. */
export const AKCIJA_OSVEZI = "osvezi";
export const AKCIJA_IZABERI = "izaberi_stanicu";

// ─── Data model ─────────────────────────────────────────────────────────────

export interface PodaciEkrana {
  /** Izabrana stanica kao lista (ChoicePicker radi sa listom vrednosti). */
  izbor: string[];
  stanica: string;
  pm25: string;
  pm10: string;
  /** Za kartice iz Stitch skice: veliki broj ("82,9" ili „nije dostupno“) i jedinica posebno. */
  pm25Broj: string;
  pm25Jedinica: string;
  pm10Broj: string;
  pm10Jedinica: string;
  vreme: string;
  kategorija: { naziv: string; nivo: number } | null;
  napomena: string;
  poruka: string;
  savet: string;
  osnov: string;
  pravilo: string;
  istorija: SatnaVrednost[];
  osvezeno: string;
  /** Želja korisnika za izgled (AI raspored); prazno = fiksni ekran. „Osveži“ je šalje nazad. */
  prikaz: string;
}

// protekloVreme() je premeštena u src/zajednicko/format.ts (T11); izvozi se i odavde, da postojeći uvozi rade.
export { protekloVreme };

function vremeOsvezavanja(sada: Date): string {
  return new Intl.DateTimeFormat("sr-Latn", {
    timeZone: "Europe/Belgrade",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(sada);
}

function poslednja(r: Rezultat, velicina: "PM2.5" | "PM10"): PoslednjaVrednost {
  return r.values.find((x) => x.velicina === velicina) ?? { velicina, vrednost: null, jedinica: "µg/m³" };
}

function vrednost(r: Rezultat, velicina: "PM2.5" | "PM10"): string {
  return tekstVrednosti(poslednja(r, velicina)); // isti format kao u content tekstu ("PM2.5 3,7 µg/m³" / "PM2.5 nije dostupno")
}

const broj = new Intl.NumberFormat("sr-Latn", { maximumFractionDigits: 1 });

/** Broj i jedinica posebno; nedostajuća vrednost je „nije dostupno“, nikad 0 (pravilo 5). */
function brojIJedinica(r: Rezultat, velicina: "PM2.5" | "PM10"): [string, string] {
  const v = poslednja(r, velicina);
  return v.vrednost === null ? ["nije dostupno", ""] : [broj.format(v.vrednost), v.jedinica];
}

/**
 * Podaci za ekran iz Rezultat-a.
 * @param sada  „sada“ iz zavisnosti (u demo režimu vreme scenarija) – za „pre X min“
 * @param osvezeno stvarno vreme kad je server napravio podatke
 */
export function podaciEkrana(r: Rezultat, sada: Date, osvezeno: Date = new Date(), prikaz = ""): PodaciEkrana {
  const ok = r.status === "ok" && r.category !== null;
  const [pm25Broj, pm25Jedinica] = brojIJedinica(r, "PM2.5");
  const [pm10Broj, pm10Jedinica] = brojIJedinica(r, "PM10");
  return {
    izbor: r.station.id ? [r.station.id] : [],
    stanica: r.station.naziv,
    pm25: vrednost(r, "PM2.5"),
    pm10: vrednost(r, "PM10"),
    pm25Broj,
    pm25Jedinica,
    pm10Broj,
    pm10Jedinica,
    vreme: r.measuredAt
      ? `Merenje: ${prikazDatumVreme(new Date(r.measuredAt))} · ${protekloVreme(r.measuredAt, sada)}`
      : "Merenje: nema podataka",
    kategorija: ok && r.category ? { naziv: r.category.naziv, nivo: r.category.nivo } : null,
    napomena: r.napomena ?? "",
    // Za stale / no_data / error poruka zamenjuje kategoriju i savet (spec 8.1).
    poruka: ok ? (r.advice ? "" : (r.message ?? PORUKA_BEZ_SAVETA)) : (r.message ?? "Ne dajemo preporuku."),
    savet: ok && r.advice ? r.advice.savet : "",
    osnov: ok && r.advice ? `Osnov: ${r.advice.osnov}` : "",
    pravilo: r.rule ? `Pravilo: ${r.rule}` : "",
    istorija: r.history,
    osvezeno: `Osveženo u ${vremeOsvezavanja(osvezeno)}`,
    prikaz,
  };
}

// ─── Komponente ─────────────────────────────────────────────────────────────

type Komponenta = { id: string; component: string } & Record<string, unknown>;

const tekst = (id: string, putanja: string, variant = "body"): Komponenta => ({
  id,
  component: "Text",
  text: { path: putanja },
  variant,
});

/** Pitanje na koje ekran odgovara – podnaslov u zaglavlju (kao u Stitch skici). */
export const PITANJE = "Da li je sada dobro vreme za šetnju ili trening napolju?";

/** Ikonica uz savet, preuzeta iz Stitch skice (docs/stitch/stitch-sa-podacima.html). */
const IKONICA_SAVETA = "M13 10V3L4 14h7v7l9-11h-7z";
/**
 * Ikonica „osveži“ kao SVG putanja (Material „refresh“). Ugrađena ikonica po imenu traži
 * font sa ikonicama koji se u MCP App iframe-u ne učitava (CSP), pa bi se ispisala reč „refresh“.
 */
const IKONICA_OSVEZI =
  "M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z";

/** Centrira jednu komponentu u redu. */
const centrirano = (id: string, dete: string): Komponenta => ({ id, component: "Row", children: [dete], justify: "center" });

/**
 * Izgled ekrana po Stitch skici (docs/stitch/stitch-sa-podacima.png i stitch-bez-preporuke.png):
 * zaglavlje sa stanicom i pitanjem → dve kartice PM2.5 / PM10 → vreme merenja i značka kategorije
 * u sredini → kartica sa grafikonom → kartica sa savetom → osnov sitnim slovima → „Osveži“ preko
 * cele širine. Za stale / no_data / error umesto značke i saveta stoji kartica sa porukom.
 * Struktura zavisi od statusa; vrednosti dolaze iz data modela.
 */
export function komponente(r: Rezultat, stanice: Pick<Stanica, "id" | "naziv">[], podaci: PodaciEkrana): Komponenta[] {
  const ok = podaci.kategorija !== null;
  const imaIstoriju = podaci.istorija.length > 0;

  const telo: string[] = ["zaglavlje", "vrednosti", "vreme-red"];
  if (ok) telo.push("kategorija-red");
  if (podaci.napomena) telo.push("napomena-red");
  if (podaci.poruka) telo.push("poruka-kartica");
  if (imaIstoriju) telo.push("grafikon-kartica");
  if (podaci.savet) telo.push("savet-kartica", "osnov");
  if (podaci.pravilo) telo.push("pravilo");
  telo.push("dno", "osvezeno-red");

  // Izbor stanice: ako stanica iz rezultata nije u listi (npr. greška), ipak je prikaži.
  const opcije = stanice.map((s) => ({ label: s.naziv, value: s.id }));
  if (r.station.id && !opcije.some((o) => o.value === r.station.id)) {
    opcije.unshift({ label: r.station.naziv, value: r.station.id });
  }

  const karticaVrednosti = (velicina: "pm25" | "pm10", naziv: string): Komponenta[] => [
    { id: `kartica-${velicina}`, component: "Card", child: `${velicina}-kol`, weight: 1 },
    { id: `${velicina}-kol`, component: "Column", children: [`${velicina}-naziv`, `${velicina}-red`] },
    { id: `${velicina}-naziv`, component: "Text", text: naziv, variant: "h5" },
    {
      id: `${velicina}-red`,
      component: "Row",
      children: [`${velicina}-broj`, `${velicina}-jedinica`],
      align: "end",
      justify: "start",
    },
    tekst(`${velicina}-broj`, `/${velicina}Broj`, "h2"),
    tekst(`${velicina}-jedinica`, `/${velicina}Jedinica`, "caption"),
  ];

  const sve: Komponenta[] = [
    { id: "root", component: "Column", children: telo },

    // 1. Zaglavlje: stanica, pitanje i izbor stanice
    { id: "zaglavlje", component: "Card", child: "zaglavlje-kol" },
    { id: "zaglavlje-kol", component: "Column", children: ["stanica", "pitanje", "izbor-red"] },
    tekst("stanica", "/stanica", "h3"),
    { id: "pitanje", component: "Text", text: PITANJE, variant: "body" },
    { id: "izbor-red", component: "Row", children: ["izbor", "prikazi"], align: "center", justify: "spaceBetween" },
    {
      id: "izbor",
      component: "ChoicePicker",
      label: "Merna stanica",
      variant: "mutuallyExclusive",
      displayStyle: "chips",
      options: opcije,
      value: { path: "/izbor" },
      weight: 1,
    },
    {
      id: "prikazi",
      component: "Button",
      child: "prikazi-tekst",
      action: { event: { name: AKCIJA_IZABERI, context: { izbor: { path: "/izbor" }, prikaz: { path: "/prikaz" } } } },
    },
    { id: "prikazi-tekst", component: "Text", text: "Prikaži" },

    // 2. Dve kartice: PM2.5 i PM10 jedna pored druge
    { id: "vrednosti", component: "Row", children: ["kartica-pm25", "kartica-pm10"], justify: "spaceBetween" },
    ...karticaVrednosti("pm25", "PM2.5"),
    ...karticaVrednosti("pm10", "PM10"),

    // 3. Vreme merenja, u sredini
    centrirano("vreme-red", "vreme"),
    tekst("vreme", "/vreme", "caption"),

    // 4. Kategorija (sopstvena komponenta: boja + naziv), u sredini
    centrirano("kategorija-red", "kategorija"),
    {
      id: "kategorija",
      component: KOMPONENTA_KATEGORIJA,
      naziv: { path: "/kategorija/naziv" },
      nivo: { path: "/kategorija/nivo" },
    },
    centrirano("napomena-red", "napomena"),
    tekst("napomena", "/napomena", "caption"),

    // Poruka umesto kategorije i saveta (stale / no_data / error) ili kad savet nije dostupan
    { id: "poruka-kartica", component: "Card", child: "poruka" },
    tekst("poruka", "/poruka", "body"),

    // 5. Grafikon u kartici
    { id: "grafikon-kartica", component: "Card", child: "grafikon-kol" },
    { id: "grafikon-kol", component: "Column", children: ["grafikon-naslov", "grafikon"] },
    { id: "grafikon-naslov", component: "Text", text: "Poslednja 24 h", variant: "h5" },
    { id: "grafikon", component: KOMPONENTA_GRAFIKON, tacke: { path: "/istorija" }, jedinica: "µg/m³" },

    // 6. Savet u kartici sa ikonicom
    { id: "savet-kartica", component: "Card", child: "savet-red" },
    { id: "savet-red", component: "Row", children: ["savet-ikona", "savet"], align: "start" },
    { id: "savet-ikona", component: "Icon", name: { svgPath: IKONICA_SAVETA } },
    { ...tekst("savet", "/savet", "body"), weight: 1 },

    // 7. Osnov i pravilo, sitnim slovima
    tekst("osnov", "/osnov", "caption"),
    tekst("pravilo", "/pravilo", "caption"),

    // Osveži (FR-15). U Stitch skici je preko cele širine, ali A2UI Button ne podržava
    // weight ni rastezanje, pa je centrirano (ograničenje kataloga, za preporuku D6).
    { id: "dno", component: "Row", children: ["osvezi"], justify: "center" },
    {
      id: "osvezi",
      component: "Button",
      child: "osvezi-sadrzaj",
      variant: "primary",
      action: { event: { name: AKCIJA_OSVEZI, context: { izbor: { path: "/izbor" }, prikaz: { path: "/prikaz" } } } },
    },
    { id: "osvezi-sadrzaj", component: "Row", children: ["osvezi-ikona", "osvezi-tekst"], align: "center", justify: "center" },
    { id: "osvezi-ikona", component: "Icon", name: { svgPath: IKONICA_OSVEZI } },
    { id: "osvezi-tekst", component: "Text", text: "Osveži" },
    centrirano("osvezeno-red", "osvezeno"),
    tekst("osvezeno", "/osvezeno", "caption"),
  ];

  // Šaljemo samo komponente koje se koriste (koren + sve dostupne iz njega).
  return dostupne(sve);
}

/** Komponente dostupne iz "root" (preko child/children). */
function dostupne(sve: Komponenta[]): Komponenta[] {
  const poId = new Map(sve.map((k) => [k.id, k]));
  const vidjene = new Set<string>();
  const red = ["root"];
  while (red.length) {
    const id = red.shift() as string;
    const k = poId.get(id);
    if (!k || vidjene.has(id)) continue;
    vidjene.add(id);
    if (typeof k.child === "string") red.push(k.child);
    if (Array.isArray(k.children)) red.push(...(k.children as string[]));
  }
  return sve.filter((k) => vidjene.has(k.id));
}

// ─── Poruke ─────────────────────────────────────────────────────────────────

export function porukaKreiranja() {
  return { version: A2UI_VERZIJA, createSurface: { surfaceId: SURFACE_ID, catalogId: KATALOG_ID } };
}

/** AI raspored (verzija B, po želji korisnika) – vidi a2ui-raspored.ts i a2ui-ai.ts. */
export interface OpcijeEkrana {
  osvezeno?: Date;
  /** Želja korisnika za izgled; čuva se u data modelu da je „Osveži“ pošalje nazad. */
  prikaz?: string;
  /** Proveren AI raspored; null/undefined = fiksni ekran. */
  raspored?: AiRasporedA2ui | null;
}

/** Delovi fiksnog ekrana koji uvek idu i uz AI raspored: „Osveži“ (FR-15) i vreme osvežavanja. */
const UVEK = new Set(["dno", "osvezi", "osvezi-sadrzaj", "osvezi-ikona", "osvezi-tekst", "osvezeno-red", "osvezeno"]);

/**
 * AI raspored + obavezni delovi. AI raspored se koristi samo kad je status "ok": za stale / no_data /
 * error uvek fiksni ekran sa porukom (FR-09). Ako AI prikaže savet bez osnova, osnov se dodaje (FR-11).
 */
export function komponenteSaRasporedom(fiksne: Komponenta[], ai: AiRasporedA2ui): Komponenta[] {
  const dodatno: Komponenta[] = [];
  const telo = [ai.koren];
  if (ai.koristiSavet && !ai.koristiOsnov) {
    dodatno.push(tekst("ai-osnov-auto", "/osnov", "caption"));
    telo.push("ai-osnov-auto");
  }
  telo.push("dno", "osvezeno-red");
  return [
    { id: "root", component: "Column", children: telo },
    ...ai.komponente,
    ...dodatno,
    ...fiksne.filter((k) => UVEK.has(k.id)),
  ];
}

/** Izgled + podaci. Koristi se i za prvo crtanje i za osvežavanje. */
export function porukeAzuriranja(
  r: Rezultat,
  stanice: Pick<Stanica, "id" | "naziv">[],
  sada: Date,
  opcije: OpcijeEkrana = {},
) {
  const podaci = podaciEkrana(r, sada, opcije.osvezeno, opcije.prikaz ?? "");
  const fiksne = komponente(r, stanice, podaci);
  const ok = r.status === "ok" && r.category !== null;
  const components = ok && opcije.raspored ? komponenteSaRasporedom(fiksne, opcije.raspored) : fiksne;
  return [
    { version: A2UI_VERZIJA, updateComponents: { surfaceId: SURFACE_ID, components } },
    { version: A2UI_VERZIJA, updateDataModel: { surfaceId: SURFACE_ID, value: podaci } },
  ];
}

/** Sve poruke za prvo iscrtavanje ekrana. */
export function porukeEkrana(
  r: Rezultat,
  stanice: Pick<Stanica, "id" | "naziv">[],
  sada: Date,
  opcije: OpcijeEkrana = {},
) {
  return [porukaKreiranja(), ...porukeAzuriranja(r, stanice, sada, opcije)];
}

/** A2UI poruke kao MCP embedded resource u rezultatu alata. */
export function a2uiResurs(poruke: unknown[]) {
  return {
    type: "resource" as const,
    resource: { uri: `a2ui://${SURFACE_ID}`, mimeType: A2UI_MIME_TYPE, text: JSON.stringify(poruke) },
  };
}
