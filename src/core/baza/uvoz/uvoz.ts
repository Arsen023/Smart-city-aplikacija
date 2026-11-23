/**
 * Uvoz vremena i kvaliteta vazduha iz javnih izvora u bazu: `npm run baza:uvoz`.
 * Preduslov: db/01-sema.sql i db/03-vazduh-vreme.sql pokrenuti, DATABASE_URL u .env.
 *
 * Izvori ne traže ključ. Svaki izvor se uvozi posebno: ako jedan ne radi, ostali se ipak upišu.
 * Može se pokretati više puta (npr. svakih sat vremena) – istorija se puni, duplikata nema.
 */
import { GreskaBaze, poveziVezu } from "../index.js";
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
import { upisi } from "./upis.js";

try {
  process.loadEnvFile();
} catch {
  // bez .env: DATABASE_URL mora biti u okruženju
}

interface Izvor {
  naziv: string;
  adresa: (l: Lokacija) => string;
  obradi: (json: unknown, l: Lokacija, sada: Date) => PaketUvoza;
}

const IZVORI: Izvor[] = [
  { naziv: "Open-Meteo vreme", adresa: adresaOpenMeteoVreme, obradi: izOpenMeteoVremena },
  { naziv: "Open-Meteo vazduh", adresa: adresaOpenMeteoVazduh, obradi: izOpenMeteoVazduha },
  { naziv: "Sensor.Community", adresa: adresaSensorCommunity, obradi: izSensorCommunity },
];

async function preuzmi(adresa: string): Promise<unknown> {
  const odgovor = await fetch(adresa, {
    headers: { "User-Agent": "smart-city-aplikacija (studentski prototip)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!odgovor.ok) throw new Error(`HTTP ${odgovor.status}`);
  return odgovor.json();
}

async function main() {
  const lokacija = NOVI_SAD;
  const veza = await poveziVezu();
  let neuspelo = 0;
  try {
    for (const izvor of IZVORI) {
      try {
        const json = await preuzmi(izvor.adresa(lokacija));
        const ishod = await upisi(veza.izvrsi, izvor.obradi(json, lokacija, new Date()));
        console.log(
          `✓ ${izvor.naziv}: uređaja ${ishod.uredjaja}, vazduh ${ishod.vazduha} redova, vreme ${ishod.vremena} redova`,
        );
      } catch (e) {
        neuspelo++;
        const uzrok = e instanceof Error && e.cause instanceof Error ? ` (${e.cause.message})` : "";
        console.error(`✗ ${izvor.naziv}: ${e instanceof Error ? e.message : "greška"}${uzrok}`);
      }
    }
  } finally {
    await veza.zatvori();
  }
  if (neuspelo > 0) process.exitCode = 1;
}

main().catch((e: unknown) => {
  const poruka = e instanceof GreskaBaze ? e.message : "Uvoz nije uspeo.";
  const uzrok = e instanceof Error && e.cause instanceof Error ? ` (${e.cause.message})` : "";
  console.error(`${poruka}${uzrok}`);
  process.exitCode = 1;
});
