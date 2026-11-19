import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { napraviIzvor, type DemoScenarioId } from "../core/ekonet/index.js";
import type { NapraviSavetFn, Rezultat, Savet } from "../core/tipovi.js";
import { KATALOG_ID, KOMPONENTA_GRAFIKON, KOMPONENTA_KATEGORIJA } from "../zajednicko/a2ui-katalog.js";
import {
  AKCIJA_IZABERI,
  AKCIJA_OSVEZI,
  komponente,
  komponenteSaRasporedom,
  podaciEkrana,
  porukeAzuriranja,
  porukeEkrana,
  protekloVreme,
} from "./a2ui.js";
import { proveriRaspored } from "./a2ui-raspored.js";
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
    assert.deepEqual(akcija("osvezi").context, { izbor: { path: "/izbor" }, prikaz: { path: "/prikaz" } });
  });
});

describe("raspored po Stitch skici", () => {
  test("S2: zaglavlje, dve kartice PM jedna pored druge, značka, grafikon i savet u karticama", async () => {
    const { r, stanice, sada } = await rezultat("s2-los");
    const p = podaciEkrana(r, sada, OSVEZENO);
    const k = komponente(r, stanice, p) as K[];
    const po = (id: string) => k.find((x) => x.id === id);
    assert.equal(po("root")?.component, "Column");
    assert.deepEqual(po("vrednosti")?.children, ["kartica-pm25", "kartica-pm10"]);
    assert.equal(po("kartica-pm25")?.weight, 1);
    assert.equal(po("kartica-pm10")?.weight, 1);
    for (const id of ["zaglavlje", "grafikon-kartica", "savet-kartica"]) assert.equal(po(id)?.component, "Card");
    assert.deepEqual(po("kategorija-red")?.children, ["kategorija"]);
    assert.deepEqual(po("dno")?.children, ["osvezi"]);
    // redosled kao u skici
    const telo = po("root")?.children as string[];
    assert.ok(telo.indexOf("vrednosti") < telo.indexOf("kategorija-red"));
    assert.ok(telo.indexOf("kategorija-red") < telo.indexOf("grafikon-kartica"));
    assert.ok(telo.indexOf("grafikon-kartica") < telo.indexOf("savet-kartica"));
    assert.equal(telo.at(-2), "dno");
  });

  test("broj i jedinica posebno; S2 zarez kao decimalni separator", async () => {
    const { r, sada } = await rezultat("s2-los");
    const p = podaciEkrana(r, sada, OSVEZENO);
    assert.equal(p.pm25Broj, "82,9");
    assert.equal(p.pm25Jedinica, "µg/m³");
    assert.equal(p.pm10Broj, "149,3");
  });

  test("S4: kartica PM2.5 kaže „nije dostupno“, bez jedinice, nikad 0", async () => {
    const { r, sada } = await rezultat("s4-bez-pm25");
    const p = podaciEkrana(r, sada, OSVEZENO);
    assert.equal(p.pm25Broj, "nije dostupno");
    assert.equal(p.pm25Jedinica, "");
  });

  test("S3: kartica sa porukom umesto značke i kartice saveta", async () => {
    const { r, stanice, sada } = await rezultat("s3-zastareo");
    const telo = (komponente(r, stanice, podaciEkrana(r, sada, OSVEZENO)) as K[]).find((x) => x.id === "root")
      ?.children as string[];
    assert.ok(telo.includes("poruka-kartica"));
    assert.ok(!telo.includes("kategorija-red"));
    assert.ok(!telo.includes("savet-kartica"));
    assert.ok(telo.includes("grafikon-kartica"));
  });
});

describe("poruke", () => {
  test("prvo crtanje: createSurface sa našim katalogom, pa komponente i podaci", async () => {
    const { r, stanice, sada } = await rezultat("s1-dobar");
    const p = porukeEkrana(r, stanice, sada, { osvezeno: OSVEZENO }) as Array<Record<string, { catalogId?: string }>>;
    assert.equal(p.length, 3);
    assert.equal(p[0].createSurface.catalogId, KATALOG_ID);
    assert.ok("updateComponents" in p[1]);
    assert.ok("updateDataModel" in p[2]);
  });

  test("osvežavanje: bez createSurface", async () => {
    const { r, stanice, sada } = await rezultat("s1-dobar");
    const p = porukeAzuriranja(r, stanice, sada, { osvezeno: OSVEZENO });
    assert.equal(p.length, 2);
    assert.ok(!p.some((x) => "createSurface" in x));
  });

  test("isti Rezultat → iste poruke (deterministički, spec 8.3)", async () => {
    const { r, stanice, sada } = await rezultat("s2-los");
    assert.deepEqual(porukeEkrana(r, stanice, sada, { osvezeno: OSVEZENO }), porukeEkrana(r, stanice, sada, { osvezeno: OSVEZENO }));
  });

  test("u porukama nema brojeva koji nisu iz Rezultat-a za kategoriju", async () => {
    const { r, stanice, sada } = await rezultat("s1-dobar");
    const tekst = JSON.stringify(porukeEkrana(r, stanice, sada, { osvezeno: OSVEZENO }));
    assert.ok(tekst.includes(`"nivo":${(r as Rezultat).category?.nivo}`));
  });
});

// ─── AI raspored (verzija B po želji korisnika) ─────────────────────────────


function aiRaspored(opis: unknown) {
  const r = proveriRaspored(opis);
  if (!r.ok) throw new Error(r.razlog);
  return r;
}

const SAMO_SAVET = aiRaspored({
  koren: "k",
  komponente: [
    { id: "k", tip: "Kolona", deca: ["kat", "s"] },
    { id: "kat", tip: "Kategorija" },
    { id: "s", tip: "Tekst", podatak: "/savet" },
  ],
});

describe("AI raspored u porukama", () => {
  test("ok: AI raspored + Osveži; savet bez osnova dobija osnov (FR-11, FR-15)", async () => {
    const { r, stanice, sada } = await rezultat("s2-los");
    const p = porukeAzuriranja(r, stanice, sada, { osvezeno: OSVEZENO, prikaz: "kategorija i savet", raspored: SAMO_SAVET });
    const k = (p[0] as { updateComponents: { components: K[] } }).updateComponents.components;
    proveriReference(k);
    const root = k.find((x) => x.id === "root");
    assert.deepEqual(root?.children, ["ai-k", "ai-osnov-auto", "dno", "osvezeno-red"]);
    assert.ok(k.some((x) => x.id === "osvezi"));
    assert.ok(!k.some((x) => x.id === "grafikon-kartica"), "fiksni delovi koje AI nije izabrao ne idu");
    const podaci = (p[1] as { updateDataModel: { value: { prikaz: string } } }).updateDataModel.value;
    assert.equal(podaci.prikaz, "kategorija i savet");
  });

  test("stale: uvek fiksni ekran sa porukom, i kad postoji AI raspored (FR-09)", async () => {
    const { r, stanice, sada } = await rezultat("s3-zastareo");
    const p = porukeAzuriranja(r, stanice, sada, { osvezeno: OSVEZENO, prikaz: "samo savet", raspored: SAMO_SAVET });
    const ids = (p[0] as { updateComponents: { components: K[] } }).updateComponents.components.map((x) => x.id);
    assert.ok(ids.includes("poruka-kartica"));
    assert.ok(!ids.some((id) => id.startsWith("ai-")));
  });

  test("bez rasporeda: fiksni ekran kao i do sada", async () => {
    const { r, stanice, sada } = await rezultat("s1-dobar");
    const sa = porukeAzuriranja(r, stanice, sada, { osvezeno: OSVEZENO });
    const k = (sa[0] as { updateComponents: { components: K[] } }).updateComponents.components;
    assert.deepEqual(k, komponente(r, stanice, podaciEkrana(r, sada, OSVEZENO)));
  });

  test("savet sa osnovom: osnov se ne dodaje dvaput", async () => {
    const { r, stanice, sada } = await rezultat("s1-dobar");
    const sa = aiRaspored({
      koren: "k",
      komponente: [
        { id: "k", tip: "Kolona", deca: ["s", "o"] },
        { id: "s", tip: "Tekst", podatak: "/savet" },
        { id: "o", tip: "Tekst", podatak: "/osnov", stil: "caption" },
      ],
    });
    const k = komponenteSaRasporedom(komponente(r, stanice, podaciEkrana(r, sada, OSVEZENO)), sa) as K[];
    assert.ok(!k.some((x) => x.id === "ai-osnov-auto"));
  });
});
