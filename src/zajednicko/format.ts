/**
 * Format vrednosti i vremena za prikaz – zajednički za server (content tekst, A2UI poruke) i ekran A.
 * Samo čiste funkcije, bez DOM-a i I/O-a.
 */
import type { PoslednjaVrednost } from "../core/tipovi.js";

const broj = new Intl.NumberFormat("sr-Latn", { maximumFractionDigits: 1 });

/** "PM2.5 12,4 µg/m³" ili "PM2.5 nije dostupno" – nedostajuća vrednost nikad nije 0 (pravilo 5). */
export function tekstVrednosti(v: PoslednjaVrednost): string {
  return v.vrednost === null ? `${v.velicina} nije dostupno` : `${v.velicina} ${broj.format(v.vrednost)} ${v.jedinica}`;
}

/**
 * „pre 20 min“, „pre 3 h“, „pre 2 dana“ – koliko je prošlo od merenja (spec 8.1, element 3).
 * `sada` je „sada“ servera (u demo režimu vreme scenarija), da A i B pokažu isto.
 * Autor: Luka (T12), premešteno iz src/server/a2ui.ts u T11.
 */
export function protekloVreme(measuredAt: string, sada: Date): string {
  const min = Math.floor((sada.getTime() - Date.parse(measuredAt)) / 60_000);
  if (min < 1) return "upravo";
  if (min < 60) return `pre ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `pre ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "pre 1 dan" : `pre ${d} dana`;
}
