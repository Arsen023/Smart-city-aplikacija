import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { GreskaEkonet } from "./greske.js";
import { DEMO_SCENARIJI, listaScenarija, parsirajScenario, ucitajScenario } from "./ucitaj.js";

const ISPRAVAN = {
  id: "test",
  opis: "",
  ocekivano: "",
  sada: "2026-11-16T09:20:00+01:00",
  stanica: { id: "st", naziv: "Test", lokacija: { lat: 45, lon: 19 }, velicine: ["PM10"] },
  merenja: [
    { stanicaId: "st", velicina: "PM10", vrednost: 10, jedinica: "µg/m³", vreme: "2026-11-16T09:00:00+01:00" },
  ],
};

/** Kopija ispravnog scenarija sa izmenjenim prvim merenjem. */
function saMerenjem(izmena: Record<string, unknown>): string {
  return JSON.stringify({ ...ISPRAVAN, merenja: [{ ...ISPRAVAN.merenja[0], ...izmena }] });
}

function jeGreska(kod: GreskaEkonet["kod"]) {
  return (e: unknown) => e instanceof GreskaEkonet && e.kod === kod;
}

describe("ucitajScenario", () => {
  test("lista sadrži svih 6 scenarija", () => {
    assert.deepEqual(listaScenarija(), DEMO_SCENARIJI);
    assert.equal(DEMO_SCENARIJI.length, 6);
  });

  for (const id of DEMO_SCENARIJI) {
    test(`${id} prolazi šemu`, async () => {
      const s = await ucitajScenario(id);
      assert.equal(s.id, id);
    });
  }

  test("nepoznat ID baca grešku konfiguracije", async () => {
    await assert.rejects(ucitajScenario("s9-nepostoji"), jeGreska("konfiguracija"));
  });

  test("putanja van fixtures/ se ne čita", async () => {
    for (const id of ["../package", "..\\package", "/etc/passwd", "s1-dobar/../../package"]) {
      await assert.rejects(ucitajScenario(id), jeGreska("konfiguracija"), id);
    }
  });
});

describe("parsirajScenario", () => {
  test("prihvata ispravan scenario", () => {
    assert.equal(parsirajScenario(JSON.stringify(ISPRAVAN)).merenja.length, 1);
  });

  test("odbija tekst koji nije JSON", () => {
    assert.throws(() => parsirajScenario("{ nije json"), jeGreska("neispravan_odgovor"));
  });

  test("odbija scenario bez obaveznog polja", () => {
    const { stanica: _, ...bezStanice } = ISPRAVAN;
    assert.throws(() => parsirajScenario(JSON.stringify(bezStanice)), jeGreska("neispravan_odgovor"));
  });

  test("odbija negativnu vrednost, pogrešnu jedinicu, nepoznatu veličinu i vreme bez zone", () => {
    for (const izmena of [
      { vrednost: -1 },
      { vrednost: null },
      { jedinica: "mg/m³" },
      { velicina: "NO2" },
      { vreme: "2026-11-16T09:00:00" },
    ]) {
      assert.throws(() => parsirajScenario(saMerenjem(izmena)), jeGreska("neispravan_odgovor"), JSON.stringify(izmena));
    }
  });

  test("odbija merenje druge stanice", () => {
    assert.throws(() => parsirajScenario(saMerenjem({ stanicaId: "druga" })), jeGreska("neispravan_odgovor"));
  });

  test("odbija fajl čiji id nije očekivani", () => {
    assert.throws(() => parsirajScenario(JSON.stringify(ISPRAVAN), "s1-dobar"), jeGreska("neispravan_odgovor"));
  });
});
