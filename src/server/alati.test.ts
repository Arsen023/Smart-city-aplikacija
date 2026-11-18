import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { napraviIzvor, type DemoScenarioId } from "../core/ekonet/index.js";
import type { Savet } from "../core/tipovi.js";
import { META_SADA, registrujAlate, UI_A_RESOURCE_URI, type DobijZavisnosti } from "./alati.js";

const SAVET: Savet = { savet: "Vazduh je u redu za šetnju.", osnov: "Demo stanica, EAQI." };

function zavisnostiZa(scenario: DemoScenarioId): DobijZavisnosti {
  return async () => {
    const izvor = await napraviIzvor({ EKONET_SCENARIO: scenario });
    return { klijent: izvor.klijent, sada: izvor.sada, napraviSavet: async () => SAVET, log: () => {} };
  };
}

async function povezi(dobij: DobijZavisnosti): Promise<Client> {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registrujAlate(server, dobij);
  const [klijentT, serverT] = InMemoryTransport.createLinkedPair();
  const klijent = new Client({ name: "test-klijent", version: "0.0.0" });
  await Promise.all([server.connect(serverT), klijent.connect(klijentT)]);
  return klijent;
}

async function pozovi(k: Client, name: string, args: Record<string, unknown> = {}): Promise<CallToolResult> {
  return (await k.callTool({ name, arguments: args })) as CallToolResult;
}

function tekstIz(r: CallToolResult): string {
  const t = r.content.find((c) => c.type === "text");
  return t && t.type === "text" ? t.text : "";
}

describe("MCP alati (demo s1-dobar)", () => {
  let k: Client;
  before(async () => {
    k = await povezi(zavisnostiZa("s1-dobar"));
  });
  after(async () => {
    await k.close();
  });

  test("registrovana su 4 alata, samo assess_air_quality ima ekran", async () => {
    const { tools } = await k.listTools();
    const imena = tools.map((t) => t.name).sort();
    assert.deepEqual(imena, ["assess_air_quality", "get_history", "get_latest", "get_stations"]);
    const assess = tools.find((t) => t.name === "assess_air_quality");
    const ui = assess?._meta?.ui as { resourceUri?: string } | undefined;
    assert.equal(ui?.resourceUri, UI_A_RESOURCE_URI);
    for (const t of tools.filter((t) => t.name !== "assess_air_quality")) assert.equal(t._meta?.ui, undefined);
  });

  test("ui:// resurs je registrovan", async () => {
    const { resources } = await k.listResources();
    assert.ok(resources.some((r) => r.uri === UI_A_RESOURCE_URI));
  });

  test("get_stations", async () => {
    const r = await pozovi(k, "get_stations");
    assert.notEqual(r.isError, true);
    assert.match(tekstIz(r), /Dostupne stanice: .*demo-liman/);
    const sc = r.structuredContent as { stanice: { id: string }[] };
    assert.equal(sc.stanice[0]?.id, "demo-liman");
  });

  test("get_latest", async () => {
    const r = await pozovi(k, "get_latest", { stationId: "demo-liman" });
    assert.match(tekstIz(r), /PM2\.5 \d+(,\d)? µg\/m³ \(\d{2}\.\d{2}\.\d{4}\. \d{2}:\d{2}\)/);
    const sc = r.structuredContent as { merenja: unknown[] };
    assert.equal(sc.merenja.length, 2);
  });

  test("get_history poštuje hours", async () => {
    const r24 = (await pozovi(k, "get_history", { stationId: "demo-liman" })).structuredContent as {
      hours: number;
      merenja: unknown[];
    };
    const r3 = (await pozovi(k, "get_history", { stationId: "demo-liman", hours: 3 })).structuredContent as {
      hours: number;
      merenja: unknown[];
    };
    assert.equal(r24.hours, 24);
    assert.equal(r3.hours, 3);
    assert.ok(r3.merenja.length < r24.merenja.length);
  });

  test("get_history odbija hours: 0", async () => {
    const r = await pozovi(k, "get_history", { stationId: "demo-liman", hours: 0 }).catch(
      (e: unknown): CallToolResult => ({ isError: true, content: [{ type: "text", text: String(e) }] }),
    );
    assert.equal(r.isError, true);
  });

  test("get_latest za nepoznatu stanicu: isError sa porukom, bez izuzetka", async () => {
    const r = await pozovi(k, "get_latest", { stationId: "nema-je" });
    assert.equal(r.isError, true);
    assert.match(tekstIz(r), /ne postoji/);
  });

  test("assess_air_quality: ceo Rezultat u structuredContent", async () => {
    const r = await pozovi(k, "assess_air_quality", {});
    const sc = r.structuredContent as { status: string; category: { naziv: string } | null; advice: Savet | null };
    assert.equal(sc.status, "ok");
    assert.ok(sc.category);
    assert.deepEqual(sc.advice, SAVET);
    assert.match(tekstIz(r), new RegExp(`Kategorija: ${sc.category.naziv}`));
  });

  test("assess_air_quality: „sada“ servera u _meta (za „pre X min“ u ekranu A)", async () => {
    const r = await pozovi(k, "assess_air_quality", {});
    const sada = r._meta?.[META_SADA];
    assert.equal(typeof sada, "string");
    assert.ok(!Number.isNaN(Date.parse(sada as string)));
  });
});

describe("assess_air_quality za ostale statuse", () => {
  for (const [scenario, status] of [
    ["s3-zastareo", "stale"],
    ["s6-bez-podataka", "no_data"],
  ] as const) {
    test(`${scenario} → ${status}, tekst postoji`, async () => {
      const k = await povezi(zavisnostiZa(scenario));
      const r = await pozovi(k, "assess_air_quality", { stationId: "demo-liman" });
      const sc = r.structuredContent as { status: string; category: unknown; advice: unknown };
      assert.equal(sc.status, status);
      assert.equal(sc.category, null);
      assert.equal(sc.advice, null);
      assert.ok(tekstIz(r).startsWith("Liman"));
      await k.close();
    });
  }

  test("loše podešavanje izvora (api pre T01): error u odgovoru, server ne pada", async () => {
    const k = await povezi(async () => {
      await napraviIzvor({ EKONET_IZVOR: "api" });
      throw new Error("nedostižno");
    });
    const r = await pozovi(k, "assess_air_quality", {});
    const sc = r.structuredContent as { status: string; message: string };
    assert.equal(sc.status, "error");
    assert.match(sc.message, /T01/);
    assert.match(tekstIz(r), /T01/);
    const s = await pozovi(k, "get_stations");
    assert.equal(s.isError, true);
    await k.close();
  });
});
