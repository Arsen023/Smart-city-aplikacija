/**
 * Tipovi za merenja kvaliteta vode iz baze (FishNET, tabela `merenje_vode`, db/01-sema.sql).
 * Odvojeni od src/core/tipovi.ts: to je ugovor za vazduh (PM2.5, PM10), a voda je poseban izvor.
 */

/** ISO 8601 vreme sa zonom Europe/Belgrade, npr. "2023-01-23T01:07:59+01:00". */
export type IsoVreme = string;

export interface UredjajVode {
  id: string;
  naziv: string;
  tip: string;
  lokacija: string | null;
}

/** Jedno merenje; vrednost koja nedostaje je `null`, nikad 0. */
export interface MerenjeVode {
  uredjajId: string;
  vreme: IsoVreme;
  /** °C */
  temperaturaC: number | null;
  ph: number | null;
  /** mV (pretpostavka, potvrditi) */
  orp: number | null;
  /** rastvoreni kiseonik, mg/L (pretpostavka) */
  dox: number | null;
  /** provodljivost */
  con: number | null;
  /** zasićenje kiseonikom, % */
  doxZasicenje: number | null;
  /** rastvoreni CO2 (u API-ju "dc02") */
  dco2: number | null;
}

/** Šta modul baze nudi serveru. */
export interface BazaVode {
  uredjaji(): Promise<UredjajVode[]>;
  /** Poslednje merenje uređaja, `null` ako nema nijednog. */
  poslednjeMerenje(uredjajId: string): Promise<MerenjeVode | null>;
  /**
   * Merenja za `sati` sati (1–168) unazad od POSLEDNJEG merenja uređaja, ne od sadašnjeg trenutka.
   * Tako i stara istorija (npr. 2023) daje pun grafikon. Najstarije prvo.
   */
  istorija(uredjajId: string, sati?: number): Promise<MerenjeVode[]>;
  /** Broj merenja i raspon vremena – za proveru veze (`npm run baza:provera`). */
  pregled(): Promise<{ brojMerenja: number; od: IsoVreme | null; do: IsoVreme | null }>;
  zatvori(): Promise<void>;
}
