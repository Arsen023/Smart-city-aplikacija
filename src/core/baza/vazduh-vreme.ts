/**
 * Čitanje vazduha i vremena iz baze (tabele iz db/03-vazduh-vreme.sql, puni ih `npm run baza:uvoz`).
 * Radi nad bilo kojom funkcijom za upit (u testovima lažnom). Upiti su parametrizovani.
 *
 * Kategoriju kvaliteta vazduha ovde NE računamo: to radi src/core/pravila nad merenjima.
 */
import { z } from "zod";
import { isoBeograd } from "../vreme.js";
import { GreskaBaze } from "./greske.js";
import type { IzvrsiUpit } from "./index.js";
import type { IsoVreme } from "./tipovi.js";

export interface UredjajVazduha {
  id: string;
  naziv: string;
  izvor: string | null;
  lokacija: string | null;
  lat: number | null;
  lon: number | null;
  imaPm25: boolean;
  imaPm10: boolean;
}

export interface RedVazduhaIzBaze {
  uredjajId: string;
  vreme: IsoVreme;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
}

export interface RedVremenaIzBaze {
  uredjajId: string;
  vreme: IsoVreme;
  temperaturaC: number | null;
  vlaznostProc: number | null;
  vetarKmh: number | null;
  padavineMm: number | null;
  vremeKod: number | null;
  prognoza: boolean;
}

export interface BazaVazduhaIVremena {
  /** Uređaji za vazduh; prvo Open-Meteo (satni niz bez rupa), pa senzori. */
  uredjajiVazduha(): Promise<UredjajVazduha[]>;
  /** Izmerene (ne prognozirane) vrednosti uređaja u (od, do], najstarije prvo. */
  vazduh(uredjajId: string, od: Date, doV: Date): Promise<RedVazduhaIzBaze[]>;
  /** Poslednji izmereni red uređaja do trenutka `doV`, ili `null`. */
  poslednjiVazduh(uredjajId: string, doV: Date): Promise<RedVazduhaIzBaze | null>;
  /** Vreme (Open-Meteo) u (od, do], i prošli sati i prognoza, najstarije prvo. */
  vreme(od: Date, doV: Date): Promise<RedVremenaIzBaze[]>;
}

/** Uređaj za vreme koji se prikazuje (model, satno). */
export const UREDJAJ_VREMENA = "open-meteo-vreme-ns";

export const SQL_VV = {
  uredjajiVazduha: `SELECT u.id, u.naziv, u.izvor, u.lokacija, u.lat, u.lon,
      coalesce(bool_or(m.pm25 IS NOT NULL), false) AS ima_pm25,
      coalesce(bool_or(m.pm10 IS NOT NULL), false) AS ima_pm10
    FROM uredjaj u
    LEFT JOIN merenje_vazduha m ON m.uredjaj_id = u.id AND NOT m.prognoza
    WHERE u.tip = 'kvalitet vazduha'
    GROUP BY u.id
    ORDER BY (u.izvor = 'open-meteo') DESC, u.id`,
  vazduh: `SELECT uredjaj_id, vreme, pm25, pm10, no2, o3 FROM merenje_vazduha
    WHERE uredjaj_id = $1 AND NOT prognoza AND vreme > $2 AND vreme <= $3
    ORDER BY vreme ASC`,
  poslednjiVazduh: `SELECT uredjaj_id, vreme, pm25, pm10, no2, o3 FROM merenje_vazduha
    WHERE uredjaj_id = $1 AND NOT prognoza AND vreme <= $2
    ORDER BY vreme DESC LIMIT 1`,
  vreme: `SELECT uredjaj_id, vreme, temperatura_c, vlaznost_proc, vetar_kmh, padavine_mm, vreme_kod, prognoza
    FROM merenje_vremena
    WHERE uredjaj_id = $1 AND vreme > $2 AND vreme <= $3
    ORDER BY vreme ASC`,
} as const;

/** Broj iz `numeric` kolone ("21.24" | 21.24 | null). Temperatura sme biti negativna. */
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

const RedUredjaja = z.object({
  id: z.string(),
  naziv: z.string(),
  izvor: z.string().nullable(),
  lokacija: z.string().nullable(),
  lat: broj,
  lon: broj,
  ima_pm25: z.boolean(),
  ima_pm10: z.boolean(),
});

const RedVazduha = z.object({
  uredjaj_id: z.string(),
  vreme,
  pm25: broj,
  pm10: broj,
  no2: broj,
  o3: broj,
});

const RedVremena = z.object({
  uredjaj_id: z.string(),
  vreme,
  temperatura_c: broj,
  vlaznost_proc: broj,
  vetar_kmh: broj,
  padavine_mm: broj,
  vreme_kod: broj,
  prognoza: z.boolean(),
});

function proveri<T>(sema: z.ZodType<T>, red: unknown): T {
  const r = sema.safeParse(red);
  if (!r.success) throw new GreskaBaze("neispravan_red", "Red iz baze nije očekivanog oblika.", { cause: r.error });
  return r.data;
}

export function uUredjajVazduha(red: unknown): UredjajVazduha {
  const r = proveri(RedUredjaja, red);
  return {
    id: r.id, naziv: r.naziv, izvor: r.izvor, lokacija: r.lokacija, lat: r.lat, lon: r.lon,
    imaPm25: r.ima_pm25, imaPm10: r.ima_pm10,
  };
}

export function uRedVazduha(red: unknown): RedVazduhaIzBaze {
  const r = proveri(RedVazduha, red);
  return { uredjajId: r.uredjaj_id, vreme: r.vreme, pm25: r.pm25, pm10: r.pm10, no2: r.no2, o3: r.o3 };
}

export function uRedVremena(red: unknown): RedVremenaIzBaze {
  const r = proveri(RedVremena, red);
  return {
    uredjajId: r.uredjaj_id,
    vreme: r.vreme,
    temperaturaC: r.temperatura_c,
    vlaznostProc: r.vlaznost_proc,
    vetarKmh: r.vetar_kmh,
    padavineMm: r.padavine_mm,
    vremeKod: r.vreme_kod === null ? null : Math.round(r.vreme_kod),
    prognoza: r.prognoza,
  };
}

export function napraviBazuVazduhaIVremena(izvrsi: IzvrsiUpit): BazaVazduhaIVremena {
  const upit = async (sql: string, parametri?: unknown[]) => {
    try {
      return (await izvrsi(sql, parametri)).rows;
    } catch (e) {
      if (e instanceof GreskaBaze) throw e;
      throw new GreskaBaze("nedostupna", "Baza trenutno nije dostupna.", { cause: e });
    }
  };
  return {
    async uredjajiVazduha() {
      return (await upit(SQL_VV.uredjajiVazduha)).map(uUredjajVazduha);
    },
    async vazduh(uredjajId, od, doV) {
      return (await upit(SQL_VV.vazduh, [uredjajId, od.toISOString(), doV.toISOString()])).map(uRedVazduha);
    },
    async poslednjiVazduh(uredjajId, doV) {
      const [red] = await upit(SQL_VV.poslednjiVazduh, [uredjajId, doV.toISOString()]);
      return red === undefined ? null : uRedVazduha(red);
    },
    async vreme(od, doV) {
      return (await upit(SQL_VV.vreme, [UREDJAJ_VREMENA, od.toISOString(), doV.toISOString()])).map(uRedVremena);
    },
  };
}
