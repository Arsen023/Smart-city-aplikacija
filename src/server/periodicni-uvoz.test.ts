import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { intervalUvoza, PODRAZUMEVANI_INTERVAL_MIN } from "./periodicni-uvoz.js";

describe("periodični uvoz", () => {
  it("radi samo za EKONET_IZVOR=baza", () => {
    assert.equal(intervalUvoza({}), null);
    assert.equal(intervalUvoza({ EKONET_IZVOR: "demo" }), null);
    assert.equal(intervalUvoza({ EKONET_IZVOR: "baza" }), PODRAZUMEVANI_INTERVAL_MIN);
  });

  it("BAZA_UVOZ_MIN: 0 isključuje, najmanje 5 min, neispravno = podrazumevano", () => {
    assert.equal(intervalUvoza({ EKONET_IZVOR: "baza", BAZA_UVOZ_MIN: "0" }), null);
    assert.equal(intervalUvoza({ EKONET_IZVOR: "baza", BAZA_UVOZ_MIN: "1" }), 5);
    assert.equal(intervalUvoza({ EKONET_IZVOR: "baza", BAZA_UVOZ_MIN: "60" }), 60);
    assert.equal(intervalUvoza({ EKONET_IZVOR: "baza", BAZA_UVOZ_MIN: "abc" }), PODRAZUMEVANI_INTERVAL_MIN);
  });
});
