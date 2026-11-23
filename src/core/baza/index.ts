/**
 * Sloj baze (PostgreSQL) za merenja kvaliteta vode – tabele iz db/01-sema.sql.
 *
 * `napraviBazu(izvrsi)` radi nad bilo kojom funkcijom za upit (u testovima lažnom), a
 * `poveziBazu(env)` pravi pravu vezu preko paketa `pg` i promenljive DATABASE_URL.
 * Server koristi samo ovaj modul; prikazi (src/ui-*) i chat ne pristupaju bazi.
 */
import { GreskaBaze } from "./greske.js";
import type { BazaVode } from "./tipovi.js";
import { SQL, uIso, uMerenje, uUredjaj } from "./upiti.js";

export { GreskaBaze, type KodGreskeBaze } from "./greske.js";
export type { BazaVode, MerenjeVode, UredjajVode } from "./tipovi.js";
export {
  napraviBazuVazduhaIVremena,
  UREDJAJ_VREMENA,
  type BazaVazduhaIVremena,
  type RedVazduhaIzBaze,
  type RedVremenaIzBaze,
  type UredjajVazduha,
} from "./vazduh-vreme.js";

/** Izvršava parametrizovan upit ($1, $2…) i vraća redove. */
export type IzvrsiUpit = (sql: string, parametri?: unknown[]) => Promise<{ rows: unknown[] }>;

export function napraviBazu(izvrsi: IzvrsiUpit, zatvori: () => Promise<void> = async () => {}): BazaVode {
  const upit = async (sql: string, parametri?: unknown[]) => {
    try {
      return (await izvrsi(sql, parametri)).rows;
    } catch (e) {
      if (e instanceof GreskaBaze) throw e;
      throw new GreskaBaze("nedostupna", "Baza trenutno nije dostupna.", { cause: e });
    }
  };

  async function proveriUredjaj(uredjajId: string) {
    if ((await upit(SQL.postojiUredjaj, [uredjajId])).length === 0) {
      throw new GreskaBaze("nepoznat_uredjaj", `Uređaj „${uredjajId}“ ne postoji u bazi.`);
    }
  }

  return {
    async uredjaji() {
      return (await upit(SQL.uredjaji)).map(uUredjaj);
    },
    async poslednjeMerenje(uredjajId) {
      await proveriUredjaj(uredjajId);
      const [red] = await upit(SQL.poslednjeMerenje, [uredjajId]);
      return red === undefined ? null : uMerenje(red);
    },
    async istorija(uredjajId, sati = 24) {
      if (!Number.isInteger(sati) || sati < 1 || sati > 168) {
        throw new RangeError("sati mora biti ceo broj od 1 do 168");
      }
      await proveriUredjaj(uredjajId);
      return (await upit(SQL.istorija, [uredjajId, sati])).map(uMerenje);
    },
    async pregled() {
      const [red] = (await upit(SQL.pregled)) as { broj?: number; od?: unknown; do?: unknown }[];
      return { brojMerenja: Number(red?.broj ?? 0), od: uIso(red?.od), do: uIso(red?.do) };
    },
    zatvori,
  };
}

/** DATABASE_URL iz okruženja; bez njega – jasna greška, ne pad servera. */
export function procitajUrlBaze(env: Record<string, string | undefined> = process.env): string {
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    throw new GreskaBaze(
      "konfiguracija",
      "Baza nije podešena: u .env dodaj DATABASE_URL=postgres://postgres:LOZINKA@localhost:5432/smartcity",
    );
  }
  return url;
}

/** Prava veza preko `pg` (paket se učitava tek ovde, da testovi i ekrani ne zavise od njega). */
export async function poveziBazu(env: Record<string, string | undefined> = process.env): Promise<BazaVode> {
  const veza = await poveziVezu(env);
  return napraviBazu(veza.izvrsi, veza.zatvori);
}

/** Sirova veza (izvrši upit + zatvori) – za uvoz podataka (`npm run baza:uvoz`). */
export async function poveziVezu(
  env: Record<string, string | undefined> = process.env,
): Promise<{ izvrsi: IzvrsiUpit; zatvori: () => Promise<void> }> {
  const url = procitajUrlBaze(env);
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: url, max: 5, connectionTimeoutMillis: 3000 });
  return {
    izvrsi: (sql, parametri) => pool.query(sql, parametri),
    zatvori: () => pool.end(),
  };
}
