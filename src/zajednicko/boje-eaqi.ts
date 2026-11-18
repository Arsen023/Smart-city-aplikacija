/**
 * Boje EAQI kategorija – zajedničke za verziju A i B (spec 8.1, element 4; NFR-01).
 * Samo konstante i čiste funkcije, bez DOM-a.
 *
 * TODO(EEA): EEA stranica indeksa (https://airindex.eea.europa.eu/AQI/index.html) ne navodi
 * kodove boja u tekstu. Ovo je paleta koja se uobičajeno navodi za EAQI – potvrditi sa
 * zvaničnom legendom pre demoa. Boja je samo dodatak: naziv kategorije se uvek prikazuje (NFR-07).
 */
export const EAQI_BOJE: Record<number, string> = {
  1: "#50F0E6", // Dobar
  2: "#50CCAA", // Zadovoljavajući
  3: "#F0E641", // Umeren
  4: "#FF5050", // Loš
  5: "#960032", // Veoma loš
  6: "#7D2181", // Izuzetno loš
};

const NEPOZNATA = "#9E9E9E";

function relativnaSvetlina(hex: string): number {
  const kanali = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = kanali.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Kontrast po WCAG 2.x, od 1 do 21. */
export function kontrast(a: string, b: string): number {
  const [l1, l2] = [relativnaSvetlina(a), relativnaSvetlina(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Pozadina po nivou i boja teksta (crna ili bela) sa većim kontrastom (NFR-07: najmanje 4,5:1). */
export function bojeKategorije(nivo: number): { pozadina: string; tekst: string } {
  const pozadina = EAQI_BOJE[nivo] ?? NEPOZNATA;
  const tekst = kontrast(pozadina, "#000000") >= kontrast(pozadina, "#FFFFFF") ? "#000000" : "#FFFFFF";
  return { pozadina, tekst };
}
