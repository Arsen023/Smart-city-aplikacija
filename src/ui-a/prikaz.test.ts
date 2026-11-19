import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Rezultat } from "../core/tipovi.js";
import { bojeKategorije } from "../zajednicko/boje-eaqi.js";
import { modelEkrana, PORUKA_GRESKA, PORUKA_UCITAVANJE, tekstZaModel } from "./prikaz.js";
import {
  rezultatGreska,
  rezultatS1,
  rezultatS2,
  rezultatS3,
  rezultatS4,
  rezultatS5,
  rezultatS6,
} from "./test-podaci.js";

const m = (r: Rezultat) => modelEkrana({ vrsta: "rezultat", rezultat: r });

describe("ekran A – model prikaza", () => {
  test("učitavanje: samo poruka, bez podataka", () => {
    const e = modelEkrana({ vrsta: "ucitavanje" });
    assert.equal(e.stanje, "ucitavanje");
    assert.equal(e.poruka, PORUKA_UCITAVANJE);
    assert.equal(e.vrednosti, null);
    assert.equal(e.kategorija, null);
    assert.equal(e.savet, null);
  });

  test("S1 ok: vrednosti, vreme, kategorija sa bojom, savet, osnov, pravilo", () => {
    const e = m(rezultatS1());
    assert.equal(e.naslov, "Kvalitet vazduha – Liman");
    assert.equal(e.stanicaId, "demo-liman");
    assert.deepEqual(e.vrednosti, ["PM2.5 3,7 µg/m³", "PM10 12,4 µg/m³"]);
    assert.equal(e.vreme, "Merenje: 16.11.2026. 09:00");
    assert.deepEqual(e.kategorija, { naziv: "Dobar", opis: "Određuje PM10", ...bojeKategorije(1) });
    assert.equal(e.poruka, null);
    assert.equal(e.savet, "Vazduh je dobar, slobodno izađite.");
    assert.match(e.osnov ?? "", /^Osnov: /);
    assert.equal(e.pravilo, "Pravilo: EAQI, satne vrednosti, najlošiji podindeks");
    assert.equal(e.pokusajPonovo, false);
  });

  test("S2 loš: boja i naziv iz kategorije servera", () => {
    const e = m(rezultatS2());
    assert.equal(e.kategorija?.naziv, "Loš");
    assert.equal(e.kategorija?.pozadina, bojeKategorije(4).pozadina);
    assert.equal(e.kategorija?.opis, "Određuje PM2.5");
  });

  test("S3 stale: vrednosti, vreme i poruka; bez kategorije i saveta", () => {
    const e = m(rezultatS3());
    assert.equal(e.stanje, "stale");
    assert.ok(e.vrednosti);
    assert.equal(e.vreme, "Merenje: 16.11.2026. 05:00");
    assert.equal(e.kategorija, null);
    assert.equal(e.savet, null);
    assert.equal(e.osnov, null);
    assert.equal(e.pravilo, null);
    assert.match(e.poruka ?? "", /05:00/);
  });

  test("S4: PM2.5 „nije dostupno“, nikad 0, uz napomenu", () => {
    const e = m(rezultatS4());
    assert.equal(e.vrednosti?.[0], "PM2.5 nije dostupno");
    assert.doesNotMatch(e.vrednosti?.[0] ?? "", /\b0\b/);
    assert.equal(e.napomena, "PM2.5 nije dostupno, kategorija iz PM10.");
    assert.ok(e.kategorija);
  });

  test("S5 ok bez saveta: kategorija ostaje, savet izostaje uz poruku", () => {
    const e = m(rezultatS5());
    assert.equal(e.stanje, "ok");
    assert.ok(e.kategorija);
    assert.equal(e.savet, null);
    assert.equal(e.osnov, null);
    assert.match(e.poruka ?? "", /Savet trenutno nije dostupan/);
  });

  test("S6 no_data: samo poruka i „nema podataka“", () => {
    const e = m(rezultatS6());
    assert.equal(e.stanje, "no_data");
    assert.equal(e.vrednosti, null);
    assert.equal(e.vreme, "Merenje: nema podataka");
    assert.equal(e.kategorija, null);
    assert.equal(e.savet, null);
    assert.equal(e.pokusajPonovo, false);
    assert.ok(e.poruka);
  });

  test("status error: poruka i „Pokušaj ponovo“", () => {
    const e = m(rezultatGreska());
    assert.equal(e.stanje, "error");
    assert.equal(e.vrednosti, null);
    assert.equal(e.vreme, null);
    assert.equal(e.kategorija, null);
    assert.equal(e.pokusajPonovo, true);
    assert.equal(e.poruka, rezultatGreska().message);
  });

  test("greška poziva / neispravan oblik: opšta poruka i stanica ako je poznata", () => {
    const e = modelEkrana({ vrsta: "greska", stanica: { id: "demo-liman", naziv: "Liman" } });
    assert.equal(e.stanje, "error");
    assert.equal(e.poruka, PORUKA_GRESKA);
    assert.equal(e.stanicaId, "demo-liman");
    assert.equal(e.pokusajPonovo, true);
  });

  test("nedosledan ulaz: kategorija i savet uz status stale se ne prikazuju", () => {
    const s1 = rezultatS1();
    const e = m({ ...s1, status: "stale", message: "Staro merenje." });
    assert.equal(e.kategorija, null);
    assert.equal(e.savet, null);
    assert.equal(e.poruka, "Staro merenje.");
  });

  test("veličina koju server ne pošalje je „nije dostupno“", () => {
    const e = m({ ...rezultatS1(), values: [{ velicina: "PM10", vrednost: 12.4, jedinica: "µg/m³" }] });
    assert.deepEqual(e.vrednosti, ["PM2.5 nije dostupno", "PM10 12,4 µg/m³"]);
  });
});

describe("ekran A – tekst za model", () => {
  test("ok: stanica, vrednosti, vreme i kategorija", () => {
    const t = tekstZaModel(m(rezultatS1()));
    assert.match(t, /Liman/);
    assert.match(t, /16\.11\.2026\. 09:00/);
    assert.match(t, /Kategorija: Dobar/);
  });

  test("stale: status i poruka, bez kategorije", () => {
    const t = tekstZaModel(m(rezultatS3()));
    assert.match(t, /Status: stale/);
    assert.match(t, /05:00/);
    assert.doesNotMatch(t, /Kategorija/);
  });
});

describe("ekran A – „pre X min“ (element 3)", () => {
  test("sa „sada“ servera: isti tekst kao u verziji B", () => {
    const e = modelEkrana({ vrsta: "rezultat", rezultat: rezultatS1(), sada: new Date("2026-11-16T09:20:00+01:00") });
    assert.equal(e.vreme, "Merenje: 16.11.2026. 09:00 · pre 20 min");
  });

  test("stale (S3): vidi se koliko je merenje staro", () => {
    const e = modelEkrana({ vrsta: "rezultat", rezultat: rezultatS3(), sada: new Date("2026-11-16T09:20:00+01:00") });
    assert.equal(e.vreme, "Merenje: 16.11.2026. 05:00 · pre 4 h");
  });

  test("bez „sada“: samo vreme merenja, bez izmišljenog „pre X min“", () => {
    assert.equal(m(rezultatS1()).vreme, "Merenje: 16.11.2026. 09:00");
  });

  test("no_data (S6): nema „pre X min“", () => {
    const e = modelEkrana({ vrsta: "rezultat", rezultat: rezultatS6(), sada: new Date("2026-11-16T09:20:00+01:00") });
    assert.equal(e.vreme, "Merenje: nema podataka");
  });
});

describe("ekran A – grafikon 24 h (element 5)", () => {
  const istorija = [
    { vreme: "2026-11-16T07:00:00+01:00", pm25: 4, pm10: 9 },
    { vreme: "2026-11-16T08:00:00+01:00", pm25: 5, pm10: 11 },
    { vreme: "2026-11-16T09:00:00+01:00", pm25: 3.7, pm10: 12.4 },
  ];

  test("ok (S1): obe linije, jedinica u potpisu i opisu", () => {
    const g = m({ ...rezultatS1(), history: istorija }).grafikon;
    assert.ok(g);
    assert.ok(g.g.pm25.startsWith("M"));
    assert.ok(g.g.pm10.startsWith("M"));
    assert.equal(g.potpis, "µg/m³, poslednja 24 h");
    assert.match(g.opis, /PM2\.5 i PM10.*µg\/m³/);
  });

  test("S5 bez saveta: grafikon se i dalje vidi", () => {
    assert.ok(m({ ...rezultatS5(), history: istorija }).grafikon);
  });

  test("stale (S3): grafikon se vidi (stari podaci), bez kategorije i saveta", () => {
    const e = m({ ...rezultatS3(), history: istorija });
    assert.ok(e.grafikon);
    assert.equal(e.kategorija, null);
    assert.equal(e.savet, null);
  });

  test("S4: bez PM2.5 nema linije PM2.5, nema crtanja nule", () => {
    const g = m({ ...rezultatS4(), history: istorija.map((t) => ({ ...t, pm25: null })) }).grafikon;
    assert.ok(g);
    assert.equal(g.g.pm25, "");
    assert.ok(g.g.pm10.length > 0);
  });

  test("istorija bez ijedne vrednosti: nema grafikona", () => {
    const prazna = istorija.map((t) => ({ ...t, pm25: null, pm10: null }));
    assert.equal(m({ ...rezultatS1(), history: prazna }).grafikon, null);
  });

  test("no_data (S6), greška i učitavanje: nema grafikona", () => {
    assert.equal(m(rezultatS6()).grafikon, null);
    assert.equal(m({ ...rezultatGreska(), history: istorija }).grafikon, null);
    assert.equal(modelEkrana({ vrsta: "greska" }).grafikon, null);
    assert.equal(modelEkrana({ vrsta: "ucitavanje" }).grafikon, null);
  });
});
