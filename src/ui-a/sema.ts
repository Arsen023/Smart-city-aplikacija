/**
 * Provera podataka koji stižu od hosta (structuredContent alata) pre crtanja.
 * Neispravan oblik je stanje „greška“, ne pad ekrana.
 */
import { z } from "zod";
import { JEDINICA_PM, type Rezultat, type Stanica } from "../core/tipovi.js";

const velicina = z.enum(["PM2.5", "PM10"]);
const jedinica = z.literal(JEDINICA_PM);

const kategorija = z.object({
  naziv: z.enum(["Dobar", "Zadovoljavajući", "Umeren", "Loš", "Veoma loš", "Izuzetno loš"]),
  nivo: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  odredjujuca: velicina,
});

const savet = z.object({ savet: z.string(), osnov: z.string() });

/** Šema za `Rezultat` iz src/core/tipovi.ts; tip anotacije osigurava da se ne razilaze. */
export const RezultatSema: z.ZodType<Rezultat> = z.object({
  status: z.enum(["ok", "stale", "no_data", "error"]),
  station: z.object({ id: z.string(), naziv: z.string() }),
  measuredAt: z.string().nullable(),
  values: z.array(z.object({ velicina, vrednost: z.number().finite().nullable(), jedinica })),
  history: z.array(
    z.object({ vreme: z.string(), pm25: z.number().finite().nullable(), pm10: z.number().finite().nullable() }),
  ),
  category: kategorija.nullable(),
  rule: z.string(),
  advice: savet.nullable(),
  message: z.string().nullable(),
  napomena: z.string().nullable(),
});

export type StanicaZaIzbor = Pick<Stanica, "id" | "naziv">;

/** structuredContent alata get_stations: za izbor su potrebni samo id i naziv. */
const StaniceSema = z.object({
  stanice: z.array(z.object({ id: z.string().min(1), naziv: z.string().min(1) })),
});

export function procitajRezultat(ulaz: unknown): Rezultat | null {
  const r = RezultatSema.safeParse(ulaz);
  return r.success ? r.data : null;
}

export function procitajStanice(ulaz: unknown): StanicaZaIzbor[] | null {
  const r = StaniceSema.safeParse(ulaz);
  return r.success ? r.data.stanice : null;
}
