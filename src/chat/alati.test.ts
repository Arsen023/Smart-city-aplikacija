import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ALAT_PROCENE,
  alatiZaVerziju,
  argumentiPoziva,
  jeGreskaProcene,
  sistemskaPoruka,
  tekstZaModel,
  trebaA2uiUputstvo,
  uChatAlat,
  type McpAlat,
} from "./alati.js";

const alat = (name: string, visibility?: string[]): McpAlat => ({
  name,
  description: `opis ${name}`,
  inputSchema: { $schema: "http://json-schema.org/draft-07/schema#", type: "object", properties: { stationId: { type: "string" } } },
  ...(visibility ? { _meta: { ui: { resourceUri: "ui://x", visibility } } } : {}),
});

const SVI = [
  alat("get_stations"),
  alat("get_latest"),
  alat("get_history"),
  alat("assess_air_quality"),
  alat("assess_air_quality_a2ui", ["model", "app"]),
  alat("osvezi_a2ui", ["app"]),
  alat("get_weather"),
  alat("get_dashboard", ["app"]),
];

describe("alati za verziju", () => {
  test("A: spisak stanica + assess_air_quality + vreme, bez dashboard-a", () => {
    assert.deepEqual(
      alatiZaVerziju(SVI, "A").map((a) => a.name),
      ["get_stations", "assess_air_quality", "get_weather"],
    );
  });

  test("B: spisak stanica + assess_air_quality_a2ui, bez alata samo za ekran", () => {
    assert.deepEqual(
      alatiZaVerziju(SVI, "B").map((a) => a.name),
      ["get_stations", "assess_air_quality_a2ui", "get_weather"],
    );
  });

  test("alat koji je vidljiv samo ekranu se nikad ne nudi modelu", () => {
    assert.equal(alatiZaVerziju([alat(ALAT_PROCENE.B, ["app"])], "B").length, 0);
  });
});

describe("pretvaranje alata za Groq", () => {
  test("ime, opis i parametri; bez $schema", () => {
    const c = uChatAlat(alat("assess_air_quality"));
    assert.equal(c.type, "function");
    assert.equal(c.function.name, "assess_air_quality");
    assert.equal(c.function.description, "opis assess_air_quality");
    assert.equal("$schema" in c.function.parameters, false);
    assert.deepEqual(c.function.parameters.properties, { stationId: { type: "string" } });
  });

  test("alat bez parametara dobija prazan objekat", () => {
    const c = uChatAlat({ name: "get_stations", inputSchema: { type: "object" } });
    assert.deepEqual(c.function.parameters, { type: "object", properties: {} });
  });
});

describe("tekst rezultata za model", () => {
  test("samo tekst, bez A2UI resursa", () => {
    const t = tekstZaModel({
      content: [
        { type: "text", text: "Liman: Kategorija Loš." },
        { type: "resource" },
      ],
    });
    assert.equal(t, "Liman: Kategorija Loš.");
  });

  test("greška alata je označena", () => {
    assert.equal(tekstZaModel({ isError: true, content: [{ type: "text", text: "Stanica ne postoji." }] }), "Greška alata: Stanica ne postoji.");
  });

  test("prazan rezultat", () => {
    assert.equal(tekstZaModel({}), "Alat nije vratio tekst.");
  });

  test("mali strukturisani rezultat ide modelu (id stanice iz get_stations)", () => {
    const t = tekstZaModel({
      content: [{ type: "text", text: "Dostupne stanice: Liman, Novi Sad (demo)." }],
      structuredContent: { stanice: [{ id: "demo-liman", naziv: "Liman, Novi Sad (demo)" }] },
    });
    assert.match(t, /"id":"demo-liman"/);
  });

  test("veliki strukturisani rezultat (24 h istorije) ne ide modelu", () => {
    const history = Array.from({ length: 200 }, (_, i) => ({ vreme: `2026-11-16T${i}`, pm25: i, pm10: i }));
    const t = tekstZaModel({ content: [{ type: "text", text: "Liman: Loš." }], structuredContent: { history } });
    assert.equal(t, "Liman: Loš.");
  });
});

describe("greška procene", () => {
  test("status error ili isError → bez ekrana; stale i ok → ekran", () => {
    assert.equal(jeGreskaProcene({ structuredContent: { status: "error" } }), true);
    assert.equal(jeGreskaProcene({ isError: true }), true);
    assert.equal(jeGreskaProcene({ structuredContent: { status: "stale" } }), false);
    assert.equal(jeGreskaProcene({ structuredContent: { status: "ok" } }), false);
  });
});

describe("sistemska poruka i argumenti", () => {
  test("pominje alat izabrane verzije i zabranu računanja kategorije", () => {
    const a = sistemskaPoruka("A");
    const b = sistemskaPoruka("B");
    assert.match(a, /assess_air_quality\b/);
    assert.doesNotMatch(a, /assess_air_quality_a2ui/);
    assert.match(b, /assess_air_quality_a2ui/);
    assert.match(a, /Kategoriju nikad ne računaš sam/);
  });

  test("argumenti poziva: ispravan JSON, prazno, neispravno", () => {
    assert.deepEqual(argumentiPoziva('{"stationId":"demo-liman"}'), { stationId: "demo-liman" });
    assert.deepEqual(argumentiPoziva(""), {});
    assert.deepEqual(argumentiPoziva("nije json"), {});
    assert.deepEqual(argumentiPoziva("[1,2]"), {});
  });
});

describe("verzija B – izvorni A2UI", () => {
  test("samo verzija B kaže da model sastavlja ekran u A2UI bloku", () => {
    assert.match(sistemskaPoruka("B"), /A2UI bloku/);
    assert.doesNotMatch(sistemskaPoruka("A"), /A2UI/);
  });

  test("u verziji B alat nema parametar prikaz (ekran sastavlja chat model)", () => {
    const a: McpAlat = {
      name: "assess_air_quality_a2ui",
      inputSchema: { type: "object", properties: { stationId: { type: "string" }, prikaz: { type: "string" } } },
    };
    const [b] = alatiZaVerziju([a], "B");
    assert.deepEqual(Object.keys(b.inputSchema.properties ?? {}), ["stationId"]);
  });

  test("A2UI uputstvo tek posle rezultata procene u tekućem pitanju, i samo u B", () => {
    const poziv = (id: string, ime: string) => ({ id, type: "function" as const, function: { name: ime, arguments: "{}" } });
    const posleStanica = [
      { role: "user" as const },
      { role: "assistant" as const, tool_calls: [poziv("1", "get_stations")] },
      { role: "tool" as const, tool_call_id: "1" },
    ];
    assert.equal(trebaA2uiUputstvo("B", posleStanica), false);
    const poslePorocene = [...posleStanica, { role: "assistant" as const, tool_calls: [poziv("2", "assess_air_quality_a2ui")] }, { role: "tool" as const, tool_call_id: "2" }];
    assert.equal(trebaA2uiUputstvo("B", poslePorocene), true);
    assert.equal(trebaA2uiUputstvo("A", poslePorocene), false);
    // novo pitanje: stara procena se ne računa
    assert.equal(trebaA2uiUputstvo("B", [...poslePorocene, { role: "user" as const }]), false);
  });
});
