import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { KOMPONENTA_GRAFIKON, KOMPONENTA_KATEGORIJA } from "../zajednicko/a2ui-katalog.js";
import { katalogZaAgenta, napraviProcesor, obradiOdgovor, proveriA2uiPoruke } from "./a2ui-agent.js";

// Pravi SDK (@a2ui/agent) nad našim katalogom – bez LLM-a, odgovori su napisani ručno.
const procesor = napraviProcesor();
const blok = (telo: string) => `Evo pregleda.\n<a2ui>\nsurface("kv")\n${telo}\n</a2ui>\nPozdrav.`;

describe("katalog za AI", () => {
  test("sadrži samo potrebne osnovne komponente i naše dve", () => {
    const imena = [...(katalogZaAgenta().transformedCatalog as unknown as { components: Map<string, unknown> }).components.keys()];
    assert.deepEqual(imena.sort(), ["Card", "Column", "Divider", KOMPONENTA_GRAFIKON, KOMPONENTA_KATEGORIJA, "Row", "Text"].sort());
  });

  test("uputstvo za AI je skraćeno i pominje putanje i zabranu brojeva", () => {
    const s = procesor.promptSnippet;
    assert.ok(s.length < 12000, `uputstvo ima ${s.length} znakova`);
    assert.match(s, /\/pm25Broj/);
    assert.match(s, /ne piši brojeve/);
  });
});

describe("obrada AI odgovora", () => {
  test("ispravan blok → komponente, tekst bez bloka", () => {
    const r = obradiOdgovor(
      procesor,
      blok(
        "root = Column([Text($/stanica), KategorijaBadge(naziv=$/kategorija/naziv, nivo=$/kategorija/nivo), Grafikon24h(tacke=$/istorija)])",
      ),
    );
    assert.equal(r.tekst, "Evo pregleda. Pozdrav.");
    assert.ok(r.komponente);
    assert.ok(r.komponente?.some((k) => k.component === KOMPONENTA_KATEGORIJA));
    assert.ok(r.komponente?.some((k) => k.component === KOMPONENTA_GRAFIKON));
  });

  test("bez bloka → nema ekrana (rezervni ekran)", () => {
    const r = obradiOdgovor(procesor, "Vazduh je loš, smanjite napor.");
    assert.equal(r.komponente, null);
    assert.equal(r.tekst, "Vazduh je loš, smanjite napor.");
  });

  test("nepoznata komponenta → SDK odbija, tekst ostaje", () => {
    const r = obradiOdgovor(procesor, blok("root = Column([Html($/stanica)])"));
    assert.equal(r.komponente, null);
    assert.match(r.razlog ?? "", /SDK/);
    assert.doesNotMatch(r.tekst, /<a2ui>/);
  });

  test("AI ne sme da upiše podatke ($/x = …)", () => {
    const r = obradiOdgovor(procesor, blok('root = Column([Text($/stanica)])\n$/stanica = "Beograd"'));
    assert.equal(r.komponente, null);
    assert.match(r.razlog ?? "", /podatke/);
  });

  test("AI ne sme da napiše broj u tekst (pravilo 7)", () => {
    const r = obradiOdgovor(procesor, blok('root = Column([Text("PM2.5 je 12 µg/m³")])'));
    assert.equal(r.komponente, null);
    assert.match(r.razlog ?? "", /broj/);
  });

  test("nepoznata putanja se odbija", () => {
    const r = obradiOdgovor(procesor, blok("root = Column([Text($/kljuc)])"));
    assert.equal(r.komponente, null);
    assert.match(r.razlog ?? "", /nepoznata putanja/);
  });

  test("savet bez osnova → osnov se dodaje (FR-11)", () => {
    const r = obradiOdgovor(procesor, blok("root = Column([Text($/savet)])"));
    assert.ok(r.komponente?.some((k) => k.id === "osnov_auto"));
    const root = r.komponente?.find((k) => k.id === "root");
    assert.ok((root?.children as string[]).includes("osnov_auto"));
  });
});

describe("proveriA2uiPoruke", () => {
  test("savet bez osnova kad root nije Column → novi root Column", () => {
    const r = proveriA2uiPoruke([
      {
        updateComponents: {
          components: [
            { id: "root", component: "Card", child: "s" },
            { id: "s", component: "Text", text: { path: "/savet" } },
          ],
        },
      },
    ]);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.deepEqual(r.komponente.find((k) => k.id === "root")?.children, ["root_ai", "osnov_auto"]);
    assert.equal(r.komponente.find((k) => k.id === "root_ai")?.component, "Card");
  });

  test("bez root-a ili bez komponenti → odbija", () => {
    assert.equal(proveriA2uiPoruke([]).ok, false);
    assert.equal(proveriA2uiPoruke([{ updateComponents: { components: [{ id: "x", component: "Text", text: "Naslov" }] } }]).ok, false);
  });

  test("dva ekrana → odbija", () => {
    const uc = { updateComponents: { components: [{ id: "root", component: "Text", text: "Naslov" }] } };
    assert.equal(proveriA2uiPoruke([uc, uc]).ok, false);
  });
});
