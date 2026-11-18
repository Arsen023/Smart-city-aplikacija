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
import type { Rezultat, SatnaVrednost, Stanica } from "../core/tipovi.js";
import { prikazDatumVreme } from "../core/vreme.js";
import { KATALOG_ID, KOMPONENTA_GRAFIKON, KOMPONENTA_KATEGORIJA } from "../ui-b/katalog-id.js";
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
  vreme: string;
  kategorija: { naziv: string; nivo: number } | null;
  napomena: string;
  poruka: string;
  savet: string;
  osnov: string;
  pravilo: string;
  istorija: SatnaVrednost[];
  osvezeno: string;
}

/** „pre 20 min“, „pre 3 h“, „pre 2 dana“ – koliko je prošlo od merenja (spec 8.1, element 3). */
export function protekloVreme(measuredAt: string, sada: Date): string {
  const min = Math.floor((sada.getTime() - Date.parse(measuredAt)) / 60_000);
  if (min < 1) return "upravo";
  if (min < 60) return `pre ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `pre ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "pre 1 dan" : `pre ${d} dana`;
}

function vremeOsvezavanja(sada: Date): string {
  return new Intl.DateTimeFormat("sr-Latn", {
    timeZone: "Europe/Belgrade",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(sada);
}

function vrednost(r: Rezultat, velicina: "PM2.5" | "PM10"): string {
  const v = r.values.find((x) => x.velicina === velicina) ?? { velicina, vrednost: null, jedinica: "µg/m³" as const };
  return tekstVrednosti(v); // isti format kao u content tekstu ("PM2.5 3,7 µg/m³" / "PM2.5 nije dostupno")
}

/**
 * Podaci za ekran iz Rezultat-a.
 * @param sada  „sada“ iz zavisnosti (u demo režimu vreme scenarija) – za „pre X min“
 * @param osvezeno stvarno vreme kad je server napravio podatke
 */
export function podaciEkrana(r: Rezultat, sada: Date, osvezeno: Date = new Date()): PodaciEkrana {
  const ok = r.status === "ok" && r.category !== null;
  return {
    izbor: r.station.id ? [r.station.id] : [],
    stanica: r.station.naziv,
    pm25: vrednost(r, "PM2.5"),
    pm10: vrednost(r, "PM10"),
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

/** Izgled ekrana. Struktura zavisi od statusa; vrednosti dolaze iz data modela. */
export function komponente(r: Rezultat, stanice: Pick<Stanica, "id" | "naziv">[], podaci: PodaciEkrana): Komponenta[] {
  const ok = podaci.kategorija !== null;
  const imaIstoriju = podaci.istorija.length > 0;

  const telo: string[] = ["naslov", "izbor-red", "stanica", "vrednosti", "vreme", "razdelnik"];
  if (ok) telo.push("kategorija");
  if (podaci.napomena) telo.push("napomena");
  if (podaci.poruka) telo.push("poruka");
  if (imaIstoriju) telo.push("grafikon");
  if (podaci.savet) telo.push("savet", "osnov");
  if (podaci.pravilo) telo.push("pravilo");
  telo.push("dno");

  // Izbor stanice: ako stanica iz rezultata nije u listi (npr. greška), ipak je prikaži.
  const opcije = stanice.map((s) => ({ label: s.naziv, value: s.id }));
  if (r.station.id && !opcije.some((o) => o.value === r.station.id)) {
    opcije.unshift({ label: r.station.naziv, value: r.station.id });
  }

  const sve: Komponenta[] = [
    { id: "root", component: "Card", child: "kolona" },
    { id: "kolona", component: "Column", children: telo },
    { id: "naslov", component: "Text", text: "Kvalitet vazduha za šetnju i trening", variant: "h3" },

    // 1. Izbor stanice
    { id: "izbor-red", component: "Row", children: ["izbor", "prikazi"], align: "center", justify: "spaceBetween" },
    {
      id: "izbor",
      component: "ChoicePicker",
      label: "Merna stanica",
      variant: "mutuallyExclusive",
      displayStyle: "chips",
      options: opcije,
      value: { path: "/izbor" },
    },
    {
      id: "prikazi",
      component: "Button",
      child: "prikazi-tekst",
      action: { event: { name: AKCIJA_IZABERI, context: { izbor: { path: "/izbor" } } } },
    },
    { id: "prikazi-tekst", component: "Text", text: "Prikaži" },
    tekst("stanica", "/stanica", "h4"),

    // 2. Vrednosti, 3. vreme merenja
    { id: "vrednosti", component: "Row", children: ["pm25", "pm10"], justify: "spaceBetween" },
    tekst("pm25", "/pm25"),
    tekst("pm10", "/pm10"),
    tekst("vreme", "/vreme", "caption"),
    { id: "razdelnik", component: "Divider" },

    // 4. Kategorija (sopstvena komponenta: boja + naziv)
    {
      id: "kategorija",
      component: KOMPONENTA_KATEGORIJA,
      naziv: { path: "/kategorija/naziv" },
      nivo: { path: "/kategorija/nivo" },
    },
    tekst("napomena", "/napomena", "caption"),
    tekst("poruka", "/poruka", "h5"),

    // 5. Grafikon (sopstvena komponenta)
    { id: "grafikon", component: KOMPONENTA_GRAFIKON, tacke: { path: "/istorija" }, jedinica: "µg/m³" },

    // 6. Savet, 7. osnov
    tekst("savet", "/savet"),
    tekst("osnov", "/osnov", "caption"),
    tekst("pravilo", "/pravilo", "caption"),

    // Osveži (FR-15)
    { id: "dno", component: "Row", children: ["osvezi", "osvezeno"], align: "center", justify: "spaceBetween" },
    {
      id: "osvezi",
      component: "Button",
      child: "osvezi-tekst",
      variant: "primary",
      action: { event: { name: AKCIJA_OSVEZI, context: { izbor: { path: "/izbor" } } } },
    },
    { id: "osvezi-tekst", component: "Text", text: "Osveži" },
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

/** Izgled + podaci. Koristi se i za prvo crtanje i za osvežavanje. */
export function porukeAzuriranja(r: Rezultat, stanice: Pick<Stanica, "id" | "naziv">[], sada: Date, osvezeno?: Date) {
  const podaci = podaciEkrana(r, sada, osvezeno);
  return [
    { version: A2UI_VERZIJA, updateComponents: { surfaceId: SURFACE_ID, components: komponente(r, stanice, podaci) } },
    { version: A2UI_VERZIJA, updateDataModel: { surfaceId: SURFACE_ID, value: podaci } },
  ];
}

/** Sve poruke za prvo iscrtavanje ekrana. */
export function porukeEkrana(r: Rezultat, stanice: Pick<Stanica, "id" | "naziv">[], sada: Date, osvezeno?: Date) {
  return [porukaKreiranja(), ...porukeAzuriranja(r, stanice, sada, osvezeno)];
}

/** A2UI poruke kao MCP embedded resource u rezultatu alata. */
export function a2uiResurs(poruke: unknown[]) {
  return {
    type: "resource" as const,
    resource: { uri: `a2ui://${SURFACE_ID}`, mimeType: A2UI_MIME_TYPE, text: JSON.stringify(poruke) },
  };
}
