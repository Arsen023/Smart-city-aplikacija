/**
 * K3 – poziv Groq API-ja (OpenAI-kompatibilan chat completions).
 * Ključ i model se čitaju iz promenljivih okruženja (NFR-04), nikad iz koda.
 *
 *   GROQ_API_KEY  – obavezno
 *   GROQ_MODEL    – opciono, podrazumevano "openai/gpt-oss-120b"
 *
 * Napomena (17.11.2026): llama-3.3-70b-versatile nije dostupan sa našim ključem.
 * Isprobani i dostupni: openai/gpt-oss-120b, qwen/qwen3.8-27b.
 */
import { z } from "zod";
import type { LlmPoziv } from "./tipovi.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
export const PODRAZUMEVANI_MODEL = "openai/gpt-oss-120b";
/** Modeli koji „razmišljaju“ (gpt-oss) troše tokene pre JSON-a, pa 300 nije dovoljno. */
const MAX_TOKENA = 1024;
/** Ceo assess_air_quality mora biti ispod 5 s (NFR-03), pa LLM dobija najviše 4 s. */
export const LLM_TIMEOUT_MS = 4000;

const OdgovorSema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

export interface GroqOpcije {
  kljuc?: string;
  model?: string;
  timeoutMs?: number;
  /** Podrazumevano 1024; raspored ekrana (verzija B) traži više. */
  maxTokena?: number;
}

/** Pravi funkciju za poziv Groq-a. Baca grešku ako ključ ne postoji, API ne odgovori ili istekne vreme. */
export function groqPoziv(opcije: GroqOpcije = {}): LlmPoziv {
  return async ({ sistem, korisnik }) => {
    // `||` a ne `??`: prazna vrednost u .env (npr. "GROQ_MODEL=") znači „nije postavljeno“
    const kljuc = opcije.kljuc || process.env.GROQ_API_KEY;
    if (!kljuc) throw new Error("GROQ_API_KEY nije postavljen");
    const model = opcije.model || process.env.GROQ_MODEL || PODRAZUMEVANI_MODEL;

    const odgovor = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${kljuc}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: opcije.maxTokena ?? MAX_TOKENA,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sistem },
          { role: "user", content: korisnik },
        ],
      }),
      signal: AbortSignal.timeout(opcije.timeoutMs ?? LLM_TIMEOUT_MS),
    });

    if (!odgovor.ok) {
      // Samo kod greške (npr. model_not_found, json_validate_failed) – bez sadržaja i ključa
      const kod = await odgovor
        .json()
        .then((t: { error?: { code?: string } }) => t.error?.code)
        .catch(() => undefined);
      throw new Error(`Groq je vratio HTTP ${odgovor.status}${kod ? ` (${kod})` : ""}`);
    }
    const telo = OdgovorSema.parse(await odgovor.json());
    return telo.choices[0].message.content;
  };
}
