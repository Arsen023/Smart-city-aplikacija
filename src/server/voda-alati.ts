/**
 * MCP alati za kvalitet vode iz PostgreSQL baze (FishNET, db/). Samo čitanje.
 *
 * Bez DATABASE_URL ili kad baza ne radi, alati vraćaju `isError` sa porukom na srpskom;
 * server i alati za vazduh rade dalje (NFR-05).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { GreskaBaze, type BazaVode, type MerenjeVode } from "../core/baza/index.js";
import { prikazDatumVreme } from "../core/vreme.js";
import { protekloVreme } from "../zajednicko/format.js";

export type DobijBazu = () => Promise<BazaVode>;

/**
 * Id uređaja nije obavezan. Prihvata i "" i null: modeli tako kažu „ne znam id“, a Groq proverava
 * poziv prema ovoj šemi – stroža šema (minLength 1) je davala tool_use_failed.
 */
const uredjajIdSema = z
  .string()
  .nullish()
  .describe('Water device id from get_water_devices, e.g. "fishnet-1". Omit it (or leave empty) to use the first device.');

/** Uređaj iz argumenta, ili prvi iz baze kad ga model ne navede. */
async function izaberiUredjaj(baza: BazaVode, deviceId: string | null | undefined): Promise<string> {
  const id = deviceId?.trim();
  if (id) return id;
  const [prvi] = await baza.uredjaji();
  if (!prvi) throw new GreskaBaze("nepoznat_uredjaj", "U bazi nema uređaja za vodu.");
  return prvi.id;
}

function tekst(t: string): CallToolResult["content"] {
  return [{ type: "text", text: t }];
}

/** Poruka bez detalja veze (host, korisnik, lozinka). */
function greska(e: unknown): CallToolResult {
  const poruka =
    e instanceof GreskaBaze && e.kod !== "neispravan_red"
      ? e.message
      : e instanceof RangeError
        ? e.message
        : "Podaci o vodi trenutno nisu dostupni.";
  if (!(e instanceof GreskaBaze && e.kod !== "nedostupna")) {
    console.error(`[baza] ${e instanceof Error ? `${e.name}: ${e.message}` : "nepoznata greška"}`);
  }
  return { isError: true, content: tekst(poruka) };
}

const broj = new Intl.NumberFormat("sr-Latn", { maximumFractionDigits: 2 });
const v = (n: number | null, jedinica = "") => (n === null ? "nije dostupno" : `${broj.format(n)}${jedinica}`);

/** "20.11.2026. 14:09: temperatura 9,55 °C, pH 8,44, …" */
export function tekstMerenjaVode(m: MerenjeVode): string {
  return (
    `${prikazDatumVreme(new Date(m.vreme))}: temperatura ${v(m.temperaturaC, " °C")}, pH ${v(m.ph)}, ` +
    `ORP ${v(m.orp, " mV")}, kiseonik ${v(m.dox, " mg/L")} (${v(m.doxZasicenje, " %")}), ` +
    `provodljivost ${v(m.con)}, CO2 ${v(m.dco2)}`
  );
}

type VelicinaVode = "temperaturaC" | "ph" | "orp" | "dox" | "doxZasicenje" | "con" | "dco2";
const VELICINE_VODE: { kljuc: VelicinaVode; naziv: string; jedinica: string }[] = [
  { kljuc: "temperaturaC", naziv: "temperatura", jedinica: " °C" },
  { kljuc: "ph", naziv: "pH", jedinica: "" },
  { kljuc: "dox", naziv: "kiseonik", jedinica: " mg/L" },
  { kljuc: "doxZasicenje", naziv: "zasićenje kiseonikom", jedinica: " %" },
  { kljuc: "orp", naziv: "ORP", jedinica: " mV" },
  { kljuc: "con", naziv: "provodljivost", jedinica: "" },
  { kljuc: "dco2", naziv: "CO2", jedinica: "" },
];

/**
 * Sažetak istorije za model: za svaku veličinu prva → poslednja vrednost i raspon,
 * da AI može da opiše promenu bez slanja svih merenja (štedi tokene).
 */
export function sazetakIstorijeVode(merenja: MerenjeVode[]): string {
  return VELICINE_VODE.flatMap(({ kljuc, naziv, jedinica }) => {
    const vr = merenja.map((m) => m[kljuc]).filter((x): x is number => x !== null);
    if (vr.length === 0) return [];
    const min = Math.min(...vr);
    const max = Math.max(...vr);
    return [`${naziv} ${v(vr[0]!)} → ${v(vr.at(-1)!, jedinica)} (najmanje ${v(min)}, najviše ${v(max)})`];
  }).join("; ");
}

export function registrujAlateVode(server: McpServer, dobijBazu: DobijBazu): void {
  server.registerTool(
    "get_water_devices",
    {
      title: "Uređaji za kvalitet vode",
      description: "Lists water-quality devices (FishNET) stored in the database.",
      inputSchema: {},
    },
    async () => {
      try {
        const uredjaji = await (await dobijBazu()).uredjaji();
        const spisak = uredjaji.map((u) => `${u.naziv} (${u.id})`).join(", ");
        return {
          content: tekst(uredjaji.length ? `Uređaji za vodu: ${spisak}.` : "U bazi nema uređaja za vodu."),
          structuredContent: { uredjaji },
        };
      } catch (e) {
        return greska(e);
      }
    },
  );

  server.registerTool(
    "get_water_latest",
    {
      title: "Poslednje merenje vode",
      description:
        "Latest water-quality measurement (FishNET sensor in water): water temperature, pH, ORP, dissolved oxygen and " +
        "saturation, conductivity, CO2, with measurement time. Use for any question about water quality.",
      inputSchema: { deviceId: uredjajIdSema },
    },
    async ({ deviceId }) => {
      try {
        const baza = await dobijBazu();
        deviceId = await izaberiUredjaj(baza, deviceId);
        const m = await baza.poslednjeMerenje(deviceId);
        return {
          content: tekst(
            m
              ? `${deviceId}, ${tekstMerenjaVode(m)} (${protekloVreme(m.vreme, new Date())}).`
              : `${deviceId}: nema merenja u bazi.`,
          ),
          structuredContent: { deviceId, merenje: m },
        };
      } catch (e) {
        return greska(e);
      }
    },
  );

  server.registerTool(
    "get_water_history",
    {
      title: "Istorija merenja vode",
      description:
        "Water-quality measurements over `hours` hours before the device's latest measurement (default 24). " +
        "Use for trends (how water temperature, pH or oxygen changed).",
      inputSchema: {
        deviceId: uredjajIdSema,
        hours: z.number().int().min(1).max(168).default(24).describe("How many hours back, 1–168. Default 24."),
      },
    },
    async ({ deviceId, hours }) => {
      try {
        const baza = await dobijBazu();
        deviceId = await izaberiUredjaj(baza, deviceId);
        const merenja = await baza.istorija(deviceId, hours);
        const raspon = merenja.length
          ? `, od ${prikazDatumVreme(new Date(merenja[0]!.vreme))} do ${prikazDatumVreme(new Date(merenja.at(-1)!.vreme))}`
          : "";
        return {
          content: tekst(
            `${deviceId}: ${merenja.length} merenja za ${hours} h${raspon}.` +
              (merenja.length ? ` Promena: ${sazetakIstorijeVode(merenja)}.` : ""),
          ),
          structuredContent: { deviceId, hours, merenja },
        };
      } catch (e) {
        return greska(e);
      }
    },
  );
}
