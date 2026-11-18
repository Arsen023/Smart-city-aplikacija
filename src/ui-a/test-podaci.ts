/**
 * Rezultat-i za testove ekrana A, po uzoru na scenarije iz fixtures/ (S1–S6) i status "error".
 * Ekran ne uvozi server, pa se Rezultat ovde piše ručno u obliku koji server vraća.
 */
import type { Rezultat } from "../core/tipovi.js";

const stanica = { id: "demo-liman", naziv: "Liman" };
const vreme = "2026-11-16T09:00:00+01:00";

export function rezultatS1(): Rezultat {
  return {
    status: "ok",
    station: stanica,
    measuredAt: vreme,
    values: [
      { velicina: "PM2.5", vrednost: 3.7, jedinica: "µg/m³" },
      { velicina: "PM10", vrednost: 12.4, jedinica: "µg/m³" },
    ],
    history: [{ vreme, pm25: 3.7, pm10: 12.4 }],
    category: { naziv: "Dobar", nivo: 1, odredjujuca: "PM10" },
    rule: "EAQI, satne vrednosti, najlošiji podindeks",
    advice: { savet: "Vazduh je dobar, slobodno izađite.", osnov: "Liman, PM10 12,4 µg/m³ u 09:00, EAQI." },
    message: null,
    napomena: null,
  };
}

export function rezultatS2(): Rezultat {
  return {
    ...rezultatS1(),
    values: [
      { velicina: "PM2.5", vrednost: 62, jedinica: "µg/m³" },
      { velicina: "PM10", vrednost: 98, jedinica: "µg/m³" },
    ],
    category: { naziv: "Loš", nivo: 4, odredjujuca: "PM2.5" },
    advice: { savet: "Smanjite napor ili trenirajte unutra.", osnov: "Liman, PM2.5 62 µg/m³ u 09:00, EAQI." },
  };
}

export function rezultatS3(): Rezultat {
  return {
    ...rezultatS1(),
    status: "stale",
    measuredAt: "2026-11-16T05:00:00+01:00",
    category: null,
    advice: null,
    message: "Poslednje merenje je od 16.11. u 05:00. Ne dajemo preporuku.",
  };
}

export function rezultatS4(): Rezultat {
  return {
    ...rezultatS1(),
    values: [
      { velicina: "PM2.5", vrednost: null, jedinica: "µg/m³" },
      { velicina: "PM10", vrednost: 12.4, jedinica: "µg/m³" },
    ],
    napomena: "PM2.5 nije dostupno, kategorija iz PM10.",
  };
}

export function rezultatS5(): Rezultat {
  return {
    ...rezultatS1(),
    advice: null,
    message: "Savet trenutno nije dostupan. Prikazana su merenja i kategorija.",
  };
}

export function rezultatS6(): Rezultat {
  return {
    ...rezultatS1(),
    status: "no_data",
    measuredAt: null,
    values: [
      { velicina: "PM2.5", vrednost: null, jedinica: "µg/m³" },
      { velicina: "PM10", vrednost: null, jedinica: "µg/m³" },
    ],
    history: [],
    category: null,
    advice: null,
    message: "Nema merenja PM2.5 ni PM10 za ovu stanicu.",
  };
}

export function rezultatGreska(): Rezultat {
  return {
    ...rezultatS6(),
    status: "error",
    rule: "",
    message: "Podaci trenutno nisu dostupni. Pokušajte ponovo kasnije.",
  };
}
