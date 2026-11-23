import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GreskaBaze } from "./greske.js";
import { napraviBazuVazduhaIVremena, SQL_VV, UREDJAJ_VREMENA } from "./vazduh-vreme.js";

function lazna(odgovori: Record<string, unknown[]>) {
  const pozivi: Array<{ sql: string; parametri?: unknown[] }> = [];
  const baza = napraviBazuVazduhaIVremena(async (sql, parametri) => {
    pozivi.push({ sql, parametri });
    const kljuc = Object.entries(SQL_VV).find(([, s]) => s === sql)?.[0] ?? "";
    return { rows: odgovori[kljuc] ?? [] };
  });
  return { baza, pozivi };
}

describe("baza: vazduh i vreme", () => {
  it("uređaji za vazduh: numeric kao tekst postaje broj", async () => {
    const { baza } = lazna({
      uredjajiVazduha: [
        { id: "sc-1", naziv: "S", izvor: "sensor-community", lokacija: "Novi Sad", lat: "45.23918", lon: "19.79077", ima_pm25: true, ima_pm10: false },
      ],
    });
    assert.deepEqual(await baza.uredjajiVazduha(), [
      { id: "sc-1", naziv: "S", izvor: "sensor-community", lokacija: "Novi Sad", lat: 45.23918, lon: 19.79077, imaPm25: true, imaPm10: false },
    ]);
  });

  it("vazduh: vreme u zoni Beograda, null ostaje null, parametri umesto teksta u SQL-u", async () => {
    const { baza, pozivi } = lazna({
      vazduh: [{ uredjaj_id: "sc-1", vreme: new Date("2026-11-23T09:00:00Z"), pm25: "7.00", pm10: null, no2: null, o3: null }],
    });
    const od = new Date("2026-11-22T10:00:00Z");
    const doV = new Date("2026-11-23T10:00:00Z");
    const r = await baza.vazduh("sc-1", od, doV);
    assert.deepEqual(r, [{ uredjajId: "sc-1", vreme: "2026-11-23T10:00:00+01:00", pm25: 7, pm10: null, no2: null, o3: null }]);
    assert.deepEqual(pozivi[0].parametri, ["sc-1", od.toISOString(), doV.toISOString()]);
    assert.match(pozivi[0].sql, /NOT prognoza/);
  });

  it("poslednji vazduh je null kad nema redova", async () => {
    const { baza } = lazna({});
    assert.equal(await baza.poslednjiVazduh("sc-1", new Date()), null);
  });

  it("vreme čita uređaj Open-Meteo i zadržava negativnu temperaturu i oznaku prognoze", async () => {
    const { baza, pozivi } = lazna({
      vreme: [
        { uredjaj_id: UREDJAJ_VREMENA, vreme: "2026-11-23T09:00:00Z", temperatura_c: "-2.50", vlaznost_proc: "81", vetar_kmh: null, padavine_mm: "0", vreme_kod: 3, prognoza: true },
      ],
    });
    const [r] = await baza.vreme(new Date(0), new Date());
    assert.equal(r.temperaturaC, -2.5);
    assert.equal(r.vlaznostProc, 81);
    assert.equal(r.vetarKmh, null);
    assert.equal(r.vremeKod, 3);
    assert.equal(r.prognoza, true);
    assert.equal(pozivi[0].parametri?.[0], UREDJAJ_VREMENA);
  });

  it("greška veze postaje GreskaBaze „nedostupna“, neispravan red „neispravan_red“", async () => {
    const pukla = napraviBazuVazduhaIVremena(async () => {
      throw new Error("ECONNREFUSED");
    });
    await assert.rejects(pukla.uredjajiVazduha(), (e: unknown) => e instanceof GreskaBaze && e.kod === "nedostupna");
    const { baza } = lazna({ uredjajiVazduha: [{ id: 1 }] });
    await assert.rejects(baza.uredjajiVazduha(), (e: unknown) => e instanceof GreskaBaze && e.kod === "neispravan_red");
  });
});
