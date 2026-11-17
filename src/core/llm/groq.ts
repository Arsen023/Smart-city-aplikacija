/**
 * K3 – poziv Groq API-ja (OpenAI-kompatibilan chat completions).
 * Ključ i model se čitaju iz promenljivih okruženja (NFR-04), nikad iz koda.
 *
 *   GROQ_API_KEY  – obavezno
 *   GROQ_MODEL    – opciono, podrazumevano "llama-3.3-70b-versatile"
 */
import { z } from "zod";
import type { LlmPoziv } from "./tipovi.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
export const PODRAZUMEVANI_MODEL = "llama-3.3-70b-versatile";
/** Ceo assess_air_quality mora biti ispod 5 s (NFR-03), pa LLM dobija najviše 4 s. */
export const LLM_TIMEOUT_MS = 4000;

const OdgovorSema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

export interface GroqOpcije {
  kljuc?: string;
  model?: string;
  timeoutMs?: number;
}

/** Pravi funkciju za poziv Groq-a. Baca grešku ako ključ ne postoji, API ne odgovori ili istekne vreme. */
export function groqPoziv(opcije: GroqOpcije = {}): LlmPoziv {
  return async ({ sistem, korisnik }) => {
    const kljuc = opcije.kljuc ?? process.env.GROQ_API_KEY;
    if (!kljuc) throw new Error("GROQ_API_KEY nije postavljen");
    const model = opcije.model ?? process.env.GROQ_MODEL ?? PODRAZUMEVANI_MODEL;

    const odgovor = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${kljuc}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sistem },
          { role: "user", content: korisnik },
        ],
      }),
      signal: AbortSignal.timeout(opcije.timeoutMs ?? LLM_TIMEOUT_MS),
    });

    if (!odgovor.ok) throw new Error(`Groq je vratio HTTP ${odgovor.status}`);
    const telo = OdgovorSema.parse(await odgovor.json());
    return telo.choices[0].message.content;
  };
}
