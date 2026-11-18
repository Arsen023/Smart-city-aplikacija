/**
 * Verzija B (T12): alati i ui:// resurs za A2UI prikaz.
 *
 * Koristi ISTI tok kao verzija A (proceniKvalitet, K1–K3), pa za isti zahtev vraća
 * isti Rezultat u structuredContent (FR-13). Razlika je samo u tome što uz njega idu
 * A2UI poruke koje ekran iscrtava. Odvojeno od alati.ts da Sara i Luka ne menjaju isti fajl.
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
import type { Rezultat, Stanica } from "../core/tipovi.js";
import { a2uiResurs, porukeAzuriranja, porukeEkrana } from "./a2ui.js";
import type { DobijZavisnosti } from "./alati.js";
import { porukaGreske, proceniKvalitet, rezultatGreske, tekstRezultata, type ZavisnostiProcene } from "./procena.js";

const DIST_DIR = path.join(import.meta.dirname, "..", "..", "dist");
export const UI_B_RESOURCE_URI = "ui://air/dashboard-a2ui";

const stationIdSema = z.string().trim().min(1);

/** Rezultat, stanice za izbor i „sada“ – isto kao verzija A, greške postaju status "error". */
async function proceni(
  dobijZavisnosti: DobijZavisnosti,
  stationId?: string,
): Promise<{ r: Rezultat; stanice: Stanica[]; sada: Date }> {
  let z: ZavisnostiProcene;
  try {
    z = await dobijZavisnosti();
  } catch (e) {
    console.error(`[server] izvor podataka: ${e instanceof Error ? e.message : "nepoznata greška"}`);
    const r = rezultatGreske({ id: stationId ?? "", naziv: stationId ?? "nepoznata stanica" }, porukaGreske(e));
    return { r, stanice: [], sada: new Date() };
  }
  const r = await proceniKvalitet(z, stationId);
  // Lista stanica je samo za izbor na ekranu; ako ne uspe, ekran i dalje radi.
  const stanice = await z.klijent.getStations().catch(() => []);
  return { r, stanice, sada: z.sada() };
}

export function registrujA2ui(server: McpServer, dobijZavisnosti: DobijZavisnosti): void {
  // Alat koji poziva model: ceo ekran (createSurface + komponente + podaci).
  registerAppTool(
    server,
    "assess_air_quality_a2ui",
    {
      title: "Kvalitet vazduha (A2UI)",
      description:
        "Same as assess_air_quality (latest PM2.5/PM10, EAQI category, 24 h history, short advice), " +
        "but the screen is rendered with A2UI (version B).",
      inputSchema: {
        stationId: stationIdSema.optional().describe("Station id from get_stations. If omitted, the first station is used."),
      },
      _meta: { ui: { resourceUri: UI_B_RESOURCE_URI, visibility: ["model", "app"] } },
    },
    async ({ stationId }): Promise<CallToolResult> => {
      const { r, stanice, sada } = await proceni(dobijZavisnosti, stationId);
      return {
        content: [{ type: "text", text: tekstRezultata(r) }, a2uiResurs(porukeEkrana(r, stanice, sada))],
        structuredContent: { ...r },
      };
    },
  );

  // Alat koji poziva samo ekran („Osveži“, „Prikaži“): novi izgled i podaci, bez createSurface.
  registerAppTool(
    server,
    "osvezi_a2ui",
    {
      title: "Osveži (A2UI)",
      description: "Ponovo računa procenu za izabranu stanicu i vraća A2UI komponente i podatke.",
      inputSchema: { stationId: stationIdSema.optional() },
      _meta: { ui: { resourceUri: UI_B_RESOURCE_URI, visibility: ["app"] } },
    },
    async ({ stationId }): Promise<CallToolResult> => {
      const { r, stanice, sada } = await proceni(dobijZavisnosti, stationId);
      return {
        content: [a2uiResurs(porukeAzuriranja(r, stanice, sada))],
        structuredContent: { ...r },
      };
    },
  );

  registerAppResource(
    server,
    "Kvalitet vazduha (verzija B, A2UI)",
    UI_B_RESOURCE_URI,
    { description: "Ekran verzije B: isti podaci kao verzija A, iscrtani pomoću A2UI." },
    async () => {
      const html = await fs.readFile(path.join(DIST_DIR, "ui-b", "index.html"), "utf-8");
      return {
        contents: [
          {
            uri: UI_B_RESOURCE_URI,
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
