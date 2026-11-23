import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { GreskaBaze, napraviBazu, type BazaVode } from "../core/baza/index.js";
import { SQL } from "../core/baza/upiti.js";
import { registrujAlateVode, sazetakIstorijeVode, type DobijBazu } from "./voda-alati.js";

const red = (vreme: string) => ({
  uredjaj_id: "fishnet-1",
  vreme: new Date(vreme),
  temperatura_c: "21.24",
  ph: "5.34",
  orp: "182.5",
  dox: "3.94",
  con: "0.00",
  dox_zasicenje: "44.41",
  dco2: null,
});

function laznaBaza(): BazaVode {
  const odgovori = new Map<string, unknown[]>([
    [SQL.uredjaji, [{ id: "fishnet-1", naziv: "FishNET uređaj 1", tip: "kvalitet vode", lokacija: null }]],
    [SQL.postojiUredjaj, [{}]],
    [SQL.poslednjeMerenje, [red("2023-01-23T13:15:53Z")]],
    [SQL.istorija, [red("2023-01-23T12:00:00Z"), red("2023-01-23T13:15:53Z")]],
  ]);
  return napraviBazu(async (sql, parametri) => ({
    rows: sql === SQL.postojiUredjaj && parametri?.[0] !== "fishnet-1" ? [] : (odgovori.get(sql) ?? []),
  }));
}

async function povezi(dobijBazu: DobijBazu) {
  const server = new McpServer({ name: "test", version: "1.0.0" });
  registrujAlateVode(server, dobijBazu);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const k = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([server.connect(a), k.connect(b)]);
  return k;
}

const pozovi = async (k: Client, name: string, args: Record<string, unknown> = {}) =>
  (await k.callTool({ name, arguments: args })) as CallToolResult;
const tekst = (r: CallToolResult) => (r.content[0]?.type === "text" ? r.content[0].text : "");

describe("MCP alati za vodu", () => {
  test("šema dozvoljava deviceId kao prazan tekst i null (Groq proverava poziv prema šemi)", async () => {
    const k = await povezi(async () => laznaBaza());
    const latest = (await k.listTools()).tools.find((t) => t.name === "get_water_latest");
    const sema = JSON.stringify(latest?.inputSchema.properties?.deviceId);
    assert.doesNotMatch(sema, /minLength/);
    assert.match(sema, /null/);
    assert.deepEqual(latest?.inputSchema.required ?? [], []);
    await k.close();
  });

  test("registrovana su 3 alata", async () => {
    const k = await povezi(async () => laznaBaza());
    const imena = (await k.listTools()).tools.map((t) => t.name).sort();
    assert.deepEqual(imena, ["get_water_devices", "get_water_history", "get_water_latest"]);
    await k.close();
  });

  test("get_water_devices", async () => {
    const k = await povezi(async () => laznaBaza());
    const r = await pozovi(k, "get_water_devices");
    assert.notEqual(r.isError, true);
    assert.match(tekst(r), /FishNET uređaj 1 \(fishnet-1\)/);
    await k.close();
  });

  test("get_water_latest: tekst na srpskom sa decimalnim zarezom", async () => {
    const k = await povezi(async () => laznaBaza());
    const r = await pozovi(k, "get_water_latest", { deviceId: "fishnet-1" });
    assert.match(tekst(r), /23\.01\.2023\. 14:15: temperatura 21,24 °C, pH 5,34/);
    assert.match(tekst(r), /CO2 nije dostupno/);
    const sc = r.structuredContent as { merenje: { temperaturaC: number } };
    assert.equal(sc.merenje.temperaturaC, 21.24);
    await k.close();
  });

  test("get_water_history: broj merenja i raspon", async () => {
    const k = await povezi(async () => laznaBaza());
    const r = await pozovi(k, "get_water_history", { deviceId: "fishnet-1" });
    assert.match(tekst(r), /^fishnet-1: 2 merenja za 24 h, od 23\.01\.2023\. 13:00 do 23\.01\.2023\. 14:15\. Promena: /);
    assert.match(tekst(r), /temperatura 21,24 → 21,24 °C \(najmanje 21,24, najviše 21,24\)/);
    await k.close();
  });

  test("bez deviceId: koristi se prvi uređaj iz baze", async () => {
    const k = await povezi(async () => laznaBaza());
    const r = await pozovi(k, "get_water_latest");
    assert.notEqual(r.isError, true);
    assert.match(tekst(r), /^fishnet-1, 23\.01\.2023\. 14:15: /);
    assert.match(tekst(r), /\(pre \d+ dana\)\.$/);
    // Modeli često pošalju prazan tekst ili null – i to znači „prvi uređaj“, ne grešku.
    for (const deviceId of ["", "  ", null]) {
      const p = await pozovi(k, "get_water_latest", { deviceId });
      assert.notEqual(p.isError, true, `deviceId=${JSON.stringify(deviceId)}`);
      assert.match(tekst(p), /^fishnet-1, /);
    }
    const h = await pozovi(k, "get_water_history", { hours: 6 });
    assert.match(tekst(h), /^fishnet-1: 2 merenja za 6 h/);
    await k.close();
  });

  test("nepoznat uređaj: isError sa porukom", async () => {
    const k = await povezi(async () => laznaBaza());
    const r = await pozovi(k, "get_water_latest", { deviceId: "nema" });
    assert.equal(r.isError, true);
    assert.match(tekst(r), /ne postoji u bazi/);
    await k.close();
  });

  test("baza nije podešena: isError, server ne pada", async () => {
    const k = await povezi(async () => {
      throw new GreskaBaze("konfiguracija", "Baza nije podešena: u .env dodaj DATABASE_URL=…");
    });
    const r = await pozovi(k, "get_water_devices");
    assert.equal(r.isError, true);
    assert.match(tekst(r), /DATABASE_URL/);
    await k.close();
  });

  test("baza ne radi: opšta poruka bez detalja veze", async () => {
    const k = await povezi(async () =>
      napraviBazu(async () => {
        throw new Error("connect ECONNREFUSED 127.0.0.1:5432 user=postgres");
      }),
    );
    const r = await pozovi(k, "get_water_devices");
    assert.equal(r.isError, true);
    assert.equal(tekst(r), "Baza trenutno nije dostupna.");
    await k.close();
  });
});

describe("sažetak istorije vode", () => {
  const m = (temperaturaC: number | null, ph: number | null) => ({
    uredjajId: "fishnet-1",
    vreme: "2023-01-23T01:00:00+01:00",
    temperaturaC,
    ph,
    orp: null,
    dox: null,
    con: null,
    doxZasicenje: null,
    dco2: null,
  });

  test("prva → poslednja vrednost i raspon; veličina bez vrednosti se izostavlja", () => {
    const s = sazetakIstorijeVode([m(21.24, 5.34), m(20.85, 5.33), m(22.08, 5.35)]);
    assert.equal(s, "temperatura 21,24 → 22,08 °C (najmanje 20,85, najviše 22,08); pH 5,34 → 5,35 (najmanje 5,33, najviše 5,35)");
  });

  test("null se ne računa kao 0", () => {
    assert.equal(sazetakIstorijeVode([m(null, 7), m(10, 7)]), "temperatura 10 → 10 °C (najmanje 10, najviše 10); pH 7 → 7 (najmanje 7, najviše 7)");
  });
});
