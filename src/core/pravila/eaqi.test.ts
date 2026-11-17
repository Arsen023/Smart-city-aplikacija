import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import type { DemoScenario, Merenje, Velicina } from "../tipovi.js";
import { podindeks, proceni, satneVrednosti } from "./eaqi.js";
import { PODRAZUMEVANA_KONFIGURACIJA } from "./pragovi.js";

// Pragovi su ovde namerno prepisani ponovo iz EEA tabele, nezavisno od pragovi.ts,
// da bi test uhvatio grešku u kucanju konfiguracije.
// https://airindex.eea.europa.eu/AQI/index.html
const EEA: Record<Velicina, number[]> = {
  "PM2.5": [5, 15, 50, 90, 140],
  PM10: [15, 45, 120, 195, 270],
};

const SADA = new Date("2026-11-16T09:20:00+01:00");

function m(velicina: Velicina, vrednost: number, vreme: string): Merenje {
  return { stanicaId: "test", velicina, vrednost, jedinica: "µg/m³", vreme };
}

// ─── Granice kategorija ─────────────────────────────────────────────────────

describe("podindeks – granice iz EEA tabele", () => {
  for (const velicina of ["PM2.5", "PM10"] as const) {
    EEA[velicina].forEach((granica, i) => {
      const nivo = i + 1;
      test(`${velicina}: ${granica} je nivo ${nivo}, ${granica + 1} je nivo ${nivo + 1}`, () => {
        assert.equal(podindeks(velicina, granica), nivo);
        assert.equal(podindeks(velicina, granica + 1), nivo + 1);
      });
      test(`${velicina}: zaokruživanje oko ${granica} (${granica}.4 → ${nivo}, ${granica}.5 → ${nivo + 1})`, () => {
        assert.equal(podindeks(velicina, granica + 0.4), nivo);
        assert.equal(podindeks(velicina, granica + 0.5), nivo + 1);
      });
    });
    test(`${velicina}: 0 je Dobar, vrlo velika vrednost je Izuzetno loš`, () => {
      assert.equal(podindeks(velicina, 0), 1);
      assert.equal(podindeks(velicina, 10_000), 6);
    });
  }
});

// ─── Najlošiji podindeks ────────────────────────────────────────────────────

describe("ukupna kategorija", () => {
  test("određuje je najlošiji podindeks (PM10 lošiji)", () => {
    const r = proceni([m("PM2.5", 4, "2026-11-16T09:00:00+01:00"), m("PM10", 100, "2026-11-16T09:00:00+01:00")], SADA);
    assert.equal(r.status, "ok");
    assert.deepEqual(r.category, { naziv: "Umeren", nivo: 3, odredjujuca: "PM10" });
    assert.equal(r.napomena, null);
  });

  test("kod istog nivoa određujuća je PM2.5", () => {
    const r = proceni([m("PM2.5", 10, "2026-11-16T09:00:00+01:00"), m("PM10", 30, "2026-11-16T09:00:00+01:00")], SADA);
    assert.equal(r.category?.nivo, 2);
    assert.equal(r.category?.odredjujuca, "PM2.5");
  });

  test("pravilo je opisano za osnov saveta", () => {
    const r = proceni([m("PM2.5", 4, "2026-11-16T09:00:00+01:00")], SADA);
    assert.match(r.rule, /EAQI.*satne vrednosti.*najlošiji podindeks/);
  });
});

// ─── Svežina i nedostajući podaci ───────────────────────────────────────────

describe("svežina i nedostajući podaci (6.3)", () => {
  test("bez merenja → no_data", () => {
    const r = proceni([], SADA);
    assert.equal(r.status, "no_data");
    assert.equal(r.category, null);
    assert.equal(r.measuredAt, null);
    assert.ok(r.message);
  });

  test("nevalidne vrednosti (negativne, NaN, nepoznata veličina) se ignorišu", () => {
    const r = proceni(
      [
        m("PM2.5", -3, "2026-11-16T09:00:00+01:00"),
        m("PM10", Number.NaN, "2026-11-16T09:00:00+01:00"),
        { ...m("PM10", 5, "2026-11-16T09:00:00+01:00"), velicina: "NO2" as Velicina },
      ],
      SADA,
    );
    assert.equal(r.status, "no_data");
  });

  test("tačno na pragu od 2 h je još sveže", () => {
    const r = proceni([m("PM2.5", 4, "2026-11-16T07:20:00+01:00")], SADA);
    assert.equal(r.status, "ok");
  });

  test("minut posle praga od 2 h → stale, sa vremenom poslednjeg merenja", () => {
    const r = proceni([m("PM2.5", 4, "2026-11-16T07:19:00+01:00")], SADA);
    assert.equal(r.status, "stale");
    assert.equal(r.category, null);
    assert.equal(r.measuredAt, "2026-11-16T07:19:00+01:00");
    assert.equal(r.message, "Poslednje merenje je od 16.11. u 07:19. Ne dajemo preporuku.");
  });

  test("prag svežine je konfigurabilan", () => {
    const konf = { ...PODRAZUMEVANA_KONFIGURACIJA, pragSvezineMinuta: 300 };
    assert.equal(proceni([m("PM2.5", 4, "2026-11-16T05:00:00+01:00")], SADA, konf).status, "ok");
  });

  test("samo PM10 → kategorija iz PM10 uz napomenu", () => {
    const r = proceni([m("PM10", 50, "2026-11-16T09:00:00+01:00")], SADA);
    assert.equal(r.status, "ok");
    assert.equal(r.category?.odredjujuca, "PM10");
    assert.equal(r.category?.nivo, 3);
    assert.equal(r.napomena, "PM2.5 nije dostupno, kategorija je određena iz PM10.");
  });

  test("zastarela veličina se ne koristi, sveža određuje kategoriju uz napomenu", () => {
    const r = proceni(
      [m("PM2.5", 120, "2026-11-16T03:00:00+01:00"), m("PM10", 10, "2026-11-16T09:00:00+01:00")],
      SADA,
    );
    assert.equal(r.status, "ok");
    assert.equal(r.category?.nivo, 1);
    assert.match(r.napomena ?? "", /PM2.5 nije dostupno/);
  });
});

// ─── Satni prosek i period ──────────────────────────────────────────────────

describe("satni prosek (6.2)", () => {
  const konf15 = { ...PODRAZUMEVANA_KONFIGURACIJA, ocekivanihMerenjaPoSatu: 4 };

  test("merenja na 15 min se usrednjavaju u sat", () => {
    const r = proceni(
      [
        m("PM2.5", 4, "2026-11-16T09:00:00+01:00"),
        m("PM2.5", 6, "2026-11-16T09:15:00+01:00"),
        m("PM2.5", 20, "2026-11-16T09:30:00+01:00"),
        m("PM2.5", 30, "2026-11-16T09:45:00+01:00"),
      ],
      new Date("2026-11-16T09:50:00+01:00"),
      konf15,
    );
    // prosek 15 → nivo 2
    assert.equal(r.category?.nivo, 2);
  });

  test("3 od 4 merenja (75 %) je važeći sat", () => {
    const r = proceni(
      [m("PM2.5", 4, "2026-11-16T09:00:00+01:00"), m("PM2.5", 4, "2026-11-16T09:15:00+01:00"), m("PM2.5", 4, "2026-11-16T09:30:00+01:00")],
      SADA,
      konf15,
    );
    assert.equal(r.status, "ok");
  });

  test("2 od 4 merenja (50 %) nije važeći sat → no_data", () => {
    const r = proceni(
      [m("PM2.5", 4, "2026-11-16T09:00:00+01:00"), m("PM2.5", 4, "2026-11-16T09:15:00+01:00")],
      SADA,
      konf15,
    );
    assert.equal(r.status, "no_data");
  });

  test("period 24h daje prosek, a ne poslednju vrednost", () => {
    // 23 sata po 4 µg/m³ i poslednji sat 100 µg/m³ → satno je Loš, 24h prosek ~8 je Zadovoljavajući
    const merenja: Merenje[] = [];
    for (let h = 0; h < 24; h++) {
      const vreme = new Date(Date.parse("2026-11-15T10:00:00+01:00") + h * 3_600_000).toISOString();
      merenja.push(m("PM2.5", h === 23 ? 100 : 4, vreme));
    }
    assert.equal(proceni(merenja, SADA).category?.nivo, 5);
    const r24 = proceni(merenja, SADA, { ...PODRAZUMEVANA_KONFIGURACIJA, period: "24h" });
    assert.equal(r24.category?.nivo, 2);
    assert.match(r24.rule, /24-časovni prosek/);
  });

  test("satneVrednosti: sat bez PM2.5 ima null, ne 0", () => {
    const t = satneVrednosti([m("PM10", 12, "2026-11-16T09:00:00+01:00")]);
    assert.deepEqual(t, [{ vreme: "2026-11-16T09:00:00+01:00", pm25: null, pm10: 12 }]);
  });
});

// ─── Demo scenariji iz fixtures/ ────────────────────────────────────────────

describe("demo scenariji (fixtures)", () => {
  const dir = path.join(import.meta.dirname, "..", "..", "..", "fixtures");
  const ucitaj = (id: string): DemoScenario => JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), "utf8"));
  const pokreni = (id: string) => {
    const s = ucitaj(id);
    return proceni(s.merenja, new Date(s.sada));
  };

  test("S1 dobar vazduh → Dobar ili Zadovoljavajući", () => {
    const r = pokreni("s1-dobar");
    assert.equal(r.status, "ok");
    assert.ok(r.category && r.category.nivo <= 2);
  });

  test("S2 loš vazduh → Loš ili gore", () => {
    const r = pokreni("s2-los");
    assert.equal(r.status, "ok");
    assert.ok(r.category && r.category.nivo >= 4);
  });

  test("S3 zastareli podaci → stale", () => {
    const r = pokreni("s3-zastareo");
    assert.equal(r.status, "stale");
    assert.equal(r.category, null);
    assert.match(r.message ?? "", /16\.11\. u 05:00/);
  });

  test("S4 bez PM2.5 → kategorija iz PM10 uz napomenu", () => {
    const r = pokreni("s4-bez-pm25");
    assert.equal(r.status, "ok");
    assert.equal(r.category?.odredjujuca, "PM10");
    assert.ok(r.napomena);
  });

  test("S5 (LLM greška) – pravila i dalje daju kategoriju", () => {
    assert.equal(pokreni("s5-llm-greska").status, "ok");
  });

  test("S6 bez podataka → no_data", () => {
    assert.equal(pokreni("s6-bez-podataka").status, "no_data");
  });

  test("isti ulaz uvek daje isti rezultat (NFR-02)", () => {
    assert.deepEqual(pokreni("s2-los"), pokreni("s2-los"));
  });

  test("S1 grafikon ima 24 satne tačke", () => {
    assert.equal(satneVrednosti(ucitaj("s1-dobar").merenja).length, 24);
  });
});
