/**
 * K4 – četiri MCP alata i ui:// resurs za verziju A.
 *
 * Alati samo pozivaju src/core/ (preko procena.ts i K1 klijenta). Svaki vraća kratak
 * tekst na srpskom u `content` i objekat u `structuredContent`. Greške ne idu ka hostu
 * kao izuzetak (NFR-05).
 */
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { GreskaEkonet } from "../core/ekonet/index.js";
import { JEDINICA_PM, type Merenje, type Velicina } from "../core/tipovi.js";
import { prikazDatumVreme } from "../core/vreme.js";
import {
  porukaGreske,
  proceniKvalitet,
  rezultatGreske,
  tekstRezultata,
  tekstVrednosti,
  type ZavisnostiProcene,
} from "./procena.js";

const DIST_DIR = path.join(import.meta.dirname, "..", "..", "dist");
export const UI_A_RESOURCE_URI = "ui://air/dashboard-a";

/** Zavisnosti se dobijaju tek pri pozivu alata, da greška u podešavanju postane odgovor, ne pad servera. */
export type DobijZavisnosti = () => Promise<ZavisnostiProcene>;

const stationIdSema = z.string().trim().min(1).describe("Station id from get_stations, e.g. \"demo-liman\".");

function tekst(t: string): CallToolResult["content"] {
  return [{ type: "text", text: t }];
}

/** Greška za get_* alate: poruka na srpskom, bez detalja koji bi otkrili ključeve. */
function greskaAlata(e: unknown): CallToolResult {
  const poruka =
    e instanceof GreskaEkonet && e.kod !== "neispravan_odgovor"
      ? e.message
      : "Podaci trenutno nisu dostupni. Pokušajte ponovo kasnije.";
  return { isError: true, content: tekst(poruka) };
}

/** "PM2.5 12,4 µg/m³ (16.11.2026. 09:00), PM10 …" – poslednje merenje po veličini. */
function tekstMerenja(merenja: Merenje[]): string {
  const velicine: Velicina[] = ["PM2.5", "PM10"];
  return velicine
    .map((velicina) => {
      const m = merenja.filter((x) => x.velicina === velicina).at(-1);
      const v = tekstVrednosti({ velicina, vrednost: m ? m.vrednost : null, jedinica: JEDINICA_PM });
      return m ? `${v} (${prikazDatumVreme(new Date(m.vreme))})` : v;
    })
    .join(", ");
}

export function registrujAlate(server: McpServer, dobijZavisnosti: DobijZavisnosti): void {
  server.registerTool(
    "get_stations",
    {
      title: "Merne stanice",
      description: "Lists the available air-quality measuring stations (id, name, location, measured pollutants).",
      inputSchema: {},
    },
    async () => {
      try {
        const { klijent } = await dobijZavisnosti();
        const stanice = await klijent.getStations();
        const spisak = stanice.map((s) => `${s.naziv} (${s.id})`).join(", ");
        return {
          content: tekst(stanice.length ? `Dostupne stanice: ${spisak}.` : "Nema dostupnih mernih stanica."),
          structuredContent: { stanice },
        };
      } catch (e) {
        return greskaAlata(e);
      }
    },
  );

  server.registerTool(
    "get_latest",
    {
      title: "Poslednja merenja",
      description: "Returns the latest PM2.5 and PM10 measurement for a station, without any assessment.",
      inputSchema: { stationId: stationIdSema },
    },
    async ({ stationId }) => {
      try {
        const { klijent } = await dobijZavisnosti();
        const merenja = await klijent.getLatest(stationId);
        return {
          content: tekst(
            merenja.length ? `${stationId}: ${tekstMerenja(merenja)}.` : `${stationId}: nema merenja PM2.5 ni PM10.`,
          ),
          structuredContent: { stationId, merenja },
        };
      } catch (e) {
        return greskaAlata(e);
      }
    },
  );

  server.registerTool(
    "get_history",
    {
      title: "Istorija merenja",
      description: "Returns raw PM2.5 and PM10 measurements for a station over the last `hours` hours (default 24).",
      inputSchema: {
        stationId: stationIdSema,
        hours: z.number().int().min(1).max(168).default(24).describe("How many hours back, 1–168. Default 24."),
      },
    },
    async ({ stationId, hours }) => {
      try {
        const { klijent } = await dobijZavisnosti();
        const merenja = await klijent.getHistory(stationId, hours);
        return {
          content: tekst(`${stationId}: ${merenja.length} merenja za poslednjih ${hours} h.`),
          structuredContent: { stationId, hours, merenja },
        };
      } catch (e) {
        return greskaAlata(e);
      }
    },
  );

  registerAppTool(
    server,
    "assess_air_quality",
    {
      title: "Kvalitet vazduha",
      description:
        "Answers whether it is a good time for a walk or outdoor training at a station: latest PM2.5/PM10, " +
        "EAQI category, 24 h history and a short advice. Call when the user asks about air quality or going outside.",
      inputSchema: {
        stationId: stationIdSema.optional().describe("Station id from get_stations. If omitted, the first station is used."),
      },
      _meta: { ui: { resourceUri: UI_A_RESOURCE_URI } },
    },
    async ({ stationId }) => {
      let zavisnosti: ZavisnostiProcene;
      try {
        zavisnosti = await dobijZavisnosti();
      } catch (e) {
        console.error(`[server] izvor podataka: ${e instanceof Error ? e.message : "nepoznata greška"}`);
        const r = rezultatGreske({ id: stationId ?? "", naziv: stationId ?? "nepoznata stanica" }, porukaGreske(e));
        return { content: tekst(tekstRezultata(r)), structuredContent: { ...r } };
      }
      const r = await proceniKvalitet(zavisnosti, stationId);
      return { content: tekst(tekstRezultata(r)), structuredContent: { ...r } };
    },
  );

  registerAppResource(
    server,
    "Kvalitet vazduha (verzija A)",
    UI_A_RESOURCE_URI,
    { description: "Ekran verzije A: kvalitet vazduha i preporuka za šetnju ili trening." },
    async () => {
      const html = await fs.readFile(path.join(DIST_DIR, "ui-a", "index.html"), "utf-8");
      return {
        contents: [
          {
            uri: UI_A_RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            // Ekran ne treba nijedan spoljni domen: sve je u bundle-u, podaci stižu preko hosta.
            _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } },
          },
        ],
      };
    },
  );
}
