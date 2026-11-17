/**
 * Zajednički tipovi za ceo projekat – ugovor između K1 (ekonet), K2 (pravila),
 * K3 (llm), K4 (server) i oba prikaza (ui-a, ui-b).
 *
 * Izvor: specifikacija, poglavlje 7 (primer rezultata assess_air_quality) i 6.3.
 * Menja se samo uz dogovor Sare i Luke.
 *
 * Konvencije:
 * - Vreme je uvek ISO 8601 string sa zonom Europe/Belgrade, npr. "2026-11-16T09:00:00+01:00".
 * - Vrednost koja ne postoji je `null`, nikad 0 (FR-04).
 */

// ─── Osnovni pojmovi ────────────────────────────────────────────────────────

/** Veličine koje prototip prati. Proširuje se ako dodamo NO2, O3… */
export type Velicina = "PM2.5" | "PM10";

/** Jedinica za PM čestice. */
export const JEDINICA_PM = "µg/m³";
export type Jedinica = typeof JEDINICA_PM;

/** ISO 8601 vreme sa zonom, npr. "2026-11-16T09:00:00+01:00". */
export type IsoVreme = string;

/**
 * Status celog rezultata:
 * - ok      – sveže merenje, kategorija izračunata
 * - stale   – poslednje merenje starije od praga svežine (FR-08)
 * - no_data – nema nijedne PM vrednosti
 * - error   – API ne odgovara ili druga greška
 */
export type Status = "ok" | "stale" | "no_data" | "error";

// ─── K1: podaci sa ekoNET-a (Sara) ──────────────────────────────────────────

/** Stanica iz get_stations (FR-01). */
export interface Stanica {
  id: string;
  naziv: string;
  lokacija: {
    lat: number;
    lon: number;
    /** Opisno, npr. "Liman, Novi Sad". */
    opis?: string;
  };
  /** Koje od praćenih veličina stanica meri. */
  velicine: Velicina[];
}

/**
 * Jedno sirovo merenje, normalizovano iz ekoNET odgovora.
 * Može biti češće od jednom na sat – satni prosek pravi K2 (6.2).
 */
export interface Merenje {
  stanicaId: string;
  velicina: Velicina;
  vrednost: number;
  jedinica: Jedinica;
  vreme: IsoVreme;
}

/** Poslednja vrednost jedne veličine za prikaz (FR-03, FR-04). */
export interface PoslednjaVrednost {
  velicina: Velicina;
  /** `null` = „nije dostupno“, nikad 0. */
  vrednost: number | null;
  jedinica: Jedinica;
}

/** Jedna tačka grafikona za 24 h (FR-05, FR-06). */
export interface SatnaVrednost {
  vreme: IsoVreme;
  pm25: number | null;
  pm10: number | null;
}

// ─── K2: modul pravila (Luka) ───────────────────────────────────────────────

/** EAQI kategorije, od najbolje (1) do najgore (6). */
export type NazivKategorije =
  | "Dobar"
  | "Zadovoljavajući"
  | "Umeren"
  | "Loš"
  | "Veoma loš"
  | "Izuzetno loš";

export type NivoKategorije = 1 | 2 | 3 | 4 | 5 | 6;

export interface Kategorija {
  naziv: NazivKategorije;
  nivo: NivoKategorije;
  /** Veličina sa najlošijim podindeksom, koja je odredila kategoriju. */
  odredjujuca: Velicina;
}

/** Šta K2 vraća serveru. Nikad ne zove LLM. */
export interface ProcenaPravila {
  status: Exclude<Status, "error">;
  /** `null` kad status nije "ok". */
  category: Kategorija | null;
  /** Vreme poslednjeg merenja korišćenog za procenu, `null` ako ga nema. */
  measuredAt: IsoVreme | null;
  /** Opis pravila za osnov saveta, npr. "EAQI, satne vrednosti, najlošiji podindeks". */
  rule: string;
  /** Objašnjenje za stale / no_data, npr. „Poslednje merenje je od 15.11. u 14:00.“ */
  message: string | null;
  /** Napomena kad nedostaje jedna veličina, npr. „PM2.5 nije dostupno, kategorija iz PM10.“ */
  napomena: string | null;
}

// ─── K3: LLM savet (Luka) ───────────────────────────────────────────────────

/** Izlaz LLM-a posle provere na serveru (6.4). */
export interface Savet {
  /** 1–2 rečenice, srpski latinicom. */
  savet: string;
  /** Na čemu se savet zasniva: stanica, vrednosti, vreme, pravilo (FR-11). */
  osnov: string;
}

// ─── K4: rezultat alata assess_air_quality (Sara) ───────────────────────────

/**
 * Kompletan rezultat za ekran. Isti za verziju A i B (FR-13).
 * Imena polja prate primer iz poglavlja 7 specifikacije.
 */
export interface Rezultat {
  status: Status;
  station: { id: string; naziv: string };
  measuredAt: IsoVreme | null;
  values: PoslednjaVrednost[];
  history: SatnaVrednost[];
  /** `null` kad status nije "ok". */
  category: Kategorija | null;
  rule: string;
  /** `null` kad status nije "ok" ili LLM nije dostupan / izlaz nije prošao proveru (FR-12). */
  advice: Savet | null;
  /** Razlog za stale / no_data / error, ili zašto savet izostaje. */
  message: string | null;
  /** Napomena o veličini koja nedostaje (scenario S4). */
  napomena: string | null;
}

// ─── Potpisi funkcija između modula ─────────────────────────────────────────
// Implementacije su u svojim folderima; ovde je samo dogovor šta se poziva.

/** K1 – src/core/ekonet (Sara). */
export interface EkonetKlijent {
  getStations(): Promise<Stanica[]>;
  /** Poslednja merenja za stanicu (sve praćene veličine). */
  getLatest(stationId: string): Promise<Merenje[]>;
  /** Merenja za poslednjih `hours` sati (podrazumevano 24). */
  getHistory(stationId: string, hours?: number): Promise<Merenje[]>;
}

/** K2 – src/core/pravila (Luka). Deterministička, bez LLM-a, pokrivena testovima. */
export type ProceniFn = (merenja: Merenje[], sada: Date) => ProcenaPravila;

/** K2 – satne vrednosti za grafikon iz sirovih merenja (Luka). */
export type SatneVrednostiFn = (merenja: Merenje[]) => SatnaVrednost[];

/**
 * K3 – src/core/llm (Luka). Prima samo strukturisani rezultat, bez sirovih podataka.
 * Vraća `null` ako LLM nije dostupan ili izlaz ne prođe proveru.
 */
export type NapraviSavetFn = (
  rezultat: Omit<Rezultat, "advice" | "history">,
) => Promise<Savet | null>;
