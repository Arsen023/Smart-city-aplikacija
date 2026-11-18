import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { tekstVrednosti } from "./format.js";

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
