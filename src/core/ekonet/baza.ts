/**
 * K1 klijent nad našom bazom (EKONET_IZVOR=baza): stanice su uređaji za vazduh iz tabele `uredjaj`
 * (Open-Meteo model i Sensor.Community senzori), merenja iz `merenje_vazduha`. Bazu puni uvoz
 * (src/core/baza/uvoz). Prognozirane vrednosti se nikad ne vraćaju kao merenja.
 *
 * Isti ugovor kao demo i budući ekoNET klijent, pa K2, K3, server i ekrani rade bez izmena.
 */
import type { BazaVazduhaIVremena, RedVazduhaIzBaze, UredjajVazduha } from "../baza/index.js";
import { JEDINICA_PM, type EkonetKlijent, type Merenje, type Stanica, type Velicina } from "../tipovi.js";
import { GreskaEkonet } from "./greske.js";
import { ocistiMerenja } from "./normalizuj.js";

const SAT_MS = 60 * 60 * 1000;

/** Naziv za korisnika: model je „Novi Sad (model Open-Meteo)“, senzor „Senzor #66763“. */
export function nazivStanice(u: UredjajVazduha): string {
  if (u.izvor === "open-meteo") return `${u.lokacija?.replace(/\s*\(.*\)$/, "") ?? "Novi Sad"} (model Open-Meteo)`;
  const broj = u.id.replace(/^sc-/, "");
  return u.izvor === "sensor-community" ? `Senzor Sensor.Community #${broj}` : u.naziv;
}

export function uStanicu(u: UredjajVazduha): Stanica | null {
  if (u.lat === null || u.lon === null) return null;
  const velicine: Velicina[] = [];
  if (u.imaPm25) velicine.push("PM2.5");
  if (u.imaPm10) velicine.push("PM10");
  return {
    id: u.id,
    naziv: nazivStanice(u),
    lokacija: { lat: u.lat, lon: u.lon, ...(u.lokacija ? { opis: u.lokacija } : {}) },
    velicine,
  };
}

/** Red iz baze → merenja K1 (samo veličine koje postoje; nedostajuća se ne izmišlja). */
export function uMerenja(r: RedVazduhaIzBaze): Merenje[] {
  const m: Merenje[] = [];
  if (r.pm25 !== null) m.push({ stanicaId: r.uredjajId, velicina: "PM2.5", vrednost: r.pm25, jedinica: JEDINICA_PM, vreme: r.vreme });
  if (r.pm10 !== null) m.push({ stanicaId: r.uredjajId, velicina: "PM10", vrednost: r.pm10, jedinica: JEDINICA_PM, vreme: r.vreme });
  return m;
}

export function napraviKlijentIzBaze(baza: BazaVazduhaIVremena, sada: () => Date): EkonetKlijent {
  async function stanice(): Promise<Stanica[]> {
    return (await baza.uredjajiVazduha()).flatMap((u) => {
      const s = uStanicu(u);
      return s ? [s] : [];
    });
  }

  async function proveriStanicu(stationId: string): Promise<void> {
    if (!(await stanice()).some((s) => s.id === stationId)) {
      throw new GreskaEkonet("nepoznata_stanica", `Stanica "${stationId}" ne postoji u bazi.`);
    }
  }

  return {
    getStations: stanice,

    async getLatest(stationId) {
      await proveriStanicu(stationId);
      const r = await baza.poslednjiVazduh(stationId, sada());
      return r ? ocistiMerenja(uMerenja(r)) : [];
    },

    async getHistory(stationId, hours = 24) {
      if (!Number.isFinite(hours) || hours <= 0) {
        throw new RangeError(`hours mora biti pozitivan broj, a dobijeno je ${hours}.`);
      }
      await proveriStanicu(stationId);
      const doV = sada();
      const redovi = await baza.vazduh(stationId, new Date(doV.getTime() - hours * SAT_MS), doV);
      return ocistiMerenja(redovi.flatMap(uMerenja));
    },
  };
}
