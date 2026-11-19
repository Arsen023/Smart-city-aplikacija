import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { KOMPONENTA_GRAFIKON, KOMPONENTA_KATEGORIJA } from "../zajednicko/a2ui-katalog.js";
import { MAX_KOMPONENTI, promptRasporeda, proveriRaspored } from "./a2ui-raspored.js";

const SAMO_GRAFIKON = {
  koren: "glavna",
  komponente: [
    { id: "glavna", tip: "Kolona", deca: ["naslov", "kat", "graf"] },
    { id: "naslov", tip: "Tekst", podatak: "/stanica", stil: "h3" },
    { id: "kat", tip: "Kategorija" },
    { id: "graf", tip: "Grafikon" },
  ],
};

const neuspeh = (ulaz: unknown) => {
  const r = proveriRaspored(ulaz);
  assert.equal(r.ok, false);
  return r.ok ? "" : r.razlog;
};

describe("proveriRaspored – ispravan raspored", () => {
  test("prevodi se u A2UI sa prefiksom ai-", () => {
    const r = proveriRaspored(SAMO_GRAFIKON);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.koren, "ai-glavna");
    const po = (id: string) => r.komponente.find((k) => k.id === id);
    assert.deepEqual(po("ai-glavna")?.children, ["ai-naslov", "ai-kat", "ai-graf"]);
    assert.deepEqual(po("ai-naslov")?.text, { path: "/stanica" });
    assert.equal(po("ai-kat")?.component, KOMPONENTA_KATEGORIJA);
    assert.deepEqual(po("ai-kat")?.naziv, { path: "/kategorija/naziv" });
    assert.equal(po("ai-graf")?.component, KOMPONENTA_GRAFIKON);
    assert.deepEqual(po("ai-graf")?.tacke, { path: "/istorija" });
  });

  test("kartica, red, razdelnik i statički naslov bez cifara", () => {
    const r = proveriRaspored({
      koren: "k",
      komponente: [
        { id: "k", tip: "Kolona", deca: ["n", "red", "linija"] },
        { id: "n", tip: "Tekst", tekst: "Vrednosti čestica", stil: "h4" },
        { id: "red", tip: "Red", deca: ["c1", "c2"], raspored: "spaceBetween" },
        { id: "c1", tip: "Kartica", dete: "t1" },
        { id: "c2", tip: "Kartica", dete: "t2" },
        { id: "t1", tip: "Tekst", podatak: "/pm25Broj", stil: "h2" },
        { id: "t2", tip: "Tekst", podatak: "/pm10Broj", stil: "h2" },
        { id: "linija", tip: "Razdelnik" },
      ],
    });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.komponente.find((k) => k.id === "ai-c1")?.child, "ai-t1");
    assert.equal(r.komponente.find((k) => k.id === "ai-red")?.justify, "spaceBetween");
    assert.equal(r.komponente.find((k) => k.id === "ai-n")?.text, "Vrednosti čestica");
  });

  test("beleži da li se koriste savet i osnov (FR-11)", () => {
    const r = proveriRaspored({
      koren: "k",
      komponente: [
        { id: "k", tip: "Kolona", deca: ["s"] },
        { id: "s", tip: "Tekst", podatak: "/savet" },
      ],
    });
    assert.ok(r.ok && r.koristiSavet && !r.koristiOsnov);
  });

  test("komponente koje nisu dostupne iz korena se ne šalju", () => {
    const r = proveriRaspored({
      koren: "k",
      komponente: [
        { id: "k", tip: "Kolona", deca: ["a"] },
        { id: "a", tip: "Kategorija" },
        { id: "visak", tip: "Grafikon" },
      ],
    });
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.komponente.length, 2);
  });
});

describe("proveriRaspored – AI ne može da upiše broj ni nepoznat podatak", () => {
  test("statički tekst sa brojem se odbija (pravilo 7)", () => {
    assert.match(
      neuspeh({ koren: "t", komponente: [{ id: "t", tip: "Tekst", tekst: "PM2.5 je 12 µg/m³" }] }),
      /sadrži broj/,
    );
  });

  test("kategorija ne može da se napiše kao tekst sa cifrom nivoa", () => {
    neuspeh({ koren: "t", komponente: [{ id: "t", tip: "Tekst", tekst: "Loš, nivo 4" }] });
  });

  test("nepoznata putanja se odbija", () => {
    assert.match(neuspeh({ koren: "t", komponente: [{ id: "t", tip: "Tekst", podatak: "/kategorija/nivo" }] }), /nepoznata putanja/);
    neuspeh({ koren: "t", komponente: [{ id: "t", tip: "Tekst", podatak: "/kljuc" }] });
  });

  test("nepoznat tip komponente i dodatna polja se odbijaju", () => {
    neuspeh({ koren: "x", komponente: [{ id: "x", tip: "Html" }] });
    neuspeh({ koren: "x", komponente: [{ id: "x", tip: "Kategorija", boja: "red" }] });
    neuspeh({ koren: "x", komponente: [{ id: "x", tip: "Kategorija", tekst: "Dobar" }] });
  });

  test("tekst mora imati tačno jedno: podatak ili tekst", () => {
    neuspeh({ koren: "t", komponente: [{ id: "t", tip: "Tekst" }] });
    neuspeh({ koren: "t", komponente: [{ id: "t", tip: "Tekst", podatak: "/stanica", tekst: "Naslov" }] });
  });

  test("predugačak statički tekst se odbija", () => {
    neuspeh({ koren: "t", komponente: [{ id: "t", tip: "Tekst", tekst: "a".repeat(61) }] });
  });
});

describe("proveriRaspored – struktura", () => {
  test("nepostojeći koren ili dete", () => {
    neuspeh({ koren: "nema", komponente: [{ id: "a", tip: "Grafikon" }] });
    assert.match(neuspeh({ koren: "k", komponente: [{ id: "k", tip: "Kolona", deca: ["nema"] }] }), /nepostojeće/);
  });

  test("ciklus i višestruka upotreba se odbijaju", () => {
    neuspeh({
      koren: "a",
      komponente: [
        { id: "a", tip: "Kolona", deca: ["b"] },
        { id: "b", tip: "Kolona", deca: ["a"] },
      ],
    });
    neuspeh({
      koren: "a",
      komponente: [
        { id: "a", tip: "Kolona", deca: ["g", "g"] },
        { id: "g", tip: "Grafikon" },
      ],
    });
  });

  test("dupli id, prazna kolona, kartica bez deteta", () => {
    neuspeh({ koren: "a", komponente: [{ id: "a", tip: "Grafikon" }, { id: "a", tip: "Kategorija" }] });
    neuspeh({ koren: "a", komponente: [{ id: "a", tip: "Kolona", deca: [] }] });
    neuspeh({ koren: "a", komponente: [{ id: "a", tip: "Kartica" }] });
  });

  test("previše komponenti i neispravan id", () => {
    const mnogo = Array.from({ length: MAX_KOMPONENTI + 1 }, (_, i) => ({ id: `r${i}`, tip: "Razdelnik" }));
    neuspeh({ koren: "r0", komponente: mnogo });
    neuspeh({ koren: "A B", komponente: [{ id: "A B", tip: "Grafikon" }] });
  });

  test("nije objekat", () => {
    neuspeh("nije json");
    neuspeh(null);
  });
});

describe("prompt", () => {
  test("sadrži želju, putanje i zabranu brojeva", () => {
    const p = promptRasporeda("samo grafikon");
    assert.match(p.korisnik, /samo grafikon/);
    assert.match(p.sistem, /\/pm25Broj/);
    assert.match(p.sistem, /BEZ cifara/);
  });
});
