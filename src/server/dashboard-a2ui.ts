/**
 * Data model za izvorni A2UI u chatu (verzija B) iz podataka kontrolne table (get_dashboard).
 * Sve vrednosti formatira server – chat i AI ih samo vezuju preko putanja (pravila 1, 5 i 7).
 *
 * Putanje su opisane u src/zajednicko/a2ui-katalog.ts (PUTANJE_DASHBOARDA, PUTANJE_DASHBOARD_KOMPONENTI);
 * vazduh koristi iste putanje kao ekran procene (podaciEkrana), bez saveta (LLM se ovde ne zove).
 */
import { JEDINICA_PM, type Rezultat } from "../core/tipovi.js";
import { prikazDatumVreme } from "../core/vreme.js";
import type { SatPrognoze, TackaMape, TackaNiza } from "../zajednicko/a2ui-katalog.js";
import { podaciEkrana } from "./a2ui.js";
import type { Dashboard, SatVremena, VazduhDashboard } from "./dashboard-alati.js";

const broj = new Intl.NumberFormat("sr-Latn", { maximumFractionDigits: 1 });
const SAT = new Intl.DateTimeFormat("sr-Latn", { timeZone: "Europe/Belgrade", hour: "2-digit", minute: "2-digit", hour12: false });

/** Vrednost sa jedinicom ili „nije dostupno“ – nikad 0 (pravilo 5). */
export function sa(n: number | null | undefined, jedinica: string): string {
  return n === null || n === undefined ? "nije dostupno" : `${broj.format(n)}${jedinica ? ` ${jedinica}` : ""}`;
}

const sat = (iso: string) => SAT.format(new Date(iso));

/** Vazduh sa table kao Rezultat, da bi se koristile iste putanje i isti format kao ekran procene. */
function kaoRezultat(v: VazduhDashboard): Rezultat {
  return {
    status: v.status,
    station: v.stanica,
    measuredAt: v.measuredAt,
    values: [
      { velicina: "PM2.5", vrednost: v.pm25, jedinica: JEDINICA_PM },
      { velicina: "PM10", vrednost: v.pm10, jedinica: JEDINICA_PM },
    ],
    history: v.istorija.map(({ vreme, pm25, pm10 }) => ({ vreme, pm25, pm10 })),
    category: v.category,
    rule: "",
    advice: null,
    message: v.message,
    napomena: null,
  };
}

function niz<T>(redovi: T[], oznaka: (r: T) => string, vrednost: (r: T) => number | null): TackaNiza[] {
  return redovi.map((r) => ({ oznaka: oznaka(r), vrednost: vrednost(r) }));
}

function prognoza(sati: SatVremena[]): SatPrognoze[] {
  return sati.slice(0, 8).map((p) => ({ sat: sat(p.vreme), ikona: p.ikona, temperatura: sa(p.temperaturaC, "°C"), opis: p.opis }));
}

export function podaciA2uiDashboarda(d: Dashboard, sada: Date): Record<string, unknown> {
  const vazduh = d.vazduh ? podaciEkrana(kaoRezultat(d.vazduh), sada, sada) : {};
  // Bez saveta (dashboard ne zove LLM) – savet dolazi samo iz assess_air_quality_a2ui.
  const { savet: _s, osnov: _o, poruka: _p, ...vazduhBezSaveta } = vazduh as Record<string, unknown>;
  void _s;
  void _o;
  void _p;

  const t = d.vreme?.trenutno ?? null;
  const prosla = d.vreme?.protekla24h ?? [];
  const voda = d.voda;
  const m = voda?.poslednje ?? null;
  const senzori: TackaMape[] = d.senzori.map((s) => ({
    naziv: s.naziv,
    lat: s.lat,
    lon: s.lon,
    nivo: s.category?.nivo ?? null,
    kategorija: s.category?.naziv ?? (s.status === "stale" ? "Zastareli podaci" : "Bez procene"),
    opis: `PM2.5 ${sa(s.pm25, "µg/m³")} · PM10 ${sa(s.pm10, "µg/m³")}`,
    model: s.vrsta === "model",
  }));
  const brojModela = senzori.filter((s) => s.model).length;

  return {
    ...vazduhBezSaveta,
    meteo: {
      temperatura: sa(t?.temperaturaC, "°C"),
      opis: t?.opis ?? "nije dostupno",
      ikona: t?.ikona ?? "",
      vlaznost: sa(t?.vlaznostProc, "%"),
      vetar: sa(t?.vetarKmh, "km/h"),
      padavine: sa(t?.padavineMm, "mm"),
      vremeMerenja: t ? `${prikazDatumVreme(new Date(t.vreme))} · Open-Meteo (model)` : "Vreme nije dostupno",
      prognoza: prognoza(d.vreme?.prognoza ?? []),
      temperatura24h: niz(prosla, (r) => sat(r.vreme), (r) => r.temperaturaC),
      vlaznost24h: niz(prosla, (r) => sat(r.vreme), (r) => r.vlaznostProc),
    },
    voda: {
      uredjaj: voda?.uredjaj.naziv ?? "nije dostupno",
      kiseonik: sa(m?.dox, "mg/L"),
      zasicenje: sa(m?.doxZasicenje, "%"),
      ph: sa(m?.ph, ""),
      temperatura: sa(m?.temperaturaC, "°C"),
      vremeMerenja: m ? `Poslednje merenje: ${prikazDatumVreme(new Date(m.vreme))}` : "Voda nije dostupna",
      kiseonik24h: niz(voda?.istorija ?? [], (r) => sat(r.vreme), (r) => r.dox),
      ph24h: niz(voda?.istorija ?? [], (r) => sat(r.vreme), (r) => r.ph),
      temperatura24h: niz(voda?.istorija ?? [], (r) => sat(r.vreme), (r) => r.temperaturaC),
    },
    senzori,
    senzoriOpis: senzori.length
      ? `Na mapi: ${senzori.length - brojModela} senzora (Sensor.Community)${brojModela ? " i model Open-Meteo" : ""}`
      : "Nema senzora na mapi",
  };
}

/** Koji delovi podataka postoje – AI ih dobija u uputstvu, da ne veže prazne delove. */
export function deloviDashboarda(d: Dashboard): string[] {
  const delovi: string[] = [];
  if (d.vazduh) delovi.push("vazduh");
  if (d.vreme?.trenutno) delovi.push("vreme");
  if (d.voda?.poslednje) delovi.push("voda");
  if (d.senzori.length) delovi.push("senzori");
  return delovi;
}
