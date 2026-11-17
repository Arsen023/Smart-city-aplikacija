import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { napraviIzvor, type DemoScenarioId } from "../core/ekonet/index.js";
import { napraviSavet } from "../core/llm/index.js";
import type { EkonetKlijent, NapraviSavetFn, Rezultat, Savet } from "../core/tipovi.js";
import {
  PORUKA_BEZ_SAVETA,
  proceniKvalitet,
  tekstRezultata,
  zavisnostiIzOkruzenja,
  type ZavisnostiProcene,
} from "./procena.js";

const tiho = () => {};
const SAVET: Savet = { savet: "Vazduh je u redu za šetnju.", osnov: "Demo stanica, EAQI." };

/** Lažni K3 koji broji pozive. */
function lazniSavet(odgovor: Savet | null = SAVET): NapraviSavetFn & { pozivi: number } {
  const fn = Object.assign(
    async () => {
      fn.pozivi++;
      return odgovor;
    },
    { pozivi: 0 },
  );
  return fn;
}

async function zavisnosti(scenario: DemoScenarioId, savet: NapraviSavetFn = lazniSavet()): Promise<ZavisnostiProcene> {
  const izvor = await napraviIzvor({ EKONET_SCENARIO: scenario });
  return { klijent: izvor.klijent, sada: izvor.sada, napraviSavet: savet, log: tiho };
}

const pm = (r: Rezultat, v: "PM2.5" | "PM10") => r.values.find((x) => x.velicina === v)?.vrednost;

describe("proceniKvalitet nad demo scenarijima", () => {
  test("S1: ok, kategorija i savet", async () => {
    const savet = lazniSavet();
    const r = await proceniKvalitet(await zavisnosti("s1-dobar", savet));
    assert.equal(r.status, "ok");
    assert.ok(r.category && r.category.nivo <= 2);
    assert.deepEqual(r.advice, SAVET);
    assert.equal(r.message, null);
    assert.equal(savet.pozivi, 1);
    assert.equal(r.station.id, "demo-liman");
    assert.ok(r.history.length > 0);
    assert.equal(typeof pm(r, "PM2.5"), "number");
  });

  test("S2: ok, kategorija Loš ili gora", async () => {
    const r = await proceniKvalitet(await zavisnosti("s2-los"));
    assert.equal(r.status, "ok");
    assert.ok(r.category && r.category.nivo >= 4);
  });

  test("S3: stale, bez kategorije i saveta, LLM se ne poziva, poruka ima vreme", async () => {
    const savet = lazniSavet();
    const r = await proceniKvalitet(await zavisnosti("s3-zastareo", savet));
    assert.equal(r.status, "stale");
    assert.equal(r.category, null);
    assert.equal(r.advice, null);
    assert.equal(savet.pozivi, 0);
    assert.ok(r.measuredAt);
    assert.match(r.message ?? "", /\d{2}:\d{2}/);
  });

  test("S4: PM2.5 je null (ne 0), kategorija iz PM10 uz napomenu", async () => {
    const r = await proceniKvalitet(await zavisnosti("s4-bez-pm25"));
    assert.equal(r.status, "ok");
    assert.equal(pm(r, "PM2.5"), null);
    assert.equal(r.category?.odredjujuca, "PM10");
    assert.ok(r.napomena);
  });

  test("S5: K3 vrati null → merenja i kategorija bez saveta, uz poruku", async () => {
    const r = await proceniKvalitet(await zavisnosti("s5-llm-greska", lazniSavet(null)));
    assert.equal(r.status, "ok");
    assert.ok(r.category);
    assert.equal(r.advice, null);
    assert.equal(r.message, PORUKA_BEZ_SAVETA);
  });

  test("s6: no_data, LLM se ne poziva", async () => {
    const savet = lazniSavet();
    const r = await proceniKvalitet(await zavisnosti("s6-bez-podataka", savet));
    assert.equal(r.status, "no_data");
    assert.equal(r.category, null);
    assert.equal(r.advice, null);
    assert.equal(savet.pozivi, 0);
    assert.deepEqual(r.values.map((v) => v.vrednost), [null, null]);
  });

  test("bez stationId uzima prvu stanicu", async () => {
    const r = await proceniKvalitet(await zavisnosti("s1-dobar"));
    assert.equal(r.station.id, "demo-liman");
  });

  test("nepoznata stanica: error bez izuzetka", async () => {
    const savet = lazniSavet();
    const r = await proceniKvalitet(await zavisnosti("s1-dobar", savet), "nema-je");
    assert.equal(r.status, "error");
    assert.equal(r.category, null);
    assert.equal(r.advice, null);
    assert.equal(r.measuredAt, null);
    assert.match(r.message ?? "", /nema-je/);
    assert.equal(savet.pozivi, 0);
  });

  test("klijent koji baca grešku: error sa porukom na srpskom", async () => {
    const pokvaren: EkonetKlijent = {
      getStations: async () => {
        throw new Error("ECONNREFUSED 10.0.0.1");
      },
      getLatest: async () => [],
      getHistory: async () => [],
    };
    const r = await proceniKvalitet({ klijent: pokvaren, sada: () => new Date(), napraviSavet: lazniSavet(), log: tiho });
    assert.equal(r.status, "error");
    assert.match(r.message ?? "", /nisu dostupni/);
    assert.doesNotMatch(r.message ?? "", /ECONNREFUSED/);
  });

  test("pravi K3 sa LLM-om koji vrati neispravan JSON → advice null", async () => {
    const savet: NapraviSavetFn = (u) => napraviSavet(u, { llm: async () => "ovo nije json", log: tiho });
    const r = await proceniKvalitet(await zavisnosti("s1-dobar", savet));
    assert.equal(r.status, "ok");
    assert.equal(r.advice, null);
    assert.equal(r.message, PORUKA_BEZ_SAVETA);
  });
});

describe("zavisnostiIzOkruzenja", () => {
  test("s5-llm-greska: LLM namerno ne radi, bez mreže", async () => {
    const z = await zavisnostiIzOkruzenja({ EKONET_SCENARIO: "s5-llm-greska" }, { log: tiho });
    const r = await proceniKvalitet(z);
    assert.equal(r.status, "ok");
    assert.ok(r.category);
    assert.equal(r.advice, null);
  });
});

describe("tekstRezultata", () => {
  test("postoji za sve statuse i na srpskom je", async () => {
    const statusi = new Map<string, string>();
    for (const id of ["s1-dobar", "s3-zastareo", "s6-bez-podataka"] as const) {
      const r = await proceniKvalitet(await zavisnosti(id));
      statusi.set(r.status, tekstRezultata(r));
    }
    const greska = await proceniKvalitet(await zavisnosti("s1-dobar"), "nema-je");
    statusi.set(greska.status, tekstRezultata(greska));

    assert.deepEqual([...statusi.keys()].sort(), ["error", "no_data", "ok", "stale"]);
    for (const t of statusi.values()) assert.ok(t.length > 10);
    assert.match(statusi.get("ok") ?? "", /Kategorija: /);
    assert.match(statusi.get("ok") ?? "", /Savet: /);
    assert.match(statusi.get("stale") ?? "", /Poslednje merenje/);
    assert.match(statusi.get("no_data") ?? "", /Nema merenja/);
    assert.match(statusi.get("error") ?? "", /ne postoji/);
  });

  test("ok: decimalni zarez i „nije dostupno“ umesto 0", async () => {
    const r = await proceniKvalitet(await zavisnosti("s4-bez-pm25"));
    const t = tekstRezultata(r);
    assert.match(t, /PM2\.5 nije dostupno/);
    assert.doesNotMatch(t, /PM2\.5 0/);
  });
});
