/**
 * Geometrija linijskog grafikona za 24 h (spec 8.1, element 5). Čiste funkcije, bez DOM-a,
 * da bi se testirale u Node-u.
 *
 * Zajedničko za verziju A (src/ui-a/crtaj.ts) i verziju B (src/ui-b/komponente/grafikon.ts),
 * da oba grafikona imaju iste ose, oznake i prekide linije (NFR-01). Autor: Luka (T13),
 * premešteno iz src/ui-b/komponente/geometrija.ts u T11.
 */
import type { SatnaVrednost } from "../core/tipovi.js";

/** Boje linija – iste u A i B. PM10 je i isprekidana, da se linije razlikuju i bez boje. */
export const BOJA_PM25 = "#1F5FBF";
export const BOJA_PM10 = "#A34700";

export interface Dimenzije {
  sirina: number;
  visina: number;
  levo: number;
  desno: number;
  gore: number;
  dole: number;
}

/** Širi crtež: na kartici širine ~600 px oznake ostaju čitljive, a grafikon nije previsok. */
export const PODRAZUMEVANE: Dimenzije = { sirina: 640, visina: 180, levo: 36, desno: 10, gore: 10, dole: 24 };

export interface Grafikon {
  /** SVG path za PM2.5 i PM10; "" ako veličina nema nijednu vrednost. Prekid linije gde je null. */
  pm25: string;
  pm10: string;
  /** Gornja granica ose Y (zaokružena naviše). */
  yMax: number;
  oznakeY: { y: number; tekst: string }[];
  oznakeX: { x: number; tekst: string }[];
}

/** „Lepa“ gornja granica: 10, 20, 50, 100, 200, 500… */
export function lepaGranica(max: number): number {
  if (max <= 0) return 10;
  const red = 10 ** Math.floor(Math.log10(max));
  for (const k of [1, 2, 5, 10]) if (max <= k * red) return k * red;
  return 10 * red;
}

function sat(vreme: string): string {
  return new Intl.DateTimeFormat("sr-Latn", { timeZone: "Europe/Belgrade", hour: "2-digit", hourCycle: "h23" }).format(
    new Date(vreme),
  );
}

function putanja(vrednosti: (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  let d = "";
  let olovkaDole = false;
  vrednosti.forEach((v, i) => {
    if (v === null) {
      olovkaDole = false; // prekid: nedostajuća vrednost se ne crta kao 0
      return;
    }
    d += `${olovkaDole ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
    olovkaDole = true;
  });
  return d.trim();
}

export function geometrija(tacke: SatnaVrednost[], dim: Dimenzije = PODRAZUMEVANE): Grafikon {
  const sirinaCrteza = dim.sirina - dim.levo - dim.desno;
  const visinaCrteza = dim.visina - dim.gore - dim.dole;
  const sve = tacke.flatMap((t) => [t.pm25, t.pm10]).filter((v): v is number => v !== null);
  const yMax = lepaGranica(sve.length ? Math.max(...sve) : 0);

  const n = tacke.length;
  const x = (i: number) => dim.levo + (n <= 1 ? sirinaCrteza / 2 : (i / (n - 1)) * sirinaCrteza);
  const y = (v: number) => dim.gore + visinaCrteza - (Math.min(v, yMax) / yMax) * visinaCrteza;

  const oznakeY = [0, yMax / 2, yMax].map((v) => ({ y: y(v), tekst: String(v) }));
  // Oznaka sata na svakih ~6 tačaka, plus poslednja.
  const korak = Math.max(1, Math.round(n / 4));
  const oznakeX = tacke
    .map((t, i) => ({ i, t }))
    .filter(({ i }) => i % korak === 0 || i === n - 1)
    .map(({ i, t }) => ({ x: x(i), tekst: sat(t.vreme) }));

  return {
    pm25: putanja(
      tacke.map((t) => t.pm25),
      x,
      y,
    ),
    pm10: putanja(
      tacke.map((t) => t.pm10),
      x,
      y,
    ),
    yMax,
    oznakeY,
    oznakeX,
  };
}
