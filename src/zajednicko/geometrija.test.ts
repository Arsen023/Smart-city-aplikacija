import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { SatnaVrednost } from "../core/tipovi.js";
import { geometrija, lepaGranica, PODRAZUMEVANE } from "./geometrija.js";

const t = (sat: number, pm25: number | null, pm10: number | null): SatnaVrednost => ({
  vreme: `2026-11-16T${String(sat).padStart(2, "0")}:00:00+01:00`,
  pm25,
  pm10,
});

describe("grafikon – geometrija", () => {
  test("lepaGranica", () => {
    assert.equal(lepaGranica(0), 10);
    assert.equal(lepaGranica(6.7), 10);
    assert.equal(lepaGranica(13), 20);
    assert.equal(lepaGranica(149.3), 200);
    assert.equal(lepaGranica(450), 500);
  });

  test("jedna linija po veličini, tačka po satu", () => {
    const g = geometrija([t(7, 4, 7), t(8, 5, 8), t(9, 6, 9)]);
    assert.equal(g.pm25.split(/[ML]/).filter(Boolean).length, 3);
    assert.ok(g.pm25.startsWith("M"));
    assert.equal(g.yMax, 10);
  });

  test("nedostajuća vrednost prekida liniju, ne crta se kao 0", () => {
    const g = geometrija([t(7, 4, 7), t(8, null, 8), t(9, 6, 9)]);
    // Dva odvojena segmenta: M…  M…
    assert.equal((g.pm25.match(/M/g) ?? []).length, 2);
    assert.ok(!g.pm25.includes("L"));
    // Najniža tačka crteža (y za 0) se ne pojavljuje
    const yNula = PODRAZUMEVANE.visina - PODRAZUMEVANE.dole;
    assert.ok(!g.pm25.includes(`,${yNula.toFixed(1)}`));
  });

  test("veličina bez ijedne vrednosti nema liniju (S4)", () => {
    const g = geometrija([t(8, null, 7), t(9, null, 8)]);
    assert.equal(g.pm25, "");
    assert.ok(g.pm10.length > 0);
  });

  test("prazna istorija ne puca", () => {
    const g = geometrija([]);
    assert.equal(g.pm25, "");
    assert.equal(g.oznakeX.length, 0);
  });

  test("oznake sati u zoni Beograda", () => {
    const g = geometrija([t(7, 1, 1), t(8, 1, 1), t(9, 1, 1)]);
    assert.deepEqual(
      g.oznakeX.map((o) => o.tekst),
      ["07", "08", "09"],
    );
  });
});
