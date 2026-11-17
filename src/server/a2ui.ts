/**
 * Verzija B (PROBA, T03): pravljenje A2UI poruka na serveru.
 *
 * Server deterministički (bez LLM-a) pretvara procenu u A2UI v0.9 poruke:
 * - createSurface + updateComponents opisuju izgled ekrana (jednom),
 * - updateDataModel nosi podatke; „Osveži“ šalje samo novi updateDataModel.
 *
 * Za sada koristi demo scenarije iz fixtures/ i modul pravila. Kad Sarin server (T09)
 * bude vraćao pun `Rezultat`, `podaciZaPrikaz` će se praviti iz njega (T12).
 */
import fs from "node:fs";
import path from "node:path";
import { proceni } from "../core/pravila/index.js";
import type { DemoScenario, ProcenaPravila, Velicina } from "../core/tipovi.js";
import { prikazDatumVreme } from "../core/vreme.js";

export const A2UI_MIME_TYPE = "application/a2ui+json";
export const A2UI_VERZIJA = "v0.9";
export const BASIC_CATALOG_ID = "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json";
export const SURFACE_ID = "kvalitet-vazduha";

const FIXTURES_DIR = path.join(import.meta.dirname, "..", "..", "fixtures");

export const DEMO_SCENARIJI = [
  "s1-dobar",
  "s2-los",
  "s3-zastareo",
  "s4-bez-pm25",
  "s5-llm-greska",
  "s6-bez-podataka",
] as const;
export type DemoScenarioId = (typeof DEMO_SCENARIJI)[number];

/** Podaci koje ekran prikazuje – ovo ide u A2UI data model. */
export interface PodaciZaPrikaz {
  stanica: string;
  pm25: string;
  pm10: string;
  vreme: string;
  kategorija: string;
  poruka: string;
  pravilo: string;
}

function ucitajScenario(id: DemoScenarioId): DemoScenario {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, `${id}.json`), "utf8"));
}

function poslednjaVrednost(s: DemoScenario, v: Velicina): string {
  const m = s.merenja.filter((x) => x.velicina === v).at(-1);
  return m ? `${m.vrednost} ${m.jedinica}` : "nije dostupno"; // FR-04: nikad 0
}

function tekstKategorije(p: ProcenaPravila): string {
  if (p.status !== "ok" || !p.category) return "Bez preporuke";
  return `${p.category.naziv} (nivo ${p.category.nivo}/6, određuje ${p.category.odredjujuca})`;
}

/** Procena za demo scenario, spremna za prikaz. */
export function podaciZaPrikaz(id: DemoScenarioId): PodaciZaPrikaz {
  const s = ucitajScenario(id);
  const p = proceni(s.merenja, new Date(s.sada));
  return {
    stanica: s.stanica.naziv,
    pm25: poslednjaVrednost(s, "PM2.5"),
    pm10: poslednjaVrednost(s, "PM10"),
    vreme: p.measuredAt ? prikazDatumVreme(new Date(p.measuredAt)) : "nema merenja",
    kategorija: tekstKategorije(p),
    poruka: p.message ?? p.napomena ?? "",
    pravilo: p.rule,
  };
}

// ─── A2UI poruke ────────────────────────────────────────────────────────────

const tekst = (id: string, putanja: string, variant = "body") => ({
  id,
  component: "Text",
  text: { path: putanja },
  variant,
});

/** Izgled ekrana. Vrednosti nisu ovde, nego se vezuju za data model preko `path`. */
function komponente(scenarioId: DemoScenarioId) {
  return [
    { id: "root", component: "Card", child: "kolona" },
    {
      id: "kolona",
      component: "Column",
      children: ["naslov", "stanica", "vrednosti", "vreme", "razdelnik", "kategorija", "poruka", "pravilo", "osvezi"],
    },
    { id: "naslov", component: "Text", text: "Kvalitet vazduha", variant: "h2" },
    tekst("stanica", "/stanica", "h4"),
    { id: "vrednosti", component: "Row", children: ["pm25", "pm10"], justify: "spaceBetween" },
    {
      id: "pm25",
      component: "Text",
      text: { call: "formatString", args: { value: "PM2.5: ${/pm25}" }, returnType: "string" },
    },
    {
      id: "pm10",
      component: "Text",
      text: { call: "formatString", args: { value: "PM10: ${/pm10}" }, returnType: "string" },
    },
    {
      id: "vreme",
      component: "Text",
      text: { call: "formatString", args: { value: "Merenje: ${/vreme}" }, returnType: "string" },
      variant: "caption",
    },
    { id: "razdelnik", component: "Divider" },
    tekst("kategorija", "/kategorija", "h3"),
    tekst("poruka", "/poruka"),
    tekst("pravilo", "/pravilo", "caption"),
    {
      id: "osvezi",
      component: "Button",
      child: "osvezi-tekst",
      variant: "primary",
      action: { event: { name: "osvezi", context: { scenario: scenarioId } } },
    },
    { id: "osvezi-tekst", component: "Text", text: "Osveži" },
  ];
}

export function porukaPodaci(podaci: PodaciZaPrikaz) {
  return { version: A2UI_VERZIJA, updateDataModel: { surfaceId: SURFACE_ID, value: podaci } };
}

/** Sve poruke za prvo iscrtavanje ekrana. */
export function porukeEkrana(scenarioId: DemoScenarioId) {
  return [
    { version: A2UI_VERZIJA, createSurface: { surfaceId: SURFACE_ID, catalogId: BASIC_CATALOG_ID } },
    { version: A2UI_VERZIJA, updateComponents: { surfaceId: SURFACE_ID, components: komponente(scenarioId) } },
    porukaPodaci(podaciZaPrikaz(scenarioId)),
  ];
}

/** A2UI poruke kao MCP embedded resource u rezultatu alata. */
export function a2uiResurs(poruke: unknown[]) {
  return {
    type: "resource" as const,
    resource: { uri: `a2ui://${SURFACE_ID}`, mimeType: A2UI_MIME_TYPE, text: JSON.stringify(poruke) },
  };
}
