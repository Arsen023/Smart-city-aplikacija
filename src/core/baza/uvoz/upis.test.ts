import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RedVazduha } from "./izvori.js";
import { bezDuplikata, mesta, sqlVazduha, upisi } from "./upis.js";

describe("upis u bazu", () => {
  it("mesta za parametre se nižu redom", () => {
    assert.equal(mesta(2, 3), "($1, $2, $3), ($4, $5, $6)");
  });

  it("bezDuplikata zadržava poslednji red za isti ključ", () => {
    assert.deepEqual(bezDuplikata([{ k: "a", v: 1 }, { k: "a", v: 2 }, { k: "b", v: 3 }], (r) => r.k), [
      { k: "a", v: 2 },
      { k: "b", v: 3 },
    ]);
  });

  it("isto (uređaj, vreme) se ažurira, ključ se ne menja", () => {
    const sql = sqlVazduha(1);
    assert.match(sql, /ON CONFLICT \(uredjaj_id, vreme\) DO UPDATE SET/);
    assert.match(sql, /pm25 = EXCLUDED\.pm25/);
    assert.doesNotMatch(sql, /uredjaj_id = EXCLUDED/);
  });

  it("upisuje uređaje pre merenja, sa parametrima umesto vrednosti u SQL-u", async () => {
    const upiti: Array<{ sql: string; parametri?: unknown[] }> = [];
    const red: RedVazduha = {
      uredjajId: "sc-1", vreme: new Date("2026-11-23T09:00:00Z"), pm25: 7, pm10: null, no2: null, o3: null,
      eaqiIzvor: null, prognoza: false,
    };
    const ishod = await upisi(
      async (sql, parametri) => {
        upiti.push({ sql, parametri });
        return { rows: [] };
      },
      {
        uredjaji: [{ id: "sc-1", naziv: "S", tip: "kvalitet vazduha", izvor: "sensor-community", lokacija: null, lat: 45, lon: 19 }],
        vazduh: [red, { ...red, pm25: 8 }],
        vreme: [],
      },
    );
    assert.deepEqual(ishod, { uredjaja: 1, vazduha: 1, vremena: 0 });
    assert.equal(upiti.length, 2);
    assert.match(upiti[0].sql, /^INSERT INTO uredjaj/);
    assert.match(upiti[1].sql, /^INSERT INTO merenje_vazduha/);
    assert.deepEqual(upiti[1].parametri, ["sc-1", "2026-11-23T09:00:00.000Z", 8, null, null, null, null, false]);
    assert.doesNotMatch(upiti[1].sql, /sc-1/);
  });
});
