/**
 * Greške sloja baze. Server ih pretvara u poruku na srpskom, bez detalja veze (lozinka, host).
 */
export type KodGreskeBaze =
  /** DATABASE_URL nije podešen u .env. */
  | "konfiguracija"
  /** Baza ne odgovara (nije pokrenuta, pogrešna lozinka, nema baze). */
  | "nedostupna"
  /** Red iz baze nije očekivanog oblika. */
  | "neispravan_red"
  /** Traženi uređaj ne postoji. */
  | "nepoznat_uredjaj";

export class GreskaBaze extends Error {
  readonly kod: KodGreskeBaze;

  constructor(kod: KodGreskeBaze, poruka: string, options?: ErrorOptions) {
    super(poruka, options);
    this.name = "GreskaBaze";
    this.kod = kod;
  }
}
