import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { GreskaEkonet, napraviKlijent, procitajPodesavanja } from "./index.js";

const konfiguracija = (e: unknown) => e instanceof GreskaEkonet && e.kod === "konfiguracija";

describe("procitajPodesavanja", () => {
  test("bez promenljivih: demo i s1-dobar", () => {
    assert.deepEqual(procitajPodesavanja({}), { izvor: "demo", scenario: "s1-dobar" });
  });

  test("prazne vrednosti i razmaci znače podrazumevano", () => {
    assert.deepEqual(procitajPodesavanja({ EKONET_IZVOR: "", EKONET_SCENARIO: "  " }), {
      izvor: "demo",
      scenario: "s1-dobar",
    });
  });

  test("EKONET_SCENARIO bira scenario", () => {
    assert.deepEqual(procitajPodesavanja({ EKONET_IZVOR: "demo", EKONET_SCENARIO: " s2-los " }), {
      izvor: "demo",
      scenario: "s2-los",
    });
  });

  test("api ne gleda EKONET_SCENARIO", () => {
    assert.deepEqual(procitajPodesavanja({ EKONET_IZVOR: "api", EKONET_SCENARIO: "bilo-sta" }), { izvor: "api" });
  });

  test("nepoznat izvor baca grešku konfiguracije", () => {
    assert.throws(() => procitajPodesavanja({ EKONET_IZVOR: "Demo" }), konfiguracija);
    assert.throws(() => procitajPodesavanja({ EKONET_IZVOR: "http" }), konfiguracija);
  });

  test("nepoznat scenario baca grešku konfiguracije", () => {
    assert.throws(() => procitajPodesavanja({ EKONET_SCENARIO: "s9" }), konfiguracija);
    assert.throws(() => procitajPodesavanja({ EKONET_SCENARIO: "../package" }), konfiguracija);
  });
});

describe("napraviKlijent", () => {
  test("bez promenljivih vraća demo klijent za s1-dobar", async () => {
    const k = await napraviKlijent({});
    const [stanica] = await k.getStations();
    assert.equal(stanica?.id, "demo-liman");
    assert.equal((await k.getLatest("demo-liman")).length, 2);
  });

  test("EKONET_SCENARIO=s4-bez-pm25 daje samo PM10", async () => {
    const k = await napraviKlijent({ EKONET_SCENARIO: "s4-bez-pm25" });
    assert.deepEqual(
      (await k.getLatest("demo-liman")).map((m) => m.velicina),
      ["PM10"],
    );
  });

  test("api daje jasnu grešku da T01 nije podešen", async () => {
    await assert.rejects(
      napraviKlijent({ EKONET_IZVOR: "api" }),
      (e: unknown) => konfiguracija(e) && e instanceof Error && /T01/.test(e.message),
    );
  });

  test("nepoznat izvor odbija pravljenje klijenta", async () => {
    await assert.rejects(napraviKlijent({ EKONET_IZVOR: "nesto" }), konfiguracija);
  });
});
