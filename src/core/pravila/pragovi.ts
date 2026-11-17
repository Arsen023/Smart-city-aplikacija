/**
 * Konfiguracija modula pravila (K2).
 *
 * EAQI pragovi su prepisani iz zvanične EEA tabele (revizija 2024, ETC HE 2024/17):
 * https://airindex.eea.europa.eu/AQI/index.html
 * Tabela je u celim brojevima µg/m³; vrednost se pre poređenja zaokružuje na ceo broj.
 */
import type { NazivKategorije, NivoKategorije, Velicina } from "../tipovi.js";

/** Gornja granica (uključivo) za nivoe 1–5. Sve iznad poslednje je nivo 6. */
export const EAQI_GORNJE_GRANICE: Record<Velicina, readonly [number, number, number, number, number]> = {
  "PM2.5": [5, 15, 50, 90, 140],
  PM10: [15, 45, 120, 195, 270],
};

export const NAZIVI_KATEGORIJA: Record<NivoKategorije, NazivKategorije> = {
  1: "Dobar",
  2: "Zadovoljavajući",
  3: "Umeren",
  4: "Loš",
  5: "Veoma loš",
  6: "Izuzetno loš",
};

export type PeriodUsrednjavanja = "sat" | "24h";

export interface KonfiguracijaPravila {
  /** Poslednje merenje starije od ovoga → status "stale" (spec 6.3, placeholder [2 h]). */
  pragSvezineMinuta: number;
  /** Koliko merenja API šalje po satu (1 = satni podaci, 4 = na 15 min…). */
  ocekivanihMerenjaPoSatu: number;
  /** Satni prosek važi ako ima bar ovoliki udeo očekivanih merenja (spec 6.2, [75 %]). */
  minPokrivenost: number;
  /** "sat" = poslednja satna vrednost (EAQI 2024); "24h" = 24-časovni prosek (za poređenje). */
  period: PeriodUsrednjavanja;
}

export const PODRAZUMEVANA_KONFIGURACIJA: KonfiguracijaPravila = {
  pragSvezineMinuta: 120,
  ocekivanihMerenjaPoSatu: 1,
  minPokrivenost: 0.75,
  period: "sat",
};

/** Redosled kojim se razrešava nerešeno (isti nivo za obe veličine). */
export const PRACENE_VELICINE: readonly Velicina[] = ["PM2.5", "PM10"];
