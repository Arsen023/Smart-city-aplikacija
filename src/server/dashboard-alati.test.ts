import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BazaVazduhaIVremena, BazaVode, RedVremenaIzBaze } from "../core/baza/index.js";
import { GreskaBaze } from "../core/baza/index.js";
import { napraviDemoKlijent, ucitajScenario } from "../core/ekonet/index.js";
import { napraviDashboard, nivoSata, podeliVreme, tekstVremena } from "./dashboard-alati.js";
import type { ZavisnostiProcene } from "./procena.js";

const SADA = new Date("2026-11-23T10:30:00+01:00");

const sat = (iso: string, temperaturaC: number, prognoza: boolean, vremeKod = 3): RedVremenaIzBaze => ({
  uredjajId: "open-meteo-vreme-ns", vreme: iso, temperaturaC, vlaznostProc: 80, vetarKmh: 12, padavineMm: 0, vremeKod, prognoza,
});

const REDOVI_VREMENA = [
  sat("2026-11-23T09:00:00+01:00", 4.6, false),
  sat("2026-11-23T10:00:00+01:00", 5.3, false, 2),
  sat("2026-11-23T11:00:00+01:00", 5.8, true),
  sat("2026-11-23T12:00:00+01:00", 6.4, true, 61),
];

describe("dashboard: čiste funkcije", () => {
  it("nivo sata je gora od dve veličine; bez vrednosti null", () => {
    assert.equal(nivoSata({ vreme: "x", pm25: 5, pm10: 60 }), nivoSata({ vreme: "x", pm25: null, pm10: 60 }));
    assert.ok((nivoSata({ vreme: "x", pm25: 5, pm10: 60 }) ?? 0) > (nivoSata({ vreme: "x", pm25: 5, pm10: null }) ?? 0));
    assert.equal(nivoSata({ vreme: "x", pm25: null, pm10: null }), null);
  });

  it("vreme: trenutno je poslednji prošli sat, ostalo prognoza", () => {
    const v = podeliVreme(REDOVI_VREMENA, SADA);
    assert.equal(v.trenutno?.temperaturaC, 5.3);
    assert.equal(v.trenutno?.opis, "Delimično oblačno");
    assert.deepEqual(v.prognoza.map((p) => p.temperaturaC), [5.8, 6.4]);
    assert.equal(v.prognoza[1].opis, "Kiša");
    assert.equal(v.protekla24h.length, 2);
  });

  it("tekst za model sadrži brojeve iz baze i „nije dostupno“ umesto praznog", () => {
    const v = podeliVreme([{ ...REDOVI_VREMENA[1], vetarKmh: null }], SADA);
    const t = tekstVremena(v);
    assert.match(t, /5,3 °C/);
    assert.match(t, /vetar nije dostupno/);
    assert.equal(tekstVremena({ trenutno: null, prognoza: [], protekla24h: [] }), "Podaci o vremenu trenutno nisu dostupni.");
  });
});

describe("napraviDashboard", () => {
  async function zavisnosti(): Promise<ZavisnostiProcene> {
    const s = await ucitajScenario("s1-dobar");
    return {
      klijent: napraviDemoKlijent(s),
      sada: () => new Date(s.sada),
      napraviSavet: async () => {
        throw new Error("dashboard ne sme da zove LLM");
      },
      log: () => {},
    };
  }
  const bazaVV: BazaVazduhaIVremena = {
    uredjajiVazduha: async () => [],
    vazduh: async () => [],
    poslednjiVazduh: async () => null,
    vreme: async () => REDOVI_VREMENA,
  };
  const bazaVode = (uredjaji: Awaited<ReturnType<BazaVode["uredjaji"]>>): BazaVode => ({
    uredjaji: async () => uredjaji,
    poslednjeMerenje: async () => null,
    istorija: async () => [],
    pregled: async () => ({ brojMerenja: 0, od: null, do: null }),
    zatvori: async () => {},
  });

  it("vazduh sa kategorijom iz K2, senzor sa koordinatama, bez LLM-a", async () => {
    const d = await napraviDashboard(zavisnosti, async () => bazaVV, async () => bazaVode([]), SADA);
    assert.equal(d.vazduh?.status, "ok");
    assert.ok(d.vazduh?.category);
    assert.ok((d.vazduh?.istorija.length ?? 0) > 0);
    assert.equal(d.senzori.length, 1);
    assert.equal(typeof d.senzori[0].lat, "number");
    assert.equal(d.vreme?.trenutno?.temperaturaC, 5.3);
    assert.equal(d.voda, null);
    assert.deepEqual(d.greske, []);
  });

  it("kad baza ne radi, vreme i voda su null sa razlogom, a vazduh i dalje radi", async () => {
    const pukla = async (): Promise<never> => {
      throw new GreskaBaze("nedostupna", "Baza trenutno nije dostupna.");
    };
    const d = await napraviDashboard(zavisnosti, pukla, pukla, SADA);
    assert.equal(d.vreme, null);
    assert.equal(d.voda, null);
    assert.ok(d.vazduh);
    assert.deepEqual(d.greske, ["Vreme: Baza trenutno nije dostupna.", "Voda: Baza trenutno nije dostupna."]);
  });
});
