/**
 * Verzija B – AI sastavlja raspored ekrana po želji korisnika (npr. „samo grafikon i kategorija“).
 *
 * LLM vraća opis rasporeda → proveriRaspored() ga proverava i prevodi u A2UI. Ako bilo šta ne
 * uspe (LLM nedostupan, neispravan JSON, provera ne prođe), vraća se null i koristi fiksni ekran.
 * Uspešni rasporedi se keširaju po želji, pa „Osveži“ ne zove LLM ponovo i izgled ostaje isti.
 */
import type { LlmPoziv } from "../core/llm/index.js";
import { promptRasporeda, proveriRaspored, type IshodRasporeda } from "./a2ui-raspored.js";

export type AiRasporedA2ui = Extract<IshodRasporeda, { ok: true }>;
export type GeneratorRasporeda = (zelja: string) => Promise<AiRasporedA2ui | null>;

const MAX_KES = 50;

export function napraviGeneratorRasporeda(
  llm: LlmPoziv,
  log: (poruka: string) => void = (p) => console.error(p),
): GeneratorRasporeda {
  const kes = new Map<string, Promise<AiRasporedA2ui | null>>();

  return (zelja) => {
    const kljuc = zelja.trim().toLowerCase().replace(/\s+/g, " ");
    const postojeci = kes.get(kljuc);
    if (postojeci) return postojeci;

    const novi = (async () => {
      const pocetak = Date.now();
      try {
        const sirovo = await llm(promptRasporeda(zelja.trim()));
        const ishod = proveriRaspored(JSON.parse(sirovo) as unknown);
        if (!ishod.ok) {
          log(`[a2ui-ai] raspored odbačen posle ${Date.now() - pocetak} ms: ${ishod.razlog}`);
          return null;
        }
        log(`[a2ui-ai] raspored napravljen za ${Date.now() - pocetak} ms (${ishod.komponente.length} komponenti)`);
        return ishod;
      } catch (e) {
        log(`[a2ui-ai] greška posle ${Date.now() - pocetak} ms: ${e instanceof Error ? e.message : "nepoznata"}`);
        return null;
      }
    })();

    if (kes.size >= MAX_KES) kes.delete(kes.keys().next().value as string);
    kes.set(kljuc, novi);
    // Neuspeh se ne pamti – sledeći put se pokuša ponovo.
    void novi.then((r) => {
      if (!r) kes.delete(kljuc);
    });
    return novi;
  };
}
