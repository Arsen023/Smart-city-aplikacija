import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BazaVazduhaIVremena, RedVazduhaIzBaze, UredjajVazduha } from "../baza/index.js";
import { proceni } from "../pravila/index.js";
import { napraviKlijentIzBaze } from "./baza.js";
import { GreskaEkonet } from "./greske.js";
import { procitajPodesavanja } from "./index.js";

const SADA = new Date("2026-11-23T10:30:00+01:00");

const UREDJAJI: UredjajVazduha[] = [
  { id: "open-meteo-vazduh-ns", naziv: "Open-Meteo vazduh – Novi Sad", izvor: "open-meteo", lokacija: "Novi Sad (model CAMS)", lat: 45.3, lon: 19.8, imaPm25: true, imaPm10: true },
  { id: "sc-66763", naziv: "x", izvor: "sensor-community", lokacija: "Novi Sad", lat: 45.239, lon: 19.79, imaPm25: true, imaPm10: true },
  { id: "bez-koordinata", naziv: "y", izvor: null, lokacija: null, lat: null, lon: null, imaPm25: true, imaPm10: false },
];

/** Lažna baza: redovi po satu za poslednja 3 sata, poslednji sat bez PM10. */
function laznaBaza(redovi: RedVazduhaIzBaze[]): BazaVazduhaIVremena {
  return {
    async uredjajiVazduha() {
      return UREDJAJI;
    },
    async vazduh(id, od, doV) {
      return redovi.filter((r) => r.uredjajId === id && Date.parse(r.vreme) > od.getTime() && Date.parse(r.vreme) <= doV.getTime());
    },
    async poslednjiVazduh(id, doV) {
      return redovi.filter((r) => r.uredjajId === id && Date.parse(r.vreme) <= doV.getTime()).at(-1) ?? null;
    },
    async vreme() {
      return [];
    },
  };
}

const red = (vreme: string, pm25: number | null, pm10: number | null): RedVazduhaIzBaze => ({
  uredjajId: "open-meteo-vazduh-ns", vreme, pm25, pm10, no2: null, o3: null,
});

describe("K1 klijent nad bazom", () => {
  const klijent = napraviKlijentIzBaze(
    laznaBaza([
      red("2026-11-23T08:00:00+01:00", 6, 9),
      red("2026-11-23T09:00:00+01:00", 7, 10),
      red("2026-11-23T10:00:00+01:00", 8.1, null),
    ]),
    () => SADA,
  );

  it("stanice: model prvi, čitljiv naziv, uređaj bez koordinata se preskače", async () => {
    const s = await klijent.getStations();
    assert.deepEqual(s.map((x) => x.id), ["open-meteo-vazduh-ns", "sc-66763"]);
    assert.equal(s[0].naziv, "Novi Sad (model Open-Meteo)");
    assert.equal(s[1].naziv, "Senzor Sensor.Community #66763");
    assert.deepEqual(s[0].velicine, ["PM2.5", "PM10"]);
  });

  it("poslednje merenje: veličina koje nema se ne izmišlja (nije 0)", async () => {
    const m = await klijent.getLatest("open-meteo-vazduh-ns");
    assert.deepEqual(m.map((x) => [x.velicina, x.vrednost]), [["PM2.5", 8.1]]);
    assert.equal(m[0].jedinica, "µg/m³");
  });

  it("istorija za N sati unazad od sada", async () => {
    const h = await klijent.getHistory("open-meteo-vazduh-ns", 2);
    assert.deepEqual(h.map((x) => x.vrednost), [7, 10, 8.1]);
  });

  it("K2 nad podacima iz baze daje status ok i kategoriju", async () => {
    const p = proceni(await klijent.getHistory("open-meteo-vazduh-ns", 24), SADA);
    assert.equal(p.status, "ok");
    assert.ok(p.category);
  });

  it("nepoznata stanica je GreskaEkonet", async () => {
    await assert.rejects(klijent.getLatest("demo-liman"), (e: unknown) => e instanceof GreskaEkonet && e.kod === "nepoznata_stanica");
  });

  it("EKONET_IZVOR=baza je dozvoljen izvor", () => {
    assert.deepEqual(procitajPodesavanja({ EKONET_IZVOR: "baza" }), { izvor: "baza" });
  });
});
