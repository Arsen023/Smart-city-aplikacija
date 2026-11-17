/**
 * Javni API K1 ekoNET klijenta. Server uvozi samo odavde.
 *
 * Izvor podataka se bira promenljivama okruženja (vidi .env.example):
 * - EKONET_IZVOR    – "demo" (podrazumevano) ili "api"
 * - EKONET_SCENARIO – demo scenario iz fixtures/, podrazumevano "s1-dobar"
 */
import type { EkonetKlijent } from "../tipovi.js";
import { napraviDemoKlijent } from "./demo.js";
import { GreskaEkonet } from "./greske.js";
import { DEMO_SCENARIJI, jeDemoScenarioId, ucitajScenario, type DemoScenarioId } from "./ucitaj.js";

export const PODRAZUMEVANI_SCENARIO: DemoScenarioId = "s1-dobar";
const IZVORI = ["demo", "api"] as const;

export type PodesavanjaEkonet = { izvor: "demo"; scenario: DemoScenarioId } | { izvor: "api" };

type Okruzenje = Readonly<Record<string, string | undefined>>;

/** Prazna ili nepostavljena promenljiva znači „uzmi podrazumevano“. */
function procitaj(env: Okruzenje, ime: string): string | undefined {
  const v = env[ime]?.trim();
  return v ? v : undefined;
}

export function procitajPodesavanja(env: Okruzenje): PodesavanjaEkonet {
  const izvor = procitaj(env, "EKONET_IZVOR") ?? "demo";
  if (izvor === "api") return { izvor: "api" };
  if (izvor !== "demo") {
    throw new GreskaEkonet(
      "konfiguracija",
      `EKONET_IZVOR mora biti ${IZVORI.map((i) => `"${i}"`).join(" ili ")}, a postavljeno je "${izvor}".`,
    );
  }
  const scenario = procitaj(env, "EKONET_SCENARIO") ?? PODRAZUMEVANI_SCENARIO;
  if (!jeDemoScenarioId(scenario)) {
    throw new GreskaEkonet(
      "konfiguracija",
      `EKONET_SCENARIO "${scenario}" ne postoji. Dozvoljeno: ${DEMO_SCENARIJI.join(", ")}.`,
    );
  }
  return { izvor: "demo", scenario };
}

/** Klijent zajedno sa satom koji uz njega važi. Server (T09) koristi ovo, ne sam klijent. */
export interface IzvorPodataka {
  klijent: EkonetKlijent;
  /** Trenutno vreme za proveru svežine: u demo režimu `scenario.sada`, inače pravi sat. */
  sada: () => Date;
  /** Demo scenario traži da LLM poziv ne uspe (S5). Za pravi API uvek `false`. */
  llmGreska: boolean;
}

/** Pravi izvor podataka (klijent + sat) prema podešavanjima iz okruženja. */
export async function napraviIzvor(env: Okruzenje = process.env): Promise<IzvorPodataka> {
  const p = procitajPodesavanja(env);
  if (p.izvor === "api") {
    // TODO T01: pravi HTTP klijent (URL, autentifikacija, Zod šema odgovora, normalizacija).
    // Tada: sada = () => new Date(), llmGreska = false.
    throw new GreskaEkonet(
      "konfiguracija",
      "EKONET_IZVOR=api još ne radi: pristup ekoNET API-ju (T01) nije podešen. Za sada koristi EKONET_IZVOR=demo.",
    );
  }
  const scenario = await ucitajScenario(p.scenario);
  const sadaMs = Date.parse(scenario.sada);
  return {
    klijent: napraviDemoKlijent(scenario),
    sada: () => new Date(sadaMs),
    llmGreska: scenario.llmGreska === true,
  };
}

/** Pravi K1 klijent prema podešavanjima iz okruženja. */
export async function napraviKlijent(env: Okruzenje = process.env): Promise<EkonetKlijent> {
  return (await napraviIzvor(env)).klijent;
}

export { napraviDemoKlijent } from "./demo.js";
export { GreskaEkonet, type KodGreskeEkonet } from "./greske.js";
export { jeVazecaVrednost, ocistiMerenja } from "./normalizuj.js";
export { DemoScenarioSema, MerenjeSema, StanicaSema } from "./sema.js";
export {
  DEMO_SCENARIJI,
  jeDemoScenarioId,
  listaScenarija,
  parsirajScenario,
  ucitajScenario,
  type DemoScenarioId,
} from "./ucitaj.js";
