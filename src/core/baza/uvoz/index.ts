/**
 * Jedan krug uvoza iz svih javnih izvora. Koriste ga skripta `npm run baza:uvoz` i server
 * (periodični uvoz kad je EKONET_IZVOR=baza). Svaki izvor posebno: ako jedan ne radi, ostali se upišu.
 */
import type { IzvrsiUpit } from "../index.js";
import {
  adresaOpenMeteoVazduh,
  adresaOpenMeteoVreme,
  adresaSensorCommunity,
  izOpenMeteoVazduha,
  izOpenMeteoVremena,
  izSensorCommunity,
  NOVI_SAD,
  type Lokacija,
  type PaketUvoza,
} from "./izvori.js";
import { upisi, type IshodUpisa } from "./upis.js";

export { NOVI_SAD, type Lokacija } from "./izvori.js";

interface Izvor {
  naziv: string;
  adresa: (l: Lokacija) => string;
  obradi: (json: unknown, l: Lokacija, sada: Date) => PaketUvoza;
}

export const IZVORI: readonly Izvor[] = [
  { naziv: "Open-Meteo vreme", adresa: adresaOpenMeteoVreme, obradi: izOpenMeteoVremena },
  { naziv: "Open-Meteo vazduh", adresa: adresaOpenMeteoVazduh, obradi: izOpenMeteoVazduha },
  { naziv: "Sensor.Community", adresa: adresaSensorCommunity, obradi: izSensorCommunity },
];

export type Preuzmi = (adresa: string) => Promise<unknown>;

/** Preuzimanje preko fetch-a, sa vremenskim ograničenjem. */
export const preuzmiJson: Preuzmi = async (adresa) => {
  const odgovor = await fetch(adresa, {
    headers: { "User-Agent": "smart-city-aplikacija (studentski prototip)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!odgovor.ok) throw new Error(`HTTP ${odgovor.status}`);
  return odgovor.json();
};

export type IshodIzvora = { izvor: string } & ({ ok: true; ishod: IshodUpisa } | { ok: false; greska: string });

export async function uvoziSve(
  izvrsi: IzvrsiUpit,
  opcije: { lokacija?: Lokacija; sada?: () => Date; preuzmi?: Preuzmi } = {},
): Promise<IshodIzvora[]> {
  const lokacija = opcije.lokacija ?? NOVI_SAD;
  const sada = opcije.sada ?? (() => new Date());
  const preuzmi = opcije.preuzmi ?? preuzmiJson;
  const rez: IshodIzvora[] = [];
  for (const izvor of IZVORI) {
    try {
      const json = await preuzmi(izvor.adresa(lokacija));
      rez.push({ izvor: izvor.naziv, ok: true, ishod: await upisi(izvrsi, izvor.obradi(json, lokacija, sada())) });
    } catch (e) {
      const uzrok = e instanceof Error && e.cause instanceof Error ? ` (${e.cause.message})` : "";
      rez.push({ izvor: izvor.naziv, ok: false, greska: `${e instanceof Error ? e.message : "greška"}${uzrok}` });
    }
  }
  return rez;
}

export function tekstIshoda(r: IshodIzvora): string {
  return r.ok
    ? `✓ ${r.izvor}: uređaja ${r.ishod.uredjaja}, vazduh ${r.ishod.vazduha} redova, vreme ${r.ishod.vremena} redova`
    : `✗ ${r.izvor}: ${r.greska}`;
}
