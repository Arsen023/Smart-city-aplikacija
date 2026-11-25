import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { operacije, podaciProcene, podaciTable, popraviKomponente, sastaviEkran, tekstAlata } from "./copilotkit-ekran.js";
import { KONTEKST_APLIKACIJE, prilagodiZahtev, rezultatZaModel } from "./copilotkit.js";

const TABLA = { meteo: { temperatura: "2,3 °C" }, voda: { kiseonik: "3,8 mg/L" } };

const RASPORED = [
  { id: "root", component: "Column", children: ["n", "t"] },
  { id: "n", component: "Text", text: "Kvalitet vode", variant: "h3" },
  { id: "t", component: "Text", text: { path: "/voda/kiseonik" } },
];

describe("CopilotKit: naš A2UI alat prikazi_ekran", () => {
  it("ispravan raspored + podaci sa servera → a2ui_operations (v0.9)", () => {
    const r = sastaviEkran(RASPORED, { tabla: TABLA, procena: null }, "copilot-1");
    assert.equal(r.ok, true);
    const ops = (JSON.parse((r as { rezultat: string }).rezultat) as { a2ui_operations: Array<Record<string, unknown>> }).a2ui_operations;
    assert.equal(ops.length, 3);
    assert.deepEqual(Object.keys(ops[0]!), ["version", "createSurface"]);
    assert.deepEqual((ops[2]!.updateDataModel as { value: unknown }).value, TABLA);
  });

  it("AI ne sme da upiše broj u tekst – raspored se odbija sa razlogom", () => {
    const r = sastaviEkran([{ id: "root", component: "Text", text: "Kiseonik je 3,8" }], { tabla: TABLA, procena: null }, "x");
    assert.equal(r.ok, false);
    assert.match((r as { greska: string }).greska, /broj/);
  });

  it("nepoznata putanja se odbija", () => {
    const r = sastaviEkran([{ id: "root", component: "Text", text: { path: "/lozinka" } }], { tabla: TABLA, procena: null }, "x");
    assert.equal(r.ok, false);
  });

  it("procena vazduha koja nije ok → uvek fiksni ekran sa porukom (pravilo 2)", () => {
    const procena = { podaci: { poruka: "Podaci su zastareli" }, komponente: [{ id: "root", component: "Text", text: { path: "/poruka" } }], status: "stale" };
    const r = sastaviEkran(RASPORED, { tabla: TABLA, procena }, "x");
    assert.equal(r.ok, true);
    const ops = JSON.parse((r as { rezultat: string }).rezultat).a2ui_operations as Array<Record<string, { components?: unknown }>>;
    assert.deepEqual(ops[1]!.updateComponents!.components, procena.komponente);
  });

  it("bez ikakvih podataka – greška, ne prazan ekran", () => {
    assert.equal(sastaviEkran(RASPORED, { tabla: null, procena: null }, "x").ok, false);
  });

  it("ispravlja česte greške AI-ja: path na komponenti, Card sa children", () => {
    const p = popraviKomponente([
      { id: "a", component: "Text", path: "/voda/ph" },
      { id: "b", component: "Card", children: ["a"] },
      { id: "c", component: "Column", child: "b" },
    ]) as Array<Record<string, unknown>>;
    assert.deepEqual(p[0], { id: "a", component: "Text", text: { path: "/voda/ph" } });
    assert.deepEqual(p[1], { id: "b", component: "Card", child: "a" });
    assert.deepEqual(p[2], { id: "c", component: "Column", children: ["b"] });
  });

  it("rezultat nosi kratak sažetak za AI uz A2UI operacije", () => {
    const r = sastaviEkran(RASPORED, { tabla: TABLA, procena: null, sazetak: "Voda: kiseonik 3,8 mg/L." }, "s");
    const o = JSON.parse((r as { rezultat: string }).rezultat) as { sazetak: string };
    assert.match(o.sazetak, /kiseonik 3,8 mg\/L/);
    assert.equal(tekstAlata({ content: [{ type: "text", text: "A" }, { type: "resource" }, { type: "text", text: "B" }] }), "A B");
  });

  it("putanja napisana kao tekst postaje {path} (\"sati\": \"/meteo/prognoza\")", () => {
    const p = popraviKomponente([
      { id: "f", component: "PrognozaSati", sati: "/meteo/prognoza" },
      { id: "t", component: "Text", text: "/meteo/temperatura" },
      { id: "n", component: "Text", text: "Vreme danas" },
    ]) as Array<Record<string, unknown>>;
    assert.deepEqual(p[0]!.sati, { path: "/meteo/prognoza" });
    assert.deepEqual(p[1]!.text, { path: "/meteo/temperatura" });
    assert.equal(p[2]!.text, "Vreme danas");
  });

  it("child/children ostaju samo na kontejnerima (Text sa child bi renderer odbio)", () => {
    const p = popraviKomponente([
      { id: "t", component: "Text", text: "Vlažnost", child: "x" },
      { id: "r", component: "Row", children: ["t"], child: "t" },
    ]) as Array<Record<string, unknown>>;
    assert.equal("child" in p[0]!, false);
    assert.equal("child" in p[1]!, false);
    assert.deepEqual(p[1]!.children, ["t"]);
  });

  it("ugnežđene komponente se izvlače u ravnu listu sa id-jevima", () => {
    const r = sastaviEkran(
      [{ id: "root", component: "Column", children: [{ component: "Text", text: { path: "/voda/kiseonik" } }, { id: "n", component: "Card", child: { component: "Divider" } }] }],
      { tabla: TABLA, procena: null },
      "s",
    );
    assert.equal(r.ok, true);
    const komponente = (JSON.parse((r as { rezultat: string }).rezultat).a2ui_operations[1].updateComponents.components) as Array<{ id: string; children?: string[]; child?: string }>;
    const koren = komponente.find((k) => k.id === "root")!;
    assert.ok(koren.children!.every((c) => typeof c === "string"));
    assert.equal(komponente.length, 4);
  });

  it("referenca na nepostojeću komponentu se odbija sa razlogom (AI ispravlja)", () => {
    const r = sastaviEkran([{ id: "root", component: "Column", children: ["nema"] }], { tabla: TABLA, procena: null }, "s");
    assert.equal(r.ok, false);
    assert.match((r as { greska: string }).greska, /nema/);
  });

  it("podaci iz rezultata MCP alata", () => {
    assert.deepEqual(podaciTable({ structuredContent: { a2ui: { podaci: TABLA } } }), TABLA);
    assert.equal(podaciTable({ structuredContent: {} }), null);
    const resurs = JSON.stringify(operacije("s", [{ id: "root", component: "Text", text: "" }], { savet: "Može" }));
    const p = podaciProcene({ content: [{ type: "resource", resource: { mimeType: "application/a2ui+json", text: resurs } }], structuredContent: { status: "ok" } });
    assert.equal(p?.status, "ok");
    assert.deepEqual(p?.podaci, { savet: "Može" });
  });
});

describe("CopilotKit: zahtev ka Groq-u", () => {
  it("uklanja reasoning_content, šemu kataloga i alate koji ne trebaju", () => {
    const telo = {
      messages: [
        { role: "system", content: `Uputstvo.\n${KONTEKST_APLIKACIJE}\nogromna šema…` },
        { role: "assistant", content: null, reasoning_content: "mislim…", tool_calls: [] },
      ],
      tools: [{ function: { name: "get_weather" } }, { function: { name: "AGUISendStateSnapshot" } }, { function: { name: "mcp1_get_water_latest" } }],
      tool_choice: "auto",
    };
    const z = prilagodiZahtev(telo, ["get_weather", "get_water_latest"]) as typeof telo;
    assert.equal(z.messages[0]!.content, "Uputstvo.");
    assert.equal("reasoning_content" in z.messages[1]!, false);
    assert.deepEqual(z.tools.map((t) => t.function.name), ["get_weather", "mcp1_get_water_latest"]);
  });

  it("rezultat ekrana (ceo data model) AI vidi samo kao sažetak; ostali rezultati se skraćuju", () => {
    const ekran = JSON.stringify({ a2ui_operations: [{ ogroman: "x".repeat(20000) }], sazetak: "Ekran je prikazan. Podaci: …" });
    assert.equal(rezultatZaModel(ekran), "Ekran je prikazan. Podaci: …");
    assert.ok(rezultatZaModel("y".repeat(5000)).length <= 1501);
    const z = prilagodiZahtev({ model: "openai/gpt-oss-120b", messages: [{ role: "tool", content: ekran }] }, []) as {
      messages: Array<{ content: string }>;
      reasoning_effort?: string;
    };
    assert.equal(z.messages[0]!.content, "Ekran je prikazan. Podaci: …");
    assert.equal(z.reasoning_effort, "low");
  });

  it("stari rasporedi u istoriji se skraćuju, poslednji ostaje ceo", () => {
    const poziv = (id: string) => ({ id, type: "function", function: { name: "prikazi_ekran", arguments: '{"komponente":[1,2,3]}' } });
    const z = prilagodiZahtev(
      {
        messages: [
          { role: "assistant", content: null, tool_calls: [poziv("a")] },
          { role: "tool", tool_call_id: "a", content: "ok" },
          { role: "assistant", content: null, tool_calls: [poziv("b")] },
        ],
      },
      [],
    ) as { messages: Array<{ tool_calls?: Array<{ function: { arguments: string } }> }> };
    assert.equal(z.messages[0]!.tool_calls![0]!.function.arguments, "{}");
    assert.equal(z.messages[2]!.tool_calls![0]!.function.arguments, '{"komponente":[1,2,3]}');
  });

  it("istorija: samo poslednja tri pitanja, sistemska poruka ostaje", () => {
    const poruke = [{ role: "system", content: "S" }];
    for (let i = 1; i <= 5; i++) poruke.push({ role: "user", content: `p${i}` }, { role: "assistant", content: `o${i}` });
    const z = prilagodiZahtev({ messages: poruke }, []) as { messages: Array<{ content: string }> };
    assert.deepEqual(z.messages.map((m) => m.content), ["S", "p3", "o3", "p4", "o4", "p5", "o5"]);
  });

  it("bez dozvoljenih alata šalje se bez tools i tool_choice", () => {
    const z = prilagodiZahtev({ messages: [], tools: [{ function: { name: "x" } }], tool_choice: "auto" }, []) as Record<string, unknown>;
    assert.equal("tools" in z, false);
    assert.equal("tool_choice" in z, false);
  });
});
