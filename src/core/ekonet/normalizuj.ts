/**
 * Normalizacija merenja koja ne zavisi od formata ekoNET API-ja.
 * Aliasi imena veličina i pretvaranje formata dolaze sa T01, kad vidimo pravi odgovor.
 */
import type { Merenje } from "../tipovi.js";

/** Važeća koncentracija: konačan broj, nije negativan. 0 je važeća vrednost. */
export function jeVazecaVrednost(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

/** Trenutak merenja u ms, ili `null` ako vreme ne može da se pročita. */
function trenutak(m: Merenje): number | null {
  const t = Date.parse(m.vreme);
  return Number.isNaN(t) ? null : t;
}

/**
 * Odbacuje merenja sa nevažećom vrednošću ili nečitljivim vremenom i sortira
 * ostala po trenutku, najnovije na kraju. Nevažeća vrednost se izbacuje, nikad
 * ne postaje 0 (FR-04). Ulazni niz se ne menja.
 */
export function ocistiMerenja(merenja: readonly Merenje[]): Merenje[] {
  return merenja
    .map((m) => ({ m, t: trenutak(m) }))
    .filter((x): x is { m: Merenje; t: number } => x.t !== null && jeVazecaVrednost(x.m.vrednost))
    .sort((a, b) => a.t - b.t)
    .map((x) => x.m);
}
