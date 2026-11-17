/**
 * Verzija B (PROBA, T03): alati i ui:// resurs za A2UI prikaz.
 * Odvojeno od server.ts da Sara i Luka ne menjaju isti fajl.
 */
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  a2uiResurs,
  DEMO_SCENARIJI,
  podaciZaPrikaz,
  porukaPodaci,
  porukeEkrana,
} from "./a2ui.js";

const DIST_DIR = path.join(import.meta.dirname, "..", "..", "dist");
export const A2UI_RESOURCE_URI = "ui://air/dashboard-a2ui";

const ulaz = {
  scenario: z
    .enum(DEMO_SCENARIJI)
    .default("s1-dobar")
    .describe("Demo scenario iz fixtures/ (s1-dobar, s2-los, s3-zastareo, s4-bez-pm25, s5-llm-greska, s6-bez-podataka)"),
};

export function registrujA2uiProbu(server: McpServer): void {
  // Alat koji poziva model: vraća ceo ekran (createSurface + komponente + podaci).
  registerAppTool(
    server,
    "assess_air_quality_a2ui",
    {
      title: "Kvalitet vazduha (A2UI proba)",
      description:
        "Procena da li je dobro vreme za šetnju ili trening napolju, prikazana kroz A2UI. Proba na demo podacima.",
      inputSchema: ulaz,
      _meta: { ui: { resourceUri: A2UI_RESOURCE_URI, visibility: ["model", "app"] } },
    },
    async ({ scenario }) => {
      const p = podaciZaPrikaz(scenario);
      return {
        content: [
          // Tekst za hostove bez MCP Apps i za model
          { type: "text", text: `${p.stanica}: ${p.kategorija}. PM2.5 ${p.pm25}, PM10 ${p.pm10}. ${p.poruka}`.trim() },
          a2uiResurs(porukeEkrana(scenario)),
        ],
      };
    },
  );

  // Alat koji poziva samo prikaz (dugme „Osveži“): vraća samo nove podatke.
  registerAppTool(
    server,
    "osvezi_a2ui",
    {
      title: "Osveži (A2UI)",
      description: "Ponovo računa procenu i vraća samo novi A2UI data model.",
      inputSchema: ulaz,
      _meta: { ui: { resourceUri: A2UI_RESOURCE_URI, visibility: ["app"] } },
    },
    async ({ scenario }) => ({
      content: [a2uiResurs([porukaPodaci(podaciZaPrikaz(scenario))])],
    }),
  );

  registerAppResource(server, A2UI_RESOURCE_URI, A2UI_RESOURCE_URI, {}, async () => {
    const html = await fs.readFile(path.join(DIST_DIR, "ui-b", "index.html"), "utf-8");
    return { contents: [{ uri: A2UI_RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html }] };
  });
}
