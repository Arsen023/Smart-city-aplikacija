import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { JEDINICA_PM, type Merenje } from "../tipovi.js";
import { jeVazecaVrednost, ocistiMerenja } from "./normalizuj.js";

function m(vrednost: number, vreme: string): Merenje {
  return { stanicaId: "test", velicina: "PM10", vrednost, jedinica: JEDINICA_PM, vreme };
}

describe("jeVazecaVrednost", () => {
  test("0 i pozitivni brojevi su važeći", () => {
    assert.equal(jeVazecaVrednost(0), true);
    assert.equal(jeVazecaVrednost(12.5), true);
  });

  test("NaN, Infinity, negativni brojevi i ne-brojevi nisu važeći", () => {
    for (const v of [Number.NaN, Infinity, -Infinity, -0.1, "5", null, undefined]) {
      assert.equal(jeVazecaVrednost(v), false, String(v));
    }
  });
});

describe("ocistiMerenja", () => {
  test("sortira po trenutku, i kad se pomaci zone razlikuju", () => {
    const a = m(1, "2026-11-16T09:00:00+01:00"); // 08:00Z
    const b = m(2, "2026-11-16T08:30:00Z"); // 09:30 u Beogradu
    const c = m(3, "2026-11-16T08:00:00+01:00"); // 07:00Z
    assert.deepEqual(ocistiMerenja([b, a, c]), [c, a, b]);
  });

  test("odbacuje NaN, Infinity, negativne vrednosti i nečitljivo vreme, a 0 zadržava", () => {
    const nula = m(0, "2026-11-16T09:00:00+01:00");
    const ulaz = [
      m(Number.NaN, "2026-11-16T06:00:00+01:00"),
      m(Infinity, "2026-11-16T07:00:00+01:00"),
      m(-3, "2026-11-16T08:00:00+01:00"),
      m(5, "nije vreme"),
      nula,
    ];
    assert.deepEqual(ocistiMerenja(ulaz), [nula]);
  });

  test("ne menja ulazni niz", () => {
    const ulaz = [m(2, "2026-11-16T09:00:00+01:00"), m(1, "2026-11-16T08:00:00+01:00")];
    const kopija = structuredClone(ulaz);
    ocistiMerenja(ulaz);
    assert.deepEqual(ulaz, kopija);
  });

  test("prazan ulaz daje prazan niz", () => {
    assert.deepEqual(ocistiMerenja([]), []);
  });
});
