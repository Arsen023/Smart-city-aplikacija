/**
 * SQL upiti i pretvaranje redova iz baze u tipove. Čiste funkcije – testiraju se bez baze.
 *
 * pg vraća `numeric` kao tekst ("21.24") a `timestamptz` kao Date; ovde se to pretvara u
 * broj i ISO vreme sa zonom Beograda (NFR-06), uz Zod proveru.
 */
import { z } from "zod";
import { isoBeograd } from "../vreme.js";
import { GreskaBaze } from "./greske.js";
import type { MerenjeVode, UredjajVode } from "./tipovi.js";

const KOLONE_MERENJA = `uredjaj_id, vreme, temperatura_c, ph, orp, dox, con, dox_zasicenje, dco2`;

export const SQL = {
  // U tabeli su i uređaji za vazduh i vreme (db/03-vazduh-vreme.sql); alati za vodu vide samo svoje.
  uredjaji: `SELECT id, naziv, tip, lokacija FROM uredjaj WHERE tip = 'kvalitet vode' ORDER BY id`,
  poslednjeMerenje: `SELECT ${KOLONE_MERENJA} FROM merenje_vode
    WHERE uredjaj_id = $1 ORDER BY vreme DESC LIMIT 1`,
  /** $1 = uređaj, $2 = broj sati; period se računa od poslednjeg merenja tog uređaja. */
  istorija: `SELECT ${KOLONE_MERENJA} FROM merenje_vode
    WHERE uredjaj_id = $1
      AND vreme > (SELECT max(vreme) FROM merenje_vode WHERE uredjaj_id = $1) - make_interval(hours => $2::int)
    ORDER BY vreme ASC`,
  postojiUredjaj: `SELECT 1 FROM uredjaj WHERE id = $1 AND tip = 'kvalitet vode'`,
  pregled: `SELECT count(*)::int AS broj, min(vreme) AS od, max(vreme) AS do FROM merenje_vode`,
} as const;

/** Broj iz `numeric` kolone: "21.24" | 21.24 | null → 21.24 | null. */
const broj = z
  .union([z.string(), z.number()])
  .nullable()
  .transform((v, ctx) => {
    if (v === null) return null;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: "custom", message: `nije broj: ${String(v)}` });
      return z.NEVER;
    }
    return n;
  });

const vreme = z.union([z.date(), z.string()]).transform((v, ctx) => {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: "custom", message: "neispravno vreme" });
    return z.NEVER;
  }
  return isoBeograd(d);
});

const RedMerenja = z.object({
  uredjaj_id: z.string(),
  vreme,
  temperatura_c: broj,
  ph: broj,
  orp: broj,
  dox: broj,
  con: broj,
  dox_zasicenje: broj,
  dco2: broj,
});

const RedUredjaja = z.object({
  id: z.string(),
  naziv: z.string(),
  tip: z.string(),
  lokacija: z.string().nullable(),
});

function proveri<T>(sema: z.ZodType<T>, red: unknown): T {
  const r = sema.safeParse(red);
  if (!r.success) throw new GreskaBaze("neispravan_red", "Red iz baze nije očekivanog oblika.", { cause: r.error });
  return r.data;
}

export function uMerenje(red: unknown): MerenjeVode {
  const r = proveri(RedMerenja, red);
  return {
    uredjajId: r.uredjaj_id,
    vreme: r.vreme,
    temperaturaC: r.temperatura_c,
    ph: r.ph,
    orp: r.orp,
    dox: r.dox,
    con: r.con,
    doxZasicenje: r.dox_zasicenje,
    dco2: r.dco2,
  };
}

/** Vreme iz baze (Date ili tekst) → ISO sa zonom Beograda; `null` ostaje `null`. */
export function uIso(v: unknown): string | null {
  return v === null || v === undefined ? null : proveri(vreme, v);
}

export function uUredjaj(red: unknown): UredjajVode {
  return proveri(RedUredjaja, red);
}
