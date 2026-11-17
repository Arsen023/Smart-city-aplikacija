import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { proceni } from "../pravila/index.js";
import { JEDINICA_PM, type DemoScenario } from "../tipovi.js";
import { napraviDemoKlijent } from "./demo.js";
import { GreskaEkonet } from "./greske.js";
import { ucitajScenario, type DemoScenarioId } from "./ucitaj.js";

const STANICA = "demo-liman";

async function klijent(id: DemoScenarioId) {
  return napraviDemoKlijent(await ucitajScenario(id));
}

describe("demo klijent", () => {
  test("getStations vraća stanicu scenarija", async () => {
    const stanice = await (await klijent("s1-dobar")).getStations();
    assert.equal(stanice.length, 1);
    assert.equal(stanice[0]?.id, STANICA);
  });

  test("getLatest vraća poslednje PM2.5 i PM10", async () => {
    const s = await ucitajScenario("s1-dobar");
    const poslednje = await napraviDemoKlijent(s).getLatest(STANICA);
    assert.deepEqual(
      poslednje.map((m) => m.velicina),
      ["PM2.5", "PM10"],
    );
    for (const m of poslednje) {
      const ocekivano = s.merenja.filter((x) => x.velicina === m.velicina).at(-1);
      assert.deepEqual(m, ocekivano);
    }
  });

  test("S4: getLatest vraća samo PM10, bez nule za PM2.5", async () => {
    const poslednje = await (await klijent("s4-bez-pm25")).getLatest(STANICA);
    assert.deepEqual(
      poslednje.map((m) => m.velicina),
      ["PM10"],
    );
  });

  test("S6: getLatest i getHistory vraćaju prazan niz", async () => {
    const k = await klijent("s6-bez-podataka");
    assert.deepEqual(await k.getLatest(STANICA), []);
    assert.deepEqual(await k.getHistory(STANICA), []);
  });

  test("S3: getLatest vraća staro merenje (svežinu proverava K2)", async () => {
    const poslednje = await (await klijent("s3-zastareo")).getLatest(STANICA);
    assert.equal(poslednje.length, 2);
    for (const m of poslednje) assert.equal(m.vreme, "2026-11-16T05:00:00+01:00");
  });

  test("getHistory podrazumevano daje 24 h, a poštuje i manji prozor", async () => {
    const k = await klijent("s1-dobar");
    assert.equal((await k.getHistory(STANICA)).length, 48); // 24 sata × 2 veličine
    const tri = await k.getHistory(STANICA, 3); // sada 09:20 → 07:00, 08:00, 09:00
    assert.deepEqual([...new Set(tri.map((m) => m.vreme))], [
      "2026-11-16T07:00:00+01:00",
      "2026-11-16T08:00:00+01:00",
      "2026-11-16T09:00:00+01:00",
    ]);
  });

  test("getHistory odbija hours koji nije pozitivan broj", async () => {
    const k = await klijent("s1-dobar");
    for (const h of [0, -1, Number.NaN]) await assert.rejects(k.getHistory(STANICA, h), RangeError);
  });

  test("nepoznata stanica baca GreskaEkonet", async () => {
    const k = await klijent("s1-dobar");
    const nepoznata = (e: unknown) => e instanceof GreskaEkonet && e.kod === "nepoznata_stanica";
    await assert.rejects(k.getLatest("nema"), nepoznata);
    await assert.rejects(k.getHistory("nema"), nepoznata);
  });

  test("merenja posle scenario.sada se ne vide, a nevažeće vrednosti se izbacuju", async () => {
    const s: DemoScenario = {
      ...(await ucitajScenario("s6-bez-podataka")),
      merenja: [
        { stanicaId: STANICA, velicina: "PM10", vrednost: 10, jedinica: JEDINICA_PM, vreme: "2026-11-16T09:00:00+01:00" },
        { stanicaId: STANICA, velicina: "PM10", vrednost: Number.NaN, jedinica: JEDINICA_PM, vreme: "2026-11-16T09:10:00+01:00" },
        { stanicaId: STANICA, velicina: "PM10", vrednost: 99, jedinica: JEDINICA_PM, vreme: "2026-11-16T10:00:00+01:00" },
      ],
    };
    const poslednje = await napraviDemoKlijent(s).getLatest(STANICA);
    assert.deepEqual(
      poslednje.map((m) => m.vrednost),
      [10],
    );
  });

  test("izmena vraćenih podataka ne menja klijent", async () => {
    const k = await klijent("s1-dobar");
    const prvo = await k.getLatest(STANICA);
    prvo[0]!.vrednost = 999;
    (await k.getStations())[0]!.naziv = "izmenjeno";
    assert.notEqual((await k.getLatest(STANICA))[0]?.vrednost, 999);
    assert.notEqual((await k.getStations())[0]?.naziv, "izmenjeno");
  });
});

describe("K1 → K2: demo klijent i proceni()", () => {
  const ocekivano: [DemoScenarioId, string][] = [
    ["s1-dobar", "ok"],
    ["s2-los", "ok"],
    ["s3-zastareo", "stale"],
    ["s4-bez-pm25", "ok"],
    ["s5-llm-greska", "ok"],
    ["s6-bez-podataka", "no_data"],
  ];

  for (const [id, status] of ocekivano) {
    test(`${id} → ${status}`, async () => {
      const s = await ucitajScenario(id);
      const r = proceni(await napraviDemoKlijent(s).getHistory(s.stanica.id), new Date(s.sada));
      assert.equal(r.status, status);
      if (id === "s1-dobar") assert.ok(r.category && r.category.nivo <= 2);
      if (id === "s2-los") assert.ok(r.category && r.category.nivo >= 4);
      if (id === "s4-bez-pm25") assert.equal(r.category?.odredjujuca, "PM10");
      if (status !== "ok") assert.equal(r.category, null);
    });
  }
});
