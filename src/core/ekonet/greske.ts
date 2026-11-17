/**
 * Greške K1 klijenta. Server (T09) ih hvata i vraća rezultat sa statusom `error`.
 * Kod `nedostupno` (API ne odgovara) dodaje se sa pravim klijentom posle T01.
 */

export type KodGreskeEkonet =
  /** Traženi `stationId` ne postoji u izvoru. */
  | "nepoznata_stanica"
  /** Podaci iz izvora ne prolaze Zod proveru ili nisu ispravan JSON. */
  | "neispravan_odgovor"
  /** Pogrešno ili nepodržano podešavanje (EKONET_IZVOR, EKONET_SCENARIO). */
  | "konfiguracija";

export class GreskaEkonet extends Error {
  readonly kod: KodGreskeEkonet;

  constructor(kod: KodGreskeEkonet, poruka: string, options?: ErrorOptions) {
    super(poruka, options);
    this.name = "GreskaEkonet";
    this.kod = kod;
  }
}
