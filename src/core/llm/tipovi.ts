/** Lokalni tipovi K3 modula. Zajednički ugovor je u ../tipovi.ts (NapraviSavetFn). */
import type { NapraviSavetFn } from "../tipovi.js";

/** Ulaz za savet = Rezultat bez saveta i istorije (kako je dogovoreno u tipovi.ts). */
export type SavetUlaz = Parameters<NapraviSavetFn>[0];

/** Funkcija koja pozove LLM i vrati sirov tekst odgovora. Zamenjiva u testovima. */
export type LlmPoziv = (poruke: { sistem: string; korisnik: string }) => Promise<string>;
