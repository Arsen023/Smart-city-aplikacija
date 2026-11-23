import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  adresaOpenMeteoVazduh,
  adresaSensorCommunity,
  GreskaIzvora,
  izOpenMeteoVazduha,
  izOpenMeteoVremena,
  izSensorCommunity,
  NOVI_SAD,
} from "./izvori.js";

const ucitaj = (ime: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../../fixtures/izvori/${ime}`, import.meta.url), "utf8"));

// fixtures: sati 1795413600 … 1795431600 (6 sati), Sensor.Community oko 09:52–09:57 UTC
const SADA = new Date(1795424400 * 1000); // četvrti sat; posle njega je prognoza

describe("Open-Meteo vreme", () => {
  const p = izOpenMeteoVremena(ucitaj("open-meteo-vreme.json"), NOVI_SAD, SADA);

  it("pravi jedan uređaj tipa vreme sa koordinatama iz odgovora", () => {
    assert.equal(p.uredjaji.length, 1);
    assert.deepEqual(p.uredjaji[0], {
      id: "open-meteo-vreme-ns",
      naziv: "Open-Meteo vreme – Novi Sad",
      tip: "vreme",
      izvor: "open-meteo",
      lokacija: "Novi Sad (model)",
      lat: 45.24554,
      lon: 19.84993,
    });
  });

  it("svaki sat je jedan red, vreme iz unix sekundi", () => {
    assert.equal(p.vreme.length, 6);
    assert.equal(p.vreme[0].vreme.toISOString(), "2026-11-23T06:00:00.000Z");
    assert.equal(p.vreme[0].temperaturaC, 4.6);
    assert.equal(p.vreme[0].vlaznostProc, 92);
    assert.equal(p.vreme[0].padavineMm, 1.6);
    assert.equal(p.vreme[0].vremeKod, 61);
    assert.equal(p.vazduh.length, 0);
  });

  it("sati posle `sada` su prognoza", () => {
    assert.deepEqual(p.vreme.map((r) => r.prognoza), [false, false, false, false, true, true]);
  });

  it("null ostaje null, a sat bez ijedne vrednosti se preskače", () => {
    const json = {
      latitude: 45, longitude: 19,
      hourly: {
        time: [1, 2],
        temperature_2m: [-3.5, null], relative_humidity_2m: [null, null], wind_speed_10m: [null, null],
        precipitation: [null, null], weather_code: [null, null],
      },
    };
    const r = izOpenMeteoVremena(json, NOVI_SAD, SADA);
    assert.equal(r.vreme.length, 1);
    assert.equal(r.vreme[0].temperaturaC, -3.5, "negativna temperatura je ispravna");
    assert.equal(r.vreme[0].vlaznostProc, null);
  });

  it("neočekivan oblik odgovora je GreskaIzvora", () => {
    assert.throws(() => izOpenMeteoVremena({ hourly: {} }, NOVI_SAD, SADA), GreskaIzvora);
  });
});

describe("Open-Meteo vazduh", () => {
  const p = izOpenMeteoVazduha(ucitaj("open-meteo-vazduh.json"), NOVI_SAD, SADA);

  it("PM2.5, PM10, NO2, O3 i EAQI izvora po satu", () => {
    assert.equal(p.uredjaji[0].id, "open-meteo-vazduh-ns");
    assert.equal(p.uredjaji[0].tip, "kvalitet vazduha");
    assert.equal(p.vazduh.length, 6);
    assert.deepEqual(
      { ...p.vazduh[3], vreme: p.vazduh[3].vreme.toISOString() },
      { uredjajId: "open-meteo-vazduh-ns", vreme: "2026-11-23T09:00:00.000Z", pm25: 8.1, pm10: 8.2, no2: 6.4, o3: 44, eaqiIzvor: 26, prognoza: false },
    );
  });

  it("adresa traži satne vrednosti u UTC kao unix vreme", () => {
    const a = new URL(adresaOpenMeteoVazduh(NOVI_SAD));
    assert.equal(a.searchParams.get("timezone"), "UTC");
    assert.equal(a.searchParams.get("timeformat"), "unixtime");
    assert.match(a.searchParams.get("hourly") ?? "", /pm2_5/);
  });
});

describe("Sensor.Community", () => {
  const p = izSensorCommunity(ucitaj("sensor-community.json"), NOVI_SAD, new Date("2026-11-23T10:00:00Z"));

  it("PM senzori idu u vazduh: P1 = PM10, P2 = PM2.5", () => {
    const r = p.vazduh.find((x) => x.uredjajId === "sc-66763" && x.vreme.toISOString() === "2026-11-23T09:56:49.000Z");
    assert.ok(r);
    assert.equal(r.pm10, 9.82);
    assert.equal(r.pm25, 7);
    assert.equal(r.no2, null, "senzor ne meri NO2 – null, ne 0");
    assert.equal(r.prognoza, false);
  });

  it("BME280 ide u vreme (temperatura i vlažnost)", () => {
    const r = p.vreme.find((x) => x.uredjajId === "sc-86102");
    assert.ok(r);
    assert.equal(r.temperaturaC, 5.5);
    assert.equal(r.vlaznostProc, 89.54);
    assert.equal(p.vazduh.some((x) => x.uredjajId === "sc-86102"), false);
  });

  it("svaki senzor je jedan uređaj sa koordinatama", () => {
    assert.deepEqual(p.uredjaji.map((u) => u.id).sort(), ["sc-66763", "sc-86101", "sc-86102", "sc-89119"]);
    const u = p.uredjaji.find((x) => x.id === "sc-66763");
    assert.equal(u?.lat, 45.23917980996);
    assert.equal(u?.tip, "kvalitet vazduha");
    assert.equal(p.uredjaji.find((x) => x.id === "sc-86102")?.tip, "vreme");
  });

  it("vreme bez zone tumači kao UTC; svi zapisi su uvezeni", () => {
    assert.equal(p.vazduh.length + p.vreme.length, 9);
  });

  it("preskače senzore u zatvorenom i negativne vrednosti", () => {
    const json = [
      {
        timestamp: "2026-11-23 09:00:00", location: { latitude: "45", longitude: "19", indoor: 1 },
        sensor: { id: 1, sensor_type: { name: "SDS011" } }, sensordatavalues: [{ value_type: "P2", value: "5" }],
      },
      {
        timestamp: "2026-11-23 09:00:00", location: { latitude: "45", longitude: "19", indoor: 0 },
        sensor: { id: 2, sensor_type: { name: "SDS011" } },
        sensordatavalues: [{ value_type: "P2", value: "-1" }, { value_type: "P1", value: "12" }],
      },
    ];
    const r = izSensorCommunity(json, NOVI_SAD, SADA);
    assert.deepEqual(r.uredjaji.map((u) => u.id), ["sc-2"]);
    assert.equal(r.vazduh[0].pm25, null);
    assert.equal(r.vazduh[0].pm10, 12);
  });

  it("adresa je filter po krugu oko lokacije", () => {
    assert.equal(adresaSensorCommunity(NOVI_SAD), "https://data.sensor.community/airrohr/v1/filter/area=45.25,19.84,5");
  });
});
