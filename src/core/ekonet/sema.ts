/**
 * Zod šeme za podatke koje K1 vraća. Svaka je vezana za tip iz tipovi.ts
 * (`satisfies z.ZodType<...>`), pa se šema i tip ne mogu razići bez greške u tsc-u.
 */
import { z } from "zod";
import { JEDINICA_PM, type DemoScenario, type Merenje, type Stanica, type Velicina } from "../tipovi.js";

export const VelicinaSema = z.enum(["PM2.5", "PM10"]) satisfies z.ZodType<Velicina>;

/** ISO 8601 sa obaveznim pomakom zone, npr. "2026-11-16T09:00:00+01:00". */
export const IsoVremeSema = z.iso.datetime({ offset: true });

export const StanicaSema = z.object({
  id: z.string().min(1),
  naziv: z.string().min(1),
  lokacija: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    opis: z.string().optional(),
  }),
  velicine: z.array(VelicinaSema),
}) satisfies z.ZodType<Stanica>;

export const MerenjeSema = z.object({
  stanicaId: z.string().min(1),
  velicina: VelicinaSema,
  // Negativna koncentracija nije moguća; 0 jeste ispravna vrednost.
  vrednost: z.number().nonnegative(),
  jedinica: z.literal(JEDINICA_PM),
  vreme: IsoVremeSema,
}) satisfies z.ZodType<Merenje>;

export const DemoScenarioSema = z
  .object({
    id: z.string().min(1),
    opis: z.string(),
    ocekivano: z.string(),
    sada: IsoVremeSema,
    stanica: StanicaSema,
    merenja: z.array(MerenjeSema),
    llmGreska: z.boolean().optional(),
  })
  .superRefine((s, ctx) => {
    s.merenja.forEach((m, i) => {
      if (m.stanicaId !== s.stanica.id) {
        ctx.addIssue({
          code: "custom",
          path: ["merenja", i, "stanicaId"],
          message: `Merenje pripada stanici "${m.stanicaId}", a scenario stanici "${s.stanica.id}"`,
        });
      }
    });
  }) satisfies z.ZodType<DemoScenario>;
