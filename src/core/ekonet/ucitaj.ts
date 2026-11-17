/**
 * Učitavanje demo scenarija iz fixtures/ uz Zod proveru.
 * Čita se samo fajl sa liste poznatih scenarija, nikad proizvoljna putanja.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DemoScenario } from "../tipovi.js";
import { GreskaEkonet } from "./greske.js";
import { DemoScenarioSema } from "./sema.js";

export const DEMO_SCENARIJI = [
  "s1-dobar",
  "s2-los",
  "s3-zastareo",
  "s4-bez-pm25",
  "s5-llm-greska",
  "s6-bez-podataka",
] as const;
export type DemoScenarioId = (typeof DEMO_SCENARIJI)[number];

const FIXTURES_DIR = path.join(import.meta.dirname, "..", "..", "..", "fixtures");

export function listaScenarija(): readonly DemoScenarioId[] {
  return DEMO_SCENARIJI;
}

export function jeDemoScenarioId(id: string): id is DemoScenarioId {
  return (DEMO_SCENARIJI as readonly string[]).includes(id);
}

/**
 * Pretvara tekst fixture-a u `DemoScenario`. Bez I/O-a, da bi se lako testiralo.
 * Ako je dat `ocekivaniId`, `id` u fajlu mora da se poklapa sa njim.
 */
export function parsirajScenario(tekst: string, ocekivaniId?: string): DemoScenario {
  let sirovo: unknown;
  try {
    sirovo = JSON.parse(tekst);
  } catch (e) {
    throw new GreskaEkonet("neispravan_odgovor", "Demo scenario nije ispravan JSON.", { cause: e });
  }
  const r = DemoScenarioSema.safeParse(sirovo);
  if (!r.success) {
    throw new GreskaEkonet("neispravan_odgovor", `Demo scenario ne prolazi proveru: ${r.error.message}`, {
      cause: r.error,
    });
  }
  if (ocekivaniId !== undefined && r.data.id !== ocekivaniId) {
    throw new GreskaEkonet(
      "neispravan_odgovor",
      `Fajl za scenario "${ocekivaniId}" ima id "${r.data.id}".`,
    );
  }
  return r.data;
}

export async function ucitajScenario(id: string): Promise<DemoScenario> {
  if (!jeDemoScenarioId(id)) {
    throw new GreskaEkonet(
      "konfiguracija",
      `Nepoznat demo scenario "${id}". Dozvoljeno: ${DEMO_SCENARIJI.join(", ")}.`,
    );
  }
  const tekst = await readFile(path.join(FIXTURES_DIR, `${id}.json`), "utf8");
  return parsirajScenario(tekst, id);
}
