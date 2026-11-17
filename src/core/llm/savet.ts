/**
 * K3 – napraviSavet: iz rezultata pravila pravi kratak savet na srpskom i osnov.
 *
 * - Ne poziva LLM ako status nije "ok" ili nema kategorije (FR-09).
 * - Vraća null ako LLM nije dostupan ili izlaz ne prođe proveru (FR-12) –
 *   tada se merenja i kategorija prikazuju bez saveta.
 * - Loguje poziv bez ključa i bez sadržaja (NFR-09).
 */
import type { Savet } from "../tipovi.js";
import { groqPoziv } from "./groq.js";
import { proveriSavet } from "./provera.js";
import { napraviPrompt } from "./prompt.js";
import type { LlmPoziv, SavetUlaz } from "./tipovi.js";

export interface SavetOpcije {
  /** Funkcija koja zove LLM; u testovima se zamenjuje lažnom. */
  llm?: LlmPoziv;
  /** Gde se loguje; u testovima se može utišati. */
  log?: (poruka: string) => void;
}

export async function napraviSavet(ulaz: SavetUlaz, opcije: SavetOpcije = {}): Promise<Savet | null> {
  if (ulaz.status !== "ok" || !ulaz.category) return null;

  const llm = opcije.llm ?? groqPoziv();
  const log = opcije.log ?? ((p: string) => console.error(p));
  const poruke = napraviPrompt(ulaz);
  const pocetak = Date.now();

  let sirovo: string;
  try {
    sirovo = await llm(poruke);
  } catch (e) {
    const razlog = e instanceof Error ? e.message : "nepoznata greška";
    log(`[llm] greška posle ${Date.now() - pocetak} ms: ${razlog}`);
    return null;
  }

  const ishod = proveriSavet(sirovo, ulaz.category.naziv, poruke.korisnik);
  if (!ishod.ok) {
    log(`[llm] savet odbačen posle ${Date.now() - pocetak} ms: ${ishod.razlog}`);
    return null;
  }

  log(`[llm] savet prihvaćen za ${Date.now() - pocetak} ms`);
  return ishod.savet;
}
