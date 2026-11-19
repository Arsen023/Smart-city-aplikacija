import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { protekloVreme, tekstVrednosti } from "./format.js";

describe("format vrednosti (zajednički za server i ekran A)", () => {
  test("decimalni zarez i jedinica", () => {
    assert.equal(tekstVrednosti({ velicina: "PM2.5", vrednost: 12.4, jedinica: "µg/m³" }), "PM2.5 12,4 µg/m³");
  });

  test("najviše jedna decimala", () => {
    assert.equal(tekstVrednosti({ velicina: "PM10", vrednost: 31.26, jedinica: "µg/m³" }), "PM10 31,3 µg/m³");
  });

  test("null je „nije dostupno“, nikad 0 (pravilo 5)", () => {
    const t = tekstVrednosti({ velicina: "PM2.5", vrednost: null, jedinica: "µg/m³" });
    assert.equal(t, "PM2.5 nije dostupno");
    assert.doesNotMatch(t, /\b0\b/);
  });

  test("prava nula se prikazuje kao 0", () => {
    assert.equal(tekstVrednosti({ velicina: "PM10", vrednost: 0, jedinica: "µg/m³" }), "PM10 0 µg/m³");
  });
});

describe("proteklo vreme (zajedničko za ekran A i A2UI poruke verzije B)", () => {
  const m = "2026-11-16T09:00:00+01:00";
  test("minuti, sati, dani", () => {
    assert.equal(protekloVreme(m, new Date("2026-11-16T09:00:30+01:00")), "upravo");
    assert.equal(protekloVreme(m, new Date("2026-11-16T09:20:00+01:00")), "pre 20 min");
    assert.equal(protekloVreme(m, new Date("2026-11-16T13:05:00+01:00")), "pre 4 h");
    assert.equal(protekloVreme(m, new Date("2026-11-17T10:00:00+01:00")), "pre 1 dan");
    assert.equal(protekloVreme(m, new Date("2026-11-19T10:00:00+01:00")), "pre 3 dana");
  });
});
