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

export type DobijBazu = () => Promise<BazaVode>;

const uredjajIdSema = z.string().trim().min(1).describe('Water device id from get_water_devices, e.g. "fishnet-1".');

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
      description: "Returns the latest stored water-quality measurement for a device (temperature, pH, ORP, oxygen…).",
      inputSchema: { deviceId: uredjajIdSema },
    },
    async ({ deviceId }) => {
      try {
        const m = await (await dobijBazu()).poslednjeMerenje(deviceId);
        return {
          content: tekst(m ? `${deviceId}, ${tekstMerenjaVode(m)}.` : `${deviceId}: nema merenja u bazi.`),
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
        "Returns stored water-quality measurements for a device over `hours` hours before its latest measurement (default 24).",
      inputSchema: {
        deviceId: uredjajIdSema,
        hours: z.number().int().min(1).max(168).default(24).describe("How many hours back, 1–168. Default 24."),
      },
    },
    async ({ deviceId, hours }) => {
      try {
        const merenja = await (await dobijBazu()).istorija(deviceId, hours);
        const raspon = merenja.length
          ? `, od ${prikazDatumVreme(new Date(merenja[0]!.vreme))} do ${prikazDatumVreme(new Date(merenja.at(-1)!.vreme))}`
          : "";
        return {
          content: tekst(`${deviceId}: ${merenja.length} merenja za ${hours} h${raspon}.`),
          structuredContent: { deviceId, hours, merenja },
        };
      } catch (e) {
        return greska(e);
      }
    },
  );
}
