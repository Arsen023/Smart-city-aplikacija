import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PUTANJE_DASHBOARD_KOMPONENTI, PUTANJE_DASHBOARDA, PUTANJE_PODATAKA } from "../zajednicko/a2ui-katalog.js";
import { deloviDashboarda, podaciA2uiDashboarda, sa } from "./dashboard-a2ui.js";
import type { Dashboard } from "./dashboard-alati.js";

const SADA = new Date("2026-11-24T10:30:00+01:00");

const DASHBOARD: Dashboard = {
  azurirano: "2026-11-24T10:30:00+01:00",
  vazduh: {
    stanica: { id: "open-meteo-vazduh-ns", naziv: "Novi Sad (model Open-Meteo)" },
    status: "ok",
    measuredAt: "2026-11-24T10:00:00+01:00",
    category: { naziv: "Zadovoljavajući", nivo: 2, odredjujuca: "PM2.5" },
    pm25: 8.7,
    pm10: null,
    message: null,
    istorija: [{ vreme: "2026-11-24T10:00:00+01:00", pm25: 8.7, pm10: null, nivo: 2 }],
  },
  senzori: [
    { id: "open-meteo-vazduh-ns", naziv: "Model", lat: 45.3, lon: 19.8, vrsta: "model", status: "ok", category: null, pm25: 8.7, pm10: null, measuredAt: null },
    { id: "sc-1", naziv: "Senzor", lat: 45.24, lon: 19.79, vrsta: "senzor", status: "stale", category: null, pm25: null, pm10: null, measuredAt: null },
  ],
  vreme: {
    trenutno: { vreme: "2026-11-24T10:00:00+01:00", temperaturaC: -1.5, vlaznostProc: 80, vetarKmh: null, padavineMm: 0, vremeKod: 3, opis: "Oblačno", ikona: "☁️" },
    prognoza: [{ vreme: "2026-11-24T11:00:00+01:00", temperaturaC: 0, vlaznostProc: 78, vetarKmh: 10, padavineMm: 0, vremeKod: 61, opis: "Kiša", ikona: "🌧️" }],
    protekla24h: [{ vreme: "2026-11-24T10:00:00+01:00", temperaturaC: -1.5, vlaznostProc: 80, vetarKmh: null, padavineMm: 0, vremeKod: 3, opis: "Oblačno", ikona: "☁️" }],
  },
  voda: null,
  greske: [],
};

describe("A2UI podaci sa table", () => {
  const p = podaciA2uiDashboarda(DASHBOARD, SADA);

  it("nedostajuća vrednost je „nije dostupno“, nula ostaje nula", () => {
    assert.equal(sa(null, "km/h"), "nije dostupno");
    assert.equal(sa(0, "°C"), "0 °C");
    assert.equal(sa(-1.5, "°C"), "-1,5 °C");
  });

  it("vreme: tekstovi i nizovi za komponente", () => {
    const m = p.meteo as Record<string, unknown>;
    assert.equal(m.temperatura, "-1,5 °C");
    assert.equal(m.vetar, "nije dostupno");
    assert.deepEqual(m.prognoza, [{ sat: "11:00", ikona: "🌧️", temperatura: "0 °C", opis: "Kiša" }]);
    assert.deepEqual(m.temperatura24h, [{ oznaka: "10:00", vrednost: -1.5 }]);
  });

  it("vazduh koristi iste putanje kao ekran procene, bez saveta", () => {
    assert.equal(p.stanica, "Novi Sad (model Open-Meteo)");
    assert.deepEqual(p.kategorija, { naziv: "Zadovoljavajući", nivo: 2 });
    assert.equal("savet" in p, false);
    assert.equal(p.pm10Broj, "nije dostupno");
  });

  it("voda koje nema je „nije dostupno“ i prazni nizovi", () => {
    const v = p.voda as Record<string, unknown>;
    assert.equal(v.kiseonik, "nije dostupno");
    assert.deepEqual(v.kiseonik24h, []);
  });

  it("senzori za mapu: nivo null kad nema procene, model označen", () => {
    const s = p.senzori as unknown as Array<Record<string, unknown>>;
    assert.equal(s[0].model, true);
    assert.equal(s[1].kategorija, "Zastareli podaci");
    assert.equal(s[1].nivo, null);
    assert.match(String(p.senzoriOpis), /senzora/);
  });

  it("delovi govore AI-ju šta postoji", () => {
    assert.deepEqual(deloviDashboarda(DASHBOARD), ["vazduh", "vreme", "senzori"]);
  });

  it("svaka dozvoljena putanja postoji u podacima", () => {
    const dohvati = (putanja: string) =>
      putanja.split("/").filter(Boolean).reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], p);
    const putanje = [...Object.keys(PUTANJE_DASHBOARDA), ...Object.keys(PUTANJE_DASHBOARD_KOMPONENTI)];
    for (const put of putanje) assert.notEqual(dohvati(put), undefined, put);
    for (const put of Object.keys(PUTANJE_PODATAKA).filter((x) => !["/savet", "/osnov"].includes(x))) {
      assert.notEqual(dohvati(put), undefined, put);
    }
  });
});
