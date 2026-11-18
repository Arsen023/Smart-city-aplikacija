/**
 * K4 – tok alata assess_air_quality: K1 → K2 → (K3 samo za "ok") → Rezultat.
 *
 * Ovde nema pravila ni pragova (pravilo 1 i 4): kategoriju računa samo src/core/pravila/,
 * savet samo src/core/llm/. Zavisnosti se prosleđuju spolja da bi se tok testirao
 * nad fixtures/ bez mreže i bez pravog LLM-a.
 */
import { GreskaEkonet, napraviIzvor } from "../core/ekonet/index.js";
import { napraviSavet } from "../core/llm/index.js";
import { proceni, satneVrednosti } from "../core/pravila/index.js";
import {
  JEDINICA_PM,
  type EkonetKlijent,
  type Merenje,
  type NapraviSavetFn,
  type PoslednjaVrednost,
  type Rezultat,
  type Stanica,
  type Velicina,
} from "../core/tipovi.js";
import { prikazDatumVreme } from "../core/vreme.js";
import { tekstVrednosti } from "../zajednicko/format.js";

const PRACENE: readonly Velicina[] = ["PM2.5", "PM10"];
const SATI_ISTORIJE = 24;

export const PORUKA_BEZ_SAVETA = "Savet trenutno nije dostupan. Prikazana su merenja i kategorija.";

export interface ZavisnostiProcene {
  klijent: EkonetKlijent;
  sada: () => Date;
  napraviSavet: NapraviSavetFn;
  /** Gde se loguju greške; u testovima se utišava. Nikad ne loguje ključeve. */
  log?: (poruka: string) => void;
}

type Okruzenje = Readonly<Record<string, string | undefined>>;

/**
 * Pravi zavisnosti iz okruženja (EKONET_IZVOR, EKONET_SCENARIO, GROQ_*).
 * Za demo scenario sa `llmGreska` (S5) LLM poziv namerno ne uspeva.
 */
export async function zavisnostiIzOkruzenja(
  env: Okruzenje = process.env,
  opcije: { log?: (poruka: string) => void } = {},
): Promise<ZavisnostiProcene> {
  const izvor = await napraviIzvor(env);
  const log = opcije.log ?? ((p: string) => console.error(p));
  const llm = izvor.llmGreska
    ? async (): Promise<string> => {
        throw new Error("simulirana nedostupnost LLM-a (demo scenario S5)");
      }
    : undefined;
  return {
    klijent: izvor.klijent,
    sada: izvor.sada,
    napraviSavet: (ulaz) => napraviSavet(ulaz, { llm, log }),
    log,
  };
}

// ─── Pomoćne funkcije ──────────────────────────────────────────────────────

function poslednjeVrednosti(latest: Merenje[]): PoslednjaVrednost[] {
  return PRACENE.map((velicina) => {
    const m = latest.filter((x) => x.velicina === velicina).at(-1);
    // Nedostajuća veličina je null, nikad 0 (pravilo 5).
    return { velicina, vrednost: m ? m.vrednost : null, jedinica: JEDINICA_PM };
  });
}

/**
 * Istorija + poslednja merenja koja nisu u istoriji. Ako je poslednje merenje
 * starije od prozora istorije, K2 ga ipak vidi i vraća "stale" sa njegovim vremenom
 * (pravilo 2), umesto "no_data".
 */
function spojiMerenja(istorija: Merenje[], latest: Merenje[]): Merenje[] {
  const kljuc = (m: Merenje) => `${m.velicina}|${Date.parse(m.vreme)}`;
  const vidjena = new Set(istorija.map(kljuc));
  const dodatak = latest.filter((m) => !vidjena.has(kljuc(m)));
  return [...dodatak, ...istorija].sort((a, b) => Date.parse(a.vreme) - Date.parse(b.vreme));
}

/** Poruka na srpskom za korisnika. Ne sadrži ključeve ni tehničke detalje mreže. */
export function porukaGreske(e: unknown): string {
  if (e instanceof GreskaEkonet) {
    switch (e.kod) {
      case "nepoznata_stanica":
        return e.message;
      case "konfiguracija":
        return `Izvor podataka nije dobro podešen. ${e.message}`;
      case "neispravan_odgovor":
        return "Podaci sa ekoNET-a nisu u očekivanom formatu. Pokušajte ponovo kasnije.";
    }
  }
  return "Podaci trenutno nisu dostupni. Pokušajte ponovo kasnije.";
}

function razlogZaLog(e: unknown): string {
  if (e instanceof GreskaEkonet) return `${e.kod}: ${e.message}`;
  return e instanceof Error ? e.message : "nepoznata greška";
}

/** Rezultat sa statusom "error": bez kategorije, saveta i vremena merenja. */
export function rezultatGreske(stanica: { id: string; naziv: string }, message: string): Rezultat {
  return {
    status: "error",
    station: stanica,
    measuredAt: null,
    values: poslednjeVrednosti([]),
    history: [],
    category: null,
    rule: "",
    advice: null,
    message,
    napomena: null,
  };
}

/** Bira stanicu: zadatu po id-ju, ili prvu dostupnu kad id nije zadat. */
async function izaberiStanicu(klijent: EkonetKlijent, stationId?: string): Promise<Stanica> {
  const stanice = await klijent.getStations();
  const stanica = stationId === undefined ? stanice[0] : stanice.find((s) => s.id === stationId);
  if (stanica) return stanica;
  throw new GreskaEkonet(
    "nepoznata_stanica",
    stationId === undefined ? "Nema dostupnih mernih stanica." : `Stanica "${stationId}" ne postoji.`,
  );
}

// ─── Glavni tok ────────────────────────────────────────────────────────────

/** Ceo tok assess_air_quality. Nikad ne baca izuzetak: greška postaje status "error" (NFR-05). */
export async function proceniKvalitet(z: ZavisnostiProcene, stationId?: string): Promise<Rezultat> {
  const log = z.log ?? ((p: string) => console.error(p));
  let stanica: { id: string; naziv: string } = { id: stationId ?? "", naziv: stationId ?? "nepoznata stanica" };

  try {
    const s = await izaberiStanicu(z.klijent, stationId);
    stanica = { id: s.id, naziv: s.naziv };

    const [latest, istorija] = await Promise.all([
      z.klijent.getLatest(s.id),
      z.klijent.getHistory(s.id, SATI_ISTORIJE),
    ]);

    const procena = proceni(spojiMerenja(istorija, latest), z.sada());

    const bezSaveta: Omit<Rezultat, "advice" | "history"> = {
      status: procena.status,
      station: stanica,
      measuredAt: procena.measuredAt,
      values: poslednjeVrednosti(latest),
      category: procena.category,
      rule: procena.rule,
      message: procena.message,
      napomena: procena.napomena,
    };

    // K3 samo kad je status "ok" (pravilo 2). Za stale / no_data nema poziva LLM-a.
    const advice = procena.status === "ok" && procena.category ? await z.napraviSavet(bezSaveta) : null;

    return {
      ...bezSaveta,
      history: satneVrednosti(istorija),
      advice,
      message: procena.status === "ok" && advice === null ? PORUKA_BEZ_SAVETA : bezSaveta.message,
    };
  } catch (e) {
    log(`[server] assess_air_quality greška: ${razlogZaLog(e)}`);
    return rezultatGreske(stanica, porukaGreske(e));
  }
}

// ─── Tekst za content (model i hostovi bez MCP Apps) ───────────────────────

// Format vrednosti je zajednički sa ekranom A; ovde se ponovo izvozi da a2ui.ts i alati.ts rade bez izmene.
export { tekstVrednosti };

/** Kratak tekst na srpskom za svaki status. */
export function tekstRezultata(r: Rezultat): string {
  const naziv = r.station.naziv;
  if (r.status !== "ok" || !r.category) {
    return `${naziv}: ${r.message ?? "Ne dajemo preporuku."}`;
  }
  const delovi = [
    `${naziv}: ${r.values.map(tekstVrednosti).join(", ")}`,
    r.measuredAt ? ` (merenje ${prikazDatumVreme(new Date(r.measuredAt))}).` : ".",
    ` Kategorija: ${r.category.naziv} (određuje ${r.category.odredjujuca}).`,
  ];
  if (r.napomena) delovi.push(` ${r.napomena}`);
  delovi.push(r.advice ? ` Savet: ${r.advice.savet}` : ` ${r.message ?? PORUKA_BEZ_SAVETA}`);
  return delovi.join("");
}
