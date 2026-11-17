/**
 * K3 – prompt za LLM savet (spec 6.4).
 * LLM dobija SAMO strukturisani rezultat pravila, bez sirovih merenja i istorije.
 */
import type { NazivKategorije } from "../tipovi.js";
import { prikazDatumVreme } from "../vreme.js";
import type { SavetUlaz } from "./tipovi.js";

/**
 * Smernice za savet po kategoriji (spec 6.1, opšta populacija, okvirno).
 * TODO(mentor): spec traži da se pre implementacije usklade sa EEA preporukama
 * (https://airindex.eea.europa.eu/AQI/index.html). EEA je blaža za „Umeren“.
 */
export const SMERNICE: Record<NazivKategorije, string> = {
  Dobar: "Aktivnosti napolju bez ograničenja.",
  Zadovoljavajući: "Aktivnosti napolju bez ograničenja.",
  Umeren: "Moguće je, uz smanjenje intenzivnog treninga ako se jave simptomi.",
  Loš: "Smanjiti intenzivan napor napolju.",
  "Veoma loš": "Smanjiti napor napolju, trening premestiti unutra.",
  "Izuzetno loš": "Izbegavati napor napolju.",
};

const SISTEM = `Ti si asistent koji daje kratak, praktičan savet o šetnji i treningu napolju na osnovu kvaliteta vazduha.

Pravila:
- Piši na srpskom jeziku, latinicom.
- "savet": najviše 2 kratke rečenice, praktično za šetnju i trening.
- "osnov": jedna rečenica na čemu se savet zasniva (stanica, vrednosti, vreme merenja, kategorija i pravilo).
- Kategoriju NE menjaš i NE računaš ponovo. Koristi tačno naziv kategorije koji dobiješ.
- NE izmišljaj brojeve. Smeš da koristiš samo brojeve koji su dati u podacima.
- NE daješ medicinske dijagnoze niti savete o lekovima i bolestima.
- Prati smernicu za datu kategoriju.

Odgovori ISKLJUČIVO JSON objektom oblika: {"savet": "...", "osnov": "..."}`;

function formatBroj(n: number): string {
  return String(n);
}

/** Pravi poruke za chat API. Ulaz mora imati status "ok" i kategoriju. */
export function napraviPrompt(ulaz: SavetUlaz): { sistem: string; korisnik: string } {
  if (!ulaz.category) throw new Error("napraviPrompt: nema kategorije");

  const vrednosti = ulaz.values
    .map((v) => `${v.velicina}: ${v.vrednost === null ? "nije dostupno" : `${formatBroj(v.vrednost)} ${v.jedinica}`}`)
    .join(", ");
  const vreme = ulaz.measuredAt ? prikazDatumVreme(new Date(ulaz.measuredAt)) : "nepoznato";

  const korisnik = [
    `Stanica: ${ulaz.station.naziv}`,
    `Vreme merenja: ${vreme}`,
    `Vrednosti: ${vrednosti}`,
    `Kategorija: ${ulaz.category.naziv} (određuje ${ulaz.category.odredjujuca})`,
    `Pravilo: ${ulaz.rule}`,
    ulaz.napomena ? `Napomena: ${ulaz.napomena}` : null,
    `Smernica za ovu kategoriju: ${SMERNICE[ulaz.category.naziv]}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { sistem: SISTEM, korisnik };
}
