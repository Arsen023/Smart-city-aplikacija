/**
 * Upis paketa iz javnih izvora u bazu (db/03-vazduh-vreme.sql).
 * Svi upiti su parametrizovani ($1, $2…). Ponovni uvoz ne pravi duplikate: isto (uređaj, vreme)
 * se ažurira – tako se prognoza zameni novijom, a kasnije i stvarnom vrednošću.
 */
import type { IzvrsiUpit } from "../index.js";
import type { NoviUredjaj, PaketUvoza, RedVazduha, RedVremena } from "./izvori.js";

/** Najviše redova u jednom INSERT-u (PostgreSQL dozvoljava do 65535 parametara). */
const REDOVA_PO_UPITU = 500;

/** "($1, $2, $3), ($4, $5, $6)…" za `brojRedova` redova sa `brojKolona` kolona. */
export function mesta(brojRedova: number, brojKolona: number): string {
  return Array.from({ length: brojRedova }, (_, r) =>
    `(${Array.from({ length: brojKolona }, (_, k) => `$${r * brojKolona + k + 1}`).join(", ")})`,
  ).join(", ");
}

/** Jedan red po ključu (poslednji pobeđuje) – INSERT … ON CONFLICT ne sme dvaput isti red. */
export function bezDuplikata<T>(redovi: T[], kljuc: (r: T) => string): T[] {
  return [...new Map(redovi.map((r) => [kljuc(r), r])).values()];
}

function delovi<T>(redovi: T[]): T[][] {
  const rez: T[][] = [];
  for (let i = 0; i < redovi.length; i += REDOVA_PO_UPITU) rez.push(redovi.slice(i, i + REDOVA_PO_UPITU));
  return rez;
}

export const KOLONE_UREDJAJA = ["id", "naziv", "tip", "lokacija", "izvor", "lat", "lon"] as const;
export const KOLONE_VAZDUHA = ["uredjaj_id", "vreme", "pm25", "pm10", "no2", "o3", "eaqi_izvor", "prognoza"] as const;
export const KOLONE_VREMENA = [
  "uredjaj_id", "vreme", "temperatura_c", "vlaznost_proc", "vetar_kmh", "padavine_mm", "vreme_kod", "prognoza",
] as const;

function azuriraj(kolone: readonly string[], kljuc: readonly string[]): string {
  return kolone.filter((k) => !kljuc.includes(k)).map((k) => `${k} = EXCLUDED.${k}`).join(", ");
}

export function sqlUredjaja(brojRedova: number): string {
  return `INSERT INTO uredjaj (${KOLONE_UREDJAJA.join(", ")}) VALUES ${mesta(brojRedova, KOLONE_UREDJAJA.length)}
    ON CONFLICT (id) DO UPDATE SET ${azuriraj(KOLONE_UREDJAJA, ["id"])}`;
}

export function sqlVazduha(brojRedova: number): string {
  return `INSERT INTO merenje_vazduha (${KOLONE_VAZDUHA.join(", ")}) VALUES ${mesta(brojRedova, KOLONE_VAZDUHA.length)}
    ON CONFLICT (uredjaj_id, vreme) DO UPDATE SET ${azuriraj(KOLONE_VAZDUHA, ["uredjaj_id", "vreme"])}`;
}

export function sqlVremena(brojRedova: number): string {
  return `INSERT INTO merenje_vremena (${KOLONE_VREMENA.join(", ")}) VALUES ${mesta(brojRedova, KOLONE_VREMENA.length)}
    ON CONFLICT (uredjaj_id, vreme) DO UPDATE SET ${azuriraj(KOLONE_VREMENA, ["uredjaj_id", "vreme"])}`;
}

const parametriUredjaja = (u: NoviUredjaj) => [u.id, u.naziv, u.tip, u.lokacija, u.izvor, u.lat, u.lon];
const parametriVazduha = (r: RedVazduha) => [
  r.uredjajId, r.vreme.toISOString(), r.pm25, r.pm10, r.no2, r.o3, r.eaqiIzvor, r.prognoza,
];
const parametriVremena = (r: RedVremena) => [
  r.uredjajId, r.vreme.toISOString(), r.temperaturaC, r.vlaznostProc, r.vetarKmh, r.padavineMm, r.vremeKod, r.prognoza,
];

export interface IshodUpisa {
  uredjaja: number;
  vazduha: number;
  vremena: number;
}

/** Upisuje uređaje pa merenja (merenja upućuju na uređaj). */
export async function upisi(izvrsi: IzvrsiUpit, paket: PaketUvoza): Promise<IshodUpisa> {
  const uredjaji = bezDuplikata(paket.uredjaji, (u) => u.id);
  const kljucMerenja = (r: { uredjajId: string; vreme: Date }) => `${r.uredjajId}|${r.vreme.toISOString()}`;
  const vazduh = bezDuplikata(paket.vazduh, kljucMerenja);
  const vreme = bezDuplikata(paket.vreme, kljucMerenja);

  for (const d of delovi(uredjaji)) await izvrsi(sqlUredjaja(d.length), d.flatMap(parametriUredjaja));
  for (const d of delovi(vazduh)) await izvrsi(sqlVazduha(d.length), d.flatMap(parametriVazduha));
  for (const d of delovi(vreme)) await izvrsi(sqlVremena(d.length), d.flatMap(parametriVremena));

  return { uredjaja: uredjaji.length, vazduha: vazduh.length, vremena: vreme.length };
}
