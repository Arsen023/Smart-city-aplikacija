import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { bojeKategorije, EAQI_BOJE, kontrast } from "./boje-eaqi.js";

describe("boje EAQI kategorija (zajedničke za A i B)", () => {
  test("svih 6 nivoa ima boju", () => {
    for (let n = 1; n <= 6; n++) assert.match(EAQI_BOJE[n], /^#[0-9A-F]{6}$/);
  });

  test("tekst na boji ima kontrast najmanje 4,5:1 (NFR-07)", () => {
    for (let n = 1; n <= 6; n++) {
      const b = bojeKategorije(n);
      assert.ok(kontrast(b.pozadina, b.tekst) >= 4.5, `nivo ${n}: ${kontrast(b.pozadina, b.tekst).toFixed(2)}`);
    }
  });

  test("nepoznat nivo dobija neutralnu boju", () => {
    assert.equal(bojeKategorije(9).pozadina, "#9E9E9E");
  });

  test("kontrast crno/belo je 21:1", () => {
    assert.equal(Math.round(kontrast("#000000", "#FFFFFF")), 21);
  });
});
