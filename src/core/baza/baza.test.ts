import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { GreskaBaze, napraviBazu, procitajUrlBaze, type IzvrsiUpit } from "./index.js";
import { SQL, uIso, uMerenje } from "./upiti.js";

/** Red onako kako ga vraća pg: numeric kao tekst, timestamptz kao Date. */
const red = (vreme: string, temp: string | null = "21.24") => ({
  uredjaj_id: "fishnet-1",
  vreme: new Date(vreme),
  temperatura_c: temp,
  ph: "5.34",
  orp: "182.5",
  dox: "3.94",
  con: "0.00",
  dox_zasicenje: "44.41",
  dco2: null,
});

/** Lažna baza: pamti pozive i vraća redove po upitu. */
function lazna(redovi: Partial<Record<keyof typeof SQL, unknown[]>>) {
  const pozivi: { sql: string; parametri?: unknown[] }[] = [];
  const izvrsi: IzvrsiUpit = async (sql, parametri) => {
    pozivi.push({ sql, parametri });
    const kljuc = (Object.keys(SQL) as (keyof typeof SQL)[]).find((k) => SQL[k] === sql);
    return { rows: (kljuc && redovi[kljuc]) ?? [] };
  };
  return { baza: napraviBazu(izvrsi), pozivi };
}

describe("baza – pretvaranje redova", () => {
  test("numeric tekst → broj, null ostaje null (nikad 0)", () => {
    const m = uMerenje(red("2023-01-23T00:07:59Z"));
    assert.equal(m.temperaturaC, 21.24);
    assert.equal(m.con, 0);
    assert.equal(m.dco2, null);
    assert.equal(m.doxZasicenje, 44.41);
  });

  test("vreme u zoni Beograda (NFR-06)", () => {
    assert.equal(uMerenje(red("2023-01-23T00:07:59Z")).vreme, "2023-01-23T01:07:59+01:00");
    assert.equal(uIso(null), null);
  });

  test("neispravan red → GreskaBaze neispravan_red", () => {
    assert.throws(
      () => uMerenje({ ...red("2023-01-23T00:07:59Z"), ph: "abc" }),
      (e: unknown) => e instanceof GreskaBaze && e.kod === "neispravan_red",
    );
    assert.throws(() => uMerenje({ vreme: "x" }), GreskaBaze);
  });
});

describe("baza – upiti", () => {
  test("uređaji", async () => {
    const { baza } = lazna({ uredjaji: [{ id: "fishnet-1", naziv: "FishNET 1", tip: "kvalitet vode", lokacija: null }] });
    assert.deepEqual(await baza.uredjaji(), [{ id: "fishnet-1", naziv: "FishNET 1", tip: "kvalitet vode", lokacija: null }]);
  });

  test("istorija: parametri $1 uređaj, $2 sati; najstarije prvo", async () => {
    const { baza, pozivi } = lazna({
      postojiUredjaj: [{ "?column?": 1 }],
      istorija: [red("2023-01-23T00:07:59Z"), red("2023-01-23T00:12:57Z")],
    });
    const m = await baza.istorija("fishnet-1", 6);
    assert.equal(m.length, 2);
    assert.deepEqual(pozivi.at(-1)?.parametri, ["fishnet-1", 6]);
    assert.ok(m[0]!.vreme < m[1]!.vreme);
  });

  test("istorija: sati van 1–168 se odbijaju pre upita", async () => {
    const { baza, pozivi } = lazna({});
    await assert.rejects(baza.istorija("fishnet-1", 0), RangeError);
    await assert.rejects(baza.istorija("fishnet-1", 169), RangeError);
    assert.equal(pozivi.length, 0);
  });

  test("nepoznat uređaj → GreskaBaze nepoznat_uredjaj", async () => {
    const { baza } = lazna({ postojiUredjaj: [] });
    await assert.rejects(baza.poslednjeMerenje("nema"), (e: unknown) => e instanceof GreskaBaze && e.kod === "nepoznat_uredjaj");
  });

  test("uređaj bez merenja → null", async () => {
    const { baza } = lazna({ postojiUredjaj: [{}], poslednjeMerenje: [] });
    assert.equal(await baza.poslednjeMerenje("fishnet-1"), null);
  });

  test("pregled: broj i raspon", async () => {
    const { baza } = lazna({
      pregled: [{ broj: 136, od: new Date("2023-01-23T00:07:59Z"), do: new Date("2023-01-23T13:15:53Z") }],
    });
    assert.deepEqual(await baza.pregled(), {
      brojMerenja: 136,
      od: "2023-01-23T01:07:59+01:00",
      do: "2023-01-23T14:15:53+01:00",
    });
  });

  test("greška veze → GreskaBaze nedostupna, bez detalja u poruci", async () => {
    const baza = napraviBazu(async () => {
      throw new Error("password authentication failed for user postgres");
    });
    await assert.rejects(baza.uredjaji(), (e: unknown) => {
      assert.ok(e instanceof GreskaBaze);
      assert.equal(e.kod, "nedostupna");
      assert.doesNotMatch(e.message, /password|postgres/);
      return true;
    });
  });
});

describe("baza – podešavanje", () => {
  test("bez DATABASE_URL → jasna greška konfiguracije", () => {
    assert.throws(() => procitajUrlBaze({}), (e: unknown) => e instanceof GreskaBaze && e.kod === "konfiguracija");
    assert.throws(() => procitajUrlBaze({ DATABASE_URL: "  " }), GreskaBaze);
  });

  test("sa DATABASE_URL", () => {
    assert.equal(procitajUrlBaze({ DATABASE_URL: " postgres://x@localhost/smartcity " }), "postgres://x@localhost/smartcity");
  });
});
