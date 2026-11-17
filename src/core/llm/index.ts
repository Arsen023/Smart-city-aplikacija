/** Javni API K3 modula (LLM savet). Server uvozi samo odavde. */
import type { NapraviSavetFn } from "../tipovi.js";
import { napraviSavet } from "./savet.js";

// Provera da implementacija odgovara dogovorenom potpisu iz tipovi.ts
const _napraviSavet: NapraviSavetFn = (ulaz) => napraviSavet(ulaz);
void _napraviSavet;

export { napraviSavet, type SavetOpcije } from "./savet.js";
export { groqPoziv, PODRAZUMEVANI_MODEL, LLM_TIMEOUT_MS } from "./groq.js";
export { proveriSavet } from "./provera.js";
export { napraviPrompt, SMERNICE } from "./prompt.js";
export type { LlmPoziv, SavetUlaz } from "./tipovi.js";
