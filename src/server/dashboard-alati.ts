/**
 * MCP alati za dashboard i vreme:
 * - `get_dashboard` (samo za ekran/host): sve za kontrolnu tablu u jednom pozivu – vazduh (procena K2,
 *   bez LLM saveta), senzori za mapu, vreme i prognoza, poslednje stanje vode.
 * - `get_weather` (i za model): trenutno vreme i prognoza po satima, da chat odgovori „kakvo je vreme“.
 *
 * Svaki deo se puni posebno: ako baza ili izvor ne radi, taj deo je `null`, a razlog je u `greske`.
 * Kategoriju računa samo src/core/pravila (pravilo 1); ovde nema pragova.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  GreskaBaze,
  type BazaVazduhaIVremena,
  type BazaVode,
  type MerenjeVode,
  type RedVremenaIzBaze,
} from "../core/baza/index.js";
import { podindeks, satneVrednosti } from "../core/pravila/index.js";
import type { Kategorija, NivoKategorije, SatnaVrednost, Status } from "../core/tipovi.js";
import { isoBeograd, prikazDatumVreme } from "../core/vreme.js";
import { opisVremena } from "../zajednicko/vreme-kodovi.js";
import type { DobijZavisnosti } from "./alati.js";
import { deloviDashboarda, podaciA2uiDashboarda } from "./dashboard-a2ui.js";
import { porukaGreske, proceniKvalitet } from "./procena.js";

export type DobijBazuVV = () => Promise<BazaVazduhaIVremena>;
export type DobijBazuVode = () => Promise<BazaVode>;

const SAT_MS = 3_600_000;

// ─── Tipovi odgovora (structuredContent) ────────────────────────────────────

export interface SatVazduha extends SatnaVrednost {
  /** EAQI nivo tog sata (gora od dve veličine), `null` kad nema vrednosti. */
  nivo: NivoKategorije | null;
}

export interface VazduhDashboard {
  stanica: { id: string; naziv: string };
  status: Status;
  measuredAt: string | null;
  category: Kategorija | null;
  pm25: number | null;
  pm10: number | null;
  message: string | null;
  istorija: SatVazduha[];
}

export interface Senzor {
  id: string;
  naziv: string;
  lat: number;
  lon: number;
  vrsta: "model" | "senzor";
  status: Status;
  category: Kategorija | null;
  pm25: number | null;
  pm10: number | null;
  measuredAt: string | null;
}

export interface SatVremena {
  vreme: string;
  temperaturaC: number | null;
  vlaznostProc: number | null;
  vetarKmh: number | null;
  padavineMm: number | null;
  vremeKod: number | null;
  opis: string;
  ikona: string;
}

export interface VremeDashboard {
  trenutno: SatVremena | null;
  /** Sledeći sati (prognoza), najviše 12. */
  prognoza: SatVremena[];
  /** Poslednja 24 h (za mini-grafikone). */
  protekla24h: SatVremena[];
}

export interface VodaDashboard {
  uredjaj: { id: string; naziv: string };
  poslednje: MerenjeVode | null;
  istorija: MerenjeVode[];
}

export interface Dashboard {
  azurirano: string;
  vazduh: VazduhDashboard | null;
  senzori: Senzor[];
  vreme: VremeDashboard | null;
  voda: VodaDashboard | null;
  greske: string[];
}

// ─── Čiste funkcije ─────────────────────────────────────────────────────────

/** EAQI nivo jednog sata: gora od dve veličine (isto pravilo kao K2). */
export function nivoSata(s: SatnaVrednost): NivoKategorije | null {
  const nivoi = [
    s.pm25 === null ? null : podindeks("PM2.5", s.pm25),
    s.pm10 === null ? null : podindeks("PM10", s.pm10),
  ].filter((n): n is NivoKategorije => n !== null);
  return nivoi.length ? (Math.max(...nivoi) as NivoKategorije) : null;
}

export function uSatVremena(r: RedVremenaIzBaze): SatVremena {
  const o = opisVremena(r.vremeKod);
  return {
    vreme: r.vreme,
    temperaturaC: r.temperaturaC,
    vlaznostProc: r.vlaznostProc,
    vetarKmh: r.vetarKmh,
    padavineMm: r.padavineMm,
    vremeKod: r.vremeKod,
    opis: o.opis,
    ikona: o.ikona,
  };
}

/** Trenutno = poslednji sat koji nije prognoza; prognoza = naredni sati. */
export function podeliVreme(redovi: RedVremenaIzBaze[], sada: Date, satiPrognoze = 12): VremeDashboard {
  const prosli = redovi.filter((r) => !r.prognoza && Date.parse(r.vreme) <= sada.getTime());
  const buduci = redovi.filter((r) => r.prognoza || Date.parse(r.vreme) > sada.getTime());
  const trenutni = prosli.at(-1);
  return {
    trenutno: trenutni ? uSatVremena(trenutni) : null,
    prognoza: buduci.slice(0, satiPrognoze).map(uSatVremena),
    protekla24h: prosli.filter((r) => Date.parse(r.vreme) > sada.getTime() - 24 * SAT_MS).map(uSatVremena),
  };
}

const SAT = new Intl.DateTimeFormat("sr-Latn", { timeZone: "Europe/Belgrade", hour: "2-digit", minute: "2-digit", hour12: false });

const broj = new Intl.NumberFormat("sr-Latn", { maximumFractionDigits: 1 });
const v = (n: number | null, jed: string) => (n === null ? "nije dostupno" : `${broj.format(n)} ${jed}`);

export function tekstVremena(vr: VremeDashboard): string {
  const t = vr.trenutno;
  if (!t) return "Podaci o vremenu trenutno nisu dostupni.";
  const prognoza = vr.prognoza
    .slice(0, 6)
    .map((p) => `${SAT.format(new Date(p.vreme))} ${v(p.temperaturaC, "°C")} ${p.opis.toLowerCase()}`)
    .join(", ");
  return (
    `Vreme u Novom Sadu (${prikazDatumVreme(new Date(t.vreme))}, model Open-Meteo): ${t.opis.toLowerCase()}, ` +
    `temperatura ${v(t.temperaturaC, "°C")}, vlažnost ${v(t.vlaznostProc, "%")}, vetar ${v(t.vetarKmh, "km/h")}, ` +
    `padavine ${v(t.padavineMm, "mm")}.` +
    (prognoza ? ` Prognoza: ${prognoza}.` : "")
  );
}

// ─── Punjenje delova ────────────────────────────────────────────────────────

async function vazduhISenzori(dobijZavisnosti: DobijZavisnosti): Promise<{ vazduh: VazduhDashboard | null; senzori: Senzor[] }> {
  const z = await dobijZavisnosti();
  const stanice = await z.klijent.getStations();
  const rezultati = await Promise.all(stanice.map((s) => proceniKvalitet({ ...z, log: () => {} }, s.id, { savet: false })));
  const vrednost = (r: (typeof rezultati)[number], vel: "PM2.5" | "PM10") =>
    r.values.find((x) => x.velicina === vel)?.vrednost ?? null;

  const senzori: Senzor[] = stanice.map((s, i) => {
    const r = rezultati[i]!;
    return {
      id: s.id,
      naziv: s.naziv,
      lat: s.lokacija.lat,
      lon: s.lokacija.lon,
      vrsta: s.id.startsWith("open-meteo") ? "model" : "senzor",
      status: r.status,
      category: r.category,
      pm25: vrednost(r, "PM2.5"),
      pm10: vrednost(r, "PM10"),
      measuredAt: r.measuredAt,
    };
  });

  const glavni = rezultati[0];
  const vazduh: VazduhDashboard | null = glavni
    ? {
        stanica: glavni.station,
        status: glavni.status,
        measuredAt: glavni.measuredAt,
        category: glavni.category,
        pm25: vrednost(glavni, "PM2.5"),
        pm10: vrednost(glavni, "PM10"),
        message: glavni.message,
        istorija: glavni.history.map((h) => ({ ...h, nivo: nivoSata(h) })),
      }
    : null;
  return { vazduh, senzori };
}

async function voda(dobijBazuVode: DobijBazuVode): Promise<VodaDashboard | null> {
  const baza = await dobijBazuVode();
  const [uredjaj] = await baza.uredjaji();
  if (!uredjaj) return null;
  const [poslednje, istorija] = await Promise.all([baza.poslednjeMerenje(uredjaj.id), baza.istorija(uredjaj.id, 24)]);
  return { uredjaj: { id: uredjaj.id, naziv: uredjaj.naziv }, poslednje, istorija };
}

async function vreme(dobijBazuVV: DobijBazuVV, sada: Date): Promise<VremeDashboard> {
  const baza = await dobijBazuVV();
  const redovi = await baza.vreme(new Date(sada.getTime() - 25 * SAT_MS), new Date(sada.getTime() + 13 * SAT_MS));
  return podeliVreme(redovi, sada);
}

function razlog(deo: string, e: unknown): string {
  return `${deo}: ${e instanceof GreskaBaze ? e.message : porukaGreske(e)}`;
}

export async function napraviDashboard(
  dobijZavisnosti: DobijZavisnosti,
  dobijBazuVV: DobijBazuVV,
  dobijBazuVode: DobijBazuVode,
  sada: Date = new Date(),
): Promise<Dashboard> {
  const greske: string[] = [];
  const [vs, vr, vo] = await Promise.allSettled([
    vazduhISenzori(dobijZavisnosti),
    vreme(dobijBazuVV, sada),
    voda(dobijBazuVode),
  ]);
  if (vs.status === "rejected") greske.push(razlog("Vazduh", vs.reason));
  if (vr.status === "rejected") greske.push(razlog("Vreme", vr.reason));
  if (vo.status === "rejected") greske.push(razlog("Voda", vo.reason));
  return {
    azurirano: isoBeograd(sada),
    vazduh: vs.status === "fulfilled" ? vs.value.vazduh : null,
    senzori: vs.status === "fulfilled" ? vs.value.senzori : [],
    vreme: vr.status === "fulfilled" ? vr.value : null,
    voda: vo.status === "fulfilled" ? vo.value : null,
    greske,
  };
}

function tekstDashboarda(d: Dashboard): string {
  const delovi = [
    d.vazduh
      ? `Vazduh (${d.vazduh.stanica.naziv}): ${d.vazduh.category ? d.vazduh.category.naziv : (d.vazduh.message ?? d.vazduh.status)}.`
      : "Vazduh: nije dostupno.",
    d.vreme ? tekstVremena(d.vreme) : "Vreme: nije dostupno.",
    d.voda?.poslednje
      ? `Voda (${d.voda.uredjaj.naziv}): poslednje merenje ${prikazDatumVreme(new Date(d.voda.poslednje.vreme))}.`
      : "Voda: nije dostupno.",
    `Senzora na mapi: ${d.senzori.length}.`,
  ];
  return delovi.join(" ");
}

// ─── Registracija ───────────────────────────────────────────────────────────

function tekst(t: string): CallToolResult["content"] {
  return [{ type: "text", text: t }];
}

export function registrujAlateDashboarda(
  server: McpServer,
  dobijZavisnosti: DobijZavisnosti,
  dobijBazuVV: DobijBazuVV,
  dobijBazuVode: DobijBazuVode,
): void {
  server.registerTool(
    "get_dashboard",
    {
      title: "Kontrolna tabla",
      description:
        "Returns everything for the dashboard in one call: air quality (rule-based category, no LLM advice), " +
        "sensors with coordinates for the map, weather with forecast and the latest water-quality state.",
      inputSchema: {},
      _meta: { ui: { visibility: ["app"] } },
    },
    async () => {
      const sada = new Date();
      const d = await napraviDashboard(dobijZavisnosti, dobijBazuVV, dobijBazuVode, sada);
      // `a2ui`: isti podaci kao data model za izvorni A2UI u chatu (verzija B) – vidi dashboard-a2ui.ts.
      return {
        content: tekst(tekstDashboarda(d)),
        structuredContent: { ...d, a2ui: { podaci: podaciA2uiDashboarda(d, sada), delovi: deloviDashboarda(d) } },
      };
    },
  );

  server.registerTool(
    "get_weather",
    {
      title: "Vreme i prognoza",
      description:
        "Current weather in Novi Sad (temperature, humidity, wind, precipitation, description) and the hourly forecast " +
        "for the next hours. Use for questions about weather, temperature, rain or wind.",
      inputSchema: {
        hours: z.number().int().min(1).max(12).default(6).describe("How many forecast hours, 1–12. Default 6."),
      },
    },
    async ({ hours }) => {
      try {
        const vr = await vreme(dobijBazuVV, new Date());
        const skraceno = { ...vr, prognoza: vr.prognoza.slice(0, hours), protekla24h: [] };
        return { content: tekst(tekstVremena(skraceno)), structuredContent: { ...skraceno } };
      } catch (e) {
        return { isError: true, content: tekst(razlog("Podaci o vremenu trenutno nisu dostupni", e)) };
      }
    },
  );
}
