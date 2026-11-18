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
