/**
 * Demo K1 klijent nad jednim scenarijom iz fixtures/ (FR-14). Bez I/O-a.
 *
 * Svi scenariji koriste istu stanicu (`demo-liman`), pa se klijent pravi za jedan
 * scenario. „Sada“ je `scenario.sada`, ne stvarni sat, da bi demo uvek davao isto.
 */
import type { DemoScenario, EkonetKlijent, Merenje, Velicina } from "../tipovi.js";
import { GreskaEkonet } from "./greske.js";
import { ocistiMerenja } from "./normalizuj.js";

const SAT_MS = 60 * 60 * 1000;
const REDOSLED_VELICINA: readonly Velicina[] = ["PM2.5", "PM10"];

export function napraviDemoKlijent(scenario: DemoScenario): EkonetKlijent {
  const sada = Date.parse(scenario.sada);
  // Merenja posle „sada“ scenarija se ne vide, kao što se ne vidi budućnost.
  const merenja = ocistiMerenja(scenario.merenja).filter((m) => Date.parse(m.vreme) <= sada);

  function proveriStanicu(stationId: string): void {
    if (stationId !== scenario.stanica.id) {
      throw new GreskaEkonet("nepoznata_stanica", `Stanica "${stationId}" ne postoji u demo scenariju.`);
    }
  }

  return {
    async getStations() {
      return [structuredClone(scenario.stanica)];
    },

    async getLatest(stationId) {
      proveriStanicu(stationId);
      const poslednje = new Map<Velicina, Merenje>();
      for (const m of merenja) poslednje.set(m.velicina, m); // sortirano, pa ostaje najnovije
      return REDOSLED_VELICINA.flatMap((v) => {
        const m = poslednje.get(v);
        return m ? [{ ...m }] : [];
      });
    },

    async getHistory(stationId, hours = 24) {
      proveriStanicu(stationId);
      if (!Number.isFinite(hours) || hours <= 0) {
        throw new RangeError(`hours mora biti pozitivan broj, a dobijeno je ${hours}.`);
      }
      const od = sada - hours * SAT_MS;
      return merenja.filter((m) => Date.parse(m.vreme) > od).map((m) => ({ ...m }));
    },
  };
}
