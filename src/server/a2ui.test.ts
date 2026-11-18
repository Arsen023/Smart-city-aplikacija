import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { napraviIzvor, type DemoScenarioId } from "../core/ekonet/index.js";
import type { NapraviSavetFn, Rezultat, Savet } from "../core/tipovi.js";
import { KATALOG_ID, KOMPONENTA_GRAFIKON, KOMPONENTA_KATEGORIJA } from "../zajednicko/a2ui-katalog.js";
import {
  AKCIJA_IZABERI,
  AKCIJA_OSVEZI,
  komponente,
  podaciEkrana,
  porukeAzuriranja,
  porukeEkrana,
  protekloVreme,
} from "./a2ui.js";
import { PORUKA_BEZ_SAVETA, proceniKvalitet, rezultatGreske } from "./procena.js";

const tiho = () => {};
const SAVET: Savet = { savet: "Vazduh je Dobar, slobodno napolje.", osnov: "Liman, PM2.5 3.7 µg/m³, Dobar." };
const OSVEZENO = new Date("2026-11-16T09:20:05+01:00");

/** Rezultat iz Sarinog toka (K1 → K2 → K3) nad demo scenarijem, sa lažnim savetom. */
async function rezultat(scenario: DemoScenarioId, savet: Savet | null = SAVET) {
  const izvor = await napraviIzvor({ EKONET_SCENARIO: scenario });
  const napraviSavet: NapraviSavetFn = async () => savet;
  const r = await proceniKvalitet({ klijent: izvor.klijent, sada: izvor.sada, napraviSavet, log: tiho });
  const stanice = await izvor.klijent.getStations();
  return { r, stanice, sada: izvor.sada() };
}

type K = { id: string; component: string } & Record<string, unknown>;
const ids = (k: K[]) => k.map((x) => x.id);

/** Svaki child/children upućuje na komponentu koja postoji, i postoji "root". */
function proveriReference(k: K[]) {
  const postoje = new Set(ids(k));
  assert.ok(postoje.has("root"), "nema root");
  for (const x of k) {
    const deca = [
      ...(typeof x.child === "string" ? [x.child] : []),
      ...(Array.isArray(x.children) ? (x.children as string[]) : []),
    ];
    for (const d of deca) assert.ok(postoje.has(d), `${x.id} upućuje na nepostojeće "${d}"`);
  }
  assert.equal(new Set(ids(k)).size, k.length, "dupli id");
}

describe("protekloVreme", () => {
  const m = "2026-11-16T09:00:00+01:00";
  test("minuti, sati, dani", () => {
    assert.equal(protekloVreme(m, new Date("2026-11-16T09:00:30+01:00")), "upravo");
    assert.equal(protekloVreme(m, new Date("2026-11-16T09:20:00+01:00")), "pre 20 min");
    assert.equal(protekloVreme(m, new Date("2026-11-16T13:05:00+01:00")), "pre 4 h");
    assert.equal(protekloVreme(m, new Date("2026-11-17T10:00:00+01:00")), "pre 1 dan");
    assert.equal(protekloVreme(m, new Date("2026-11-19T10:00:00+01:00")), "pre 3 dana");
  });
});

describe("podaciEkrana iz Rezultat-a", () => {
  test("S1 ok: kategorija, savet, osnov, vreme sa „pre X min“, 24 h istorije", async () => {
    const { r, sada } = await rezultat("s1-dobar");
    const p = podaciEkrana(r, sada, OSVEZENO);
    assert.deepEqual(p.izbor, ["demo-liman"]);
    assert.equal(p.kategorija?.naziv, r.category?.naziv);
    assert.equal(p.kategorija?.nivo, r.category?.nivo);
    assert.equal(p.savet, SAVET.savet); // isti savet kao verzija A (FR-13)
    assert.equal(p.osnov, `Osnov: ${SAVET.osnov}`);
    assert.equal(p.poruka, "");
    assert.match(p.vreme, /^Merenje: 16\.11\.2026\. 09:00 · pre 20 min$/);
    assert.match(p.pm25, /^PM2\.5 3,7 µg\/m³$/);
    assert.equal(p.istorija.length, 24);
    assert.equal(p.osvezeno, "Osveženo u 09:20:05");
  });

  test("S3 stale: bez kategorije i saveta, poruka sa vremenom (pravilo 2)", async () => {
    const { r, sada } = await rezultat("s3-zastareo");
    const p = podaciEkrana(r, sada, OSVEZENO);
    assert.equal(p.kategorija, null);
    assert.equal(p.savet, "");
    assert.equal(p.osnov, "");
    assert.match(p.poruka, /Poslednje merenje je od 16\.11\. u 05:00/);
  });

  test("S4 bez PM2.5: „nije dostupno“, nikad 0 (pravilo 5), napomena", async () => {
    const { r, sada } = await rezultat("s4-bez-pm25");
    const p = podaciEkrana(r, sada, OSVEZENO);
    assert.equal(p.pm25, "PM2.5 nije dostupno");
    assert.doesNotMatch(p.pm25, /\b0\b/);
    assert.ok(p.napomena.length > 0);
    assert.ok(p.kategorija);
  });

  test("S5 LLM nedostupan: kategorija da, savet ne, poruka zašto (FR-12)", async () => {
    const { r, sada } = await rezultat("s5-llm-greska", null);
    const p = podaciEkrana(r, sada, OSVEZENO);
    assert.ok(p.kategorija);
    assert.equal(p.savet, "");
    assert.equal(p.poruka, PORUKA_BEZ_SAVETA);
  });

  test("S6 no_data: bez kategorije, poruka, obe vrednosti „nije dostupno“", async () => {
    const { r, sada } = await rezultat("s6-bez-podataka");
    const p = podaciEkrana(r, sada, OSVEZENO);
    assert.equal(p.kategorija, null);
    assert.equal(p.pm10, "PM10 nije dostupno");
    assert.ok(p.poruka.length > 0);
    assert.equal(p.vreme, "Merenje: nema podataka");
  });

  test("error: poruka greške, bez kategorije", () => {
    const r = rezultatGreske({ id: "x", naziv: "X" }, "Podaci trenutno nisu dostupni.");
    const p = podaciEkrana(r, OSVEZENO, OSVEZENO);
    assert.equal(p.kategorija, null);
    assert.equal(p.poruka, "Podaci trenutno nisu dostupni.");
  });
});

describe("komponente po statusu", () => {
  for (const s of ["s1-dobar", "s2-los", "s3-zastareo", "s4-bez-pm25", "s5-llm-greska", "s6-bez-podataka"] as const) {
    test(`${s}: sve reference postoje`, async () => {
      const { r, stanice, sada } = await rezultat(s, s === "s5-llm-greska" ? null : SAVET);
      proveriReference(komponente(r, stanice, podaciEkrana(r, sada, OSVEZENO)) as K[]);
    });
  }

  test("ok: ima kategoriju, grafikon, savet i osnov; nema poruke", async () => {
    const { r, stanice, sada } = await rezultat("s2-los");
    const k = komponente(r, stanice, podaciEkrana(r, sada, OSVEZENO)) as K[];
    assert.ok(ids(k).includes("kategorija"));
    assert.equal(k.find((x) => x.id === "kategorija")?.component, KOMPONENTA_KATEGORIJA);
    assert.equal(k.find((x) => x.id === "grafikon")?.component, KOMPONENTA_GRAFIKON);
    assert.ok(ids(k).includes("savet") && ids(k).includes("osnov"));
    assert.ok(!ids(k).includes("poruka"));
  });

  test("stale: poruka umesto kategorije i saveta (spec 8.1)", async () => {
    const { r, stanice, sada } = await rezultat("s3-zastareo");
    const k = ids(komponente(r, stanice, podaciEkrana(r, sada, OSVEZENO)) as K[]);
    assert.ok(k.includes("poruka"));
    assert.ok(!k.includes("kategorija"));
    assert.ok(!k.includes("savet"));
  });

  test("izbor stanice nudi stanice iz K1, akcije šalju izabranu stanicu", async () => {
    const { r, stanice, sada } = await rezultat("s1-dobar");
    const k = komponente(r, stanice, podaciEkrana(r, sada, OSVEZENO)) as K[];
    const izbor = k.find((x) => x.id === "izbor");
    assert.deepEqual(izbor?.options, [{ label: "Liman, Novi Sad (demo)", value: "demo-liman" }]);
    const akcija = (id: string) => (k.find((x) => x.id === id)?.action as { event: { name: string; context: unknown } }).event;
    assert.equal(akcija("prikazi").name, AKCIJA_IZABERI);
    assert.equal(akcija("osvezi").name, AKCIJA_OSVEZI);
    assert.deepEqual(akcija("osvezi").context, { izbor: { path: "/izbor" } });
  });
});

describe("poruke", () => {
  test("prvo crtanje: createSurface sa našim katalogom, pa komponente i podaci", async () => {
    const { r, stanice, sada } = await rezultat("s1-dobar");
    const p = porukeEkrana(r, stanice, sada, OSVEZENO) as Array<Record<string, { catalogId?: string }>>;
    assert.equal(p.length, 3);
    assert.equal(p[0].createSurface.catalogId, KATALOG_ID);
    assert.ok("updateComponents" in p[1]);
    assert.ok("updateDataModel" in p[2]);
  });

  test("osvežavanje: bez createSurface", async () => {
    const { r, stanice, sada } = await rezultat("s1-dobar");
    const p = porukeAzuriranja(r, stanice, sada, OSVEZENO);
    assert.equal(p.length, 2);
    assert.ok(!p.some((x) => "createSurface" in x));
  });

  test("isti Rezultat → iste poruke (deterministički, spec 8.3)", async () => {
    const { r, stanice, sada } = await rezultat("s2-los");
    assert.deepEqual(porukeEkrana(r, stanice, sada, OSVEZENO), porukeEkrana(r, stanice, sada, OSVEZENO));
  });

  test("u porukama nema brojeva koji nisu iz Rezultat-a za kategoriju", async () => {
    const { r, stanice, sada } = await rezultat("s1-dobar");
    const tekst = JSON.stringify(porukeEkrana(r, stanice, sada, OSVEZENO));
    assert.ok(tekst.includes(`"nivo":${(r as Rezultat).category?.nivo}`));
  });
});
