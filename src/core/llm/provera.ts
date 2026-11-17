/**
 * K3 – provera izlaza LLM-a pre prikaza (spec 6.4, FR-12).
 * Ako bilo koja provera ne prođe, savet se NE prikazuje.
 */
import { z } from "zod";
import type { NazivKategorije, Savet } from "../tipovi.js";

export const MAX_DUZINA_SAVETA = 300;
export const MAX_DUZINA_OSNOVA = 400;
export const MAX_RECENICA_SAVETA = 2;

const SavetSema = z.object({
  savet: z.string().trim().min(1),
  osnov: z.string().trim().min(1),
});

const SVE_KATEGORIJE: NazivKategorije[] = [
  "Dobar",
  "Zadovoljavajući",
  "Umeren",
  "Loš",
  "Veoma loš",
  "Izuzetno loš",
];

/** Reči koje ukazuju na medicinsku dijagnozu ili terapiju (zabranjeno, 6.4). */
const MEDICINSKI_IZRAZI = /\b(dijagnoz\w*|astm\w*|bronhit\w*|inhalator\w*|lek(ov[ia]?|a|u)?\b|terapij\w*|bolest\w*|hronič\w*)/iu;

export type IshodProvere = { ok: true; savet: Savet } | { ok: false; razlog: string };

/** Svi brojevi iz teksta, normalizovani ("09" → "9", "12,4" → "12.4"). */
export function brojeviIzTeksta(tekst: string): Set<string> {
  const out = new Set<string>();
  for (const m of tekst.matchAll(/\d+(?:[.,]\d+)?/g)) {
    out.add(String(Number.parseFloat(m[0].replace(",", "."))));
  }
  return out;
}

/** Koje kategorije se pominju u tekstu (duži nazivi prvo, da „Veoma loš“ ne bude i „Loš“). */
function pomenuteKategorije(tekst: string): Set<NazivKategorije> {
  let ostatak = tekst.toLowerCase();
  const nadjene = new Set<NazivKategorije>();
  for (const naziv of [...SVE_KATEGORIJE].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(?<!\\p{L})${naziv.toLowerCase()}(?!\\p{L})`, "gu");
    if (re.test(ostatak)) {
      nadjene.add(naziv);
      ostatak = ostatak.replace(re, " ");
    }
  }
  return nadjene;
}

function brojRecenica(tekst: string): number {
  return tekst.trim().split(/(?<=[.!?])\s+(?=\p{Lu})/u).filter((s) => s.trim()).length;
}

/**
 * Proverava sirov odgovor LLM-a.
 * @param sirovo     tekst koji je LLM vratio
 * @param kategorija kategorija koju je izračunao modul pravila
 * @param ulazniTekst tekst koji je LLM dobio – samo brojevi iz njega su dozvoljeni
 */
export function proveriSavet(sirovo: string, kategorija: NazivKategorije, ulazniTekst: string): IshodProvere {
  let json: unknown;
  try {
    json = JSON.parse(sirovo);
  } catch {
    return { ok: false, razlog: "odgovor nije ispravan JSON" };
  }

  const parsirano = SavetSema.safeParse(json);
  if (!parsirano.success) return { ok: false, razlog: "JSON nema polja savet i osnov kao tekst" };
  const { savet, osnov } = parsirano.data;

  if (savet.length > MAX_DUZINA_SAVETA) return { ok: false, razlog: "savet je predugačak" };
  if (osnov.length > MAX_DUZINA_OSNOVA) return { ok: false, razlog: "osnov je predugačak" };
  if (brojRecenica(savet) > MAX_RECENICA_SAVETA) return { ok: false, razlog: "savet ima više od 2 rečenice" };

  const ceo = `${savet} ${osnov}`;

  const pomenute = pomenuteKategorije(ceo);
  if (!pomenute.has(kategorija)) return { ok: false, razlog: `ne pominje kategoriju „${kategorija}“` };
  const druge = [...pomenute].filter((k) => k !== kategorija);
  if (druge.length > 0) return { ok: false, razlog: `pominje drugu kategoriju: ${druge.join(", ")}` };

  const dozvoljeni = brojeviIzTeksta(ulazniTekst);
  const izmisljeni = [...brojeviIzTeksta(ceo)].filter((b) => !dozvoljeni.has(b));
  if (izmisljeni.length > 0) return { ok: false, razlog: `izmišljeni brojevi: ${izmisljeni.join(", ")}` };

  if (MEDICINSKI_IZRAZI.test(ceo)) return { ok: false, razlog: "sadrži medicinski savet ili dijagnozu" };

  return { ok: true, savet: { savet, osnov } };
}
