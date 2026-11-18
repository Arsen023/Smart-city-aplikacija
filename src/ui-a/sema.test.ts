import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { procitajRezultat, procitajStanice } from "./sema.js";
import { rezultatS1 } from "./test-podaci.js";

describe("ekran A – provera structuredContent", () => {
  test("ispravan Rezultat prolazi", () => {
    assert.deepEqual(procitajRezultat(rezultatS1()), rezultatS1());
  });

  test("odbija nepoznat status", () => {
    assert.equal(procitajRezultat({ ...rezultatS1(), status: "dobro" }), null);
  });

  test("odbija vrednost kao tekst", () => {
    const r = rezultatS1();
    assert.equal(procitajRezultat({ ...r, values: [{ ...r.values[0], vrednost: "12" }] }), null);
  });

  test("odbija null, undefined i objekat bez station", () => {
    assert.equal(procitajRezultat(null), null);
    assert.equal(procitajRezultat(undefined), null);
    const { station: _, ...bezStanice } = rezultatS1();
    assert.equal(procitajRezultat(bezStanice), null);
  });

  test("stanice: uzima id i naziv", () => {
    const ulaz = {
      stanice: [{ id: "demo-liman", naziv: "Liman", lokacija: { lat: 45.24, lon: 19.84 }, velicine: ["PM10"] }],
    };
    assert.deepEqual(procitajStanice(ulaz), [{ id: "demo-liman", naziv: "Liman" }]);
  });

  test("stanice: odbija stanicu bez id-ja", () => {
    assert.equal(procitajStanice({ stanice: [{ naziv: "Liman" }] }), null);
  });
});
