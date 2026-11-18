/**
 * Format vrednosti za prikaz – zajednički za server (content tekst, A2UI poruke) i ekran A.
 * Samo čiste funkcije, bez DOM-a i I/O-a.
 */
import type { PoslednjaVrednost } from "../core/tipovi.js";

const broj = new Intl.NumberFormat("sr-Latn", { maximumFractionDigits: 1 });

/** "PM2.5 12,4 µg/m³" ili "PM2.5 nije dostupno" – nedostajuća vrednost nikad nije 0 (pravilo 5). */
export function tekstVrednosti(v: PoslednjaVrednost): string {
  return v.vrednost === null ? `${v.velicina} nije dostupno` : `${v.velicina} ${broj.format(v.vrednost)} ${v.jedinica}`;
}
