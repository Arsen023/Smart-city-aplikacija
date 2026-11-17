import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { proceni } from "../pravila/index.js";
import type { DemoScenario, PoslednjaVrednost, Velicina } from "../tipovi.js";
import { napraviPrompt } from "./prompt.js";
import { brojeviIzTeksta, proveriSavet } from "./provera.js";
import { napraviSavet } from "./savet.js";
import type { LlmPoziv, SavetUlaz } from "./tipovi.js";

// ─── Pomoćno: ulaz iz demo scenarija (bez pravog API-ja i LLM-a) ────────────

const FIXTURES = path.join(import.meta.dirname, "..", "..", "..", "fixtures");

function ulazIz(id: string): SavetUlaz {
  const s: DemoScenario = JSON.parse(fs.readFileSync(path.join(FIXTURES, `${id}.json`), "utf8"));
  const p = proceni(s.merenja, new Date(s.sada));
  const vrednost = (v: Velicina): PoslednjaVrednost => {
    const m = s.merenja.filter((x) => x.velicina === v).at(-1);
    return { velicina: v, vrednost: m ? m.vrednost : null, jedinica: "µg/m³" };
  };
  return {
    status: p.status,
    station: { id: s.stanica.id, naziv: s.stanica.naziv },
    measuredAt: p.measuredAt,
    values: [vrednost("PM2.5"), vrednost("PM10")],
    category: p.category,
    rule: p.rule,
    message: p.message,
    napomena: p.napomena,
  };
}

const tiho = () => {};
const lazniLlm =
  (odgovor: unknown): LlmPoziv =>
  async () =>
    typeof odgovor === "string" ? odgovor : JSON.stringify(odgovor);

// S1: PM2.5 3.7, PM10 6.7, 16.11.2026. 09:00, Dobar
const DOBAR_SAVET = {
  savet: "Vazduh je Dobar, slobodno idite na šetnju ili trening napolju.",
  osnov: "Liman, Novi Sad (demo), 16.11.2026. 09:00: PM2.5 3.7 µg/m³, PM10 6.7 µg/m³, kategorija Dobar po EAQI.",
};

// ─── Prompt ─────────────────────────────────────────────────────────────────

describe("prompt", () => {
  test("sadrži stanicu, vreme, vrednosti, kategoriju i pravilo", () => {
    const { korisnik } = napraviPrompt(ulazIz("s1-dobar"));
    assert.match(korisnik, /Liman, Novi Sad/);
    assert.match(korisnik, /16\.11\.2026\. 09:00/);
    assert.match(korisnik, /PM2\.5: 3\.7 µg\/m³/);
    assert.match(korisnik, /Kategorija: Dobar/);
    assert.match(korisnik, /EAQI/);
  });

  test("veličina koja nedostaje je „nije dostupno“, ne 0", () => {
    const { korisnik } = napraviPrompt(ulazIz("s4-bez-pm25"));
    assert.match(korisnik, /PM2\.5: nije dostupno/);
    assert.match(korisnik, /Napomena:/);
  });

  test("ne sadrži sirovu istoriju (samo poslednje vrednosti)", () => {
    const { korisnik } = napraviPrompt(ulazIz("s2-los"));
    assert.ok(korisnik.split("\n").length <= 8);
  });
});

// ─── Provera izlaza ─────────────────────────────────────────────────────────

describe("provera izlaza (6.4)", () => {
  const ulaz = ulazIz("s1-dobar");
  const { korisnik } = napraviPrompt(ulaz);
  const proveri = (o: unknown) => proveriSavet(typeof o === "string" ? o : JSON.stringify(o), "Dobar", korisnik);

  test("ispravan savet prolazi", () => {
    const r = proveri(DOBAR_SAVET);
    assert.equal(r.ok, true);
  });

  test("neispravan JSON se odbacuje", () => {
    assert.deepEqual(proveri("Vazduh je dobar!"), { ok: false, razlog: "odgovor nije ispravan JSON" });
  });

  test("nedostaje polje osnov", () => {
    assert.equal(proveri({ savet: "Vazduh je Dobar." }).ok, false);
  });

  test("izmišljen broj se odbacuje", () => {
    const r = proveri({ ...DOBAR_SAVET, savet: "Vazduh je Dobar, trčite do 18 h." });
    assert.equal(r.ok, false);
    assert.match(r.ok ? "" : r.razlog, /izmišljeni brojevi: 18/);
  });

  test("brojevi iz ulaza su dozvoljeni, i sa zarezom", () => {
    const r = proveri({ ...DOBAR_SAVET, osnov: "PM2.5 je 3,7 µg/m³ u 09:00, kategorija Dobar." });
    assert.equal(r.ok, true);
  });

  test("druga kategorija se odbacuje", () => {
    const r = proveri({ ...DOBAR_SAVET, savet: "Vazduh je Umeren, smanjite trening." });
    assert.equal(r.ok, false);
  });

  test("savet koji ne pominje kategoriju se odbacuje", () => {
    const r = proveri({ savet: "Slobodno idite napolje.", osnov: "Merenje sa stanice Liman." });
    assert.equal(r.ok, false);
  });

  test("„Veoma loš“ nije isto što i „Loš“", () => {
    const s2 = napraviPrompt(ulazIz("s2-los")).korisnik;
    const r = proveriSavet(
      JSON.stringify({ savet: "Vazduh je Veoma loš, trening premestite unutra.", osnov: "Kategorija Loš." }),
      "Loš",
      s2,
    );
    assert.equal(r.ok, false);
  });

  test("„umereno“ se ne računa kao kategorija „Umeren“", () => {
    const r = proveri({ ...DOBAR_SAVET, savet: "Vazduh je Dobar, trenirajte umereno ili jače." });
    assert.equal(r.ok, true);
  });

  test("više od 2 rečenice se odbacuje", () => {
    const r = proveri({ ...DOBAR_SAVET, savet: "Vazduh je Dobar. Idite napolje. Uživajte." });
    assert.equal(r.ok, false);
  });

  test("predugačak savet se odbacuje", () => {
    const r = proveri({ ...DOBAR_SAVET, savet: `Vazduh je Dobar, ${"a".repeat(400)}.` });
    assert.equal(r.ok, false);
  });

  test("medicinski savet se odbacuje", () => {
    const r = proveri({ ...DOBAR_SAVET, savet: "Vazduh je Dobar, ali osobe sa astmom neka ponesu inhalator." });
    assert.equal(r.ok, false);
    assert.match(r.ok ? "" : r.razlog, /medicinski/);
  });

  test("brojeviIzTeksta normalizuje vodeće nule i zarez", () => {
    assert.deepEqual([...brojeviIzTeksta("09:00, 3,7 i 12.40")].sort(), ["0", "12.4", "3.7", "9"]);
  });
});

// ─── napraviSavet ───────────────────────────────────────────────────────────

describe("napraviSavet", () => {
  test("S1: ispravan LLM odgovor → savet", async () => {
    const r = await napraviSavet(ulazIz("s1-dobar"), { llm: lazniLlm(DOBAR_SAVET), log: tiho });
    assert.deepEqual(r, DOBAR_SAVET);
  });

  test("S3 stale: LLM se ne poziva, nema saveta (FR-09)", async () => {
    let pozvan = false;
    const llm: LlmPoziv = async () => {
      pozvan = true;
      return "{}";
    };
    assert.equal(await napraviSavet(ulazIz("s3-zastareo"), { llm, log: tiho }), null);
    assert.equal(pozvan, false);
  });

  test("S6 no_data: LLM se ne poziva", async () => {
    let pozvan = false;
    const llm: LlmPoziv = async () => {
      pozvan = true;
      return "{}";
    };
    assert.equal(await napraviSavet(ulazIz("s6-bez-podataka"), { llm, log: tiho }), null);
    assert.equal(pozvan, false);
  });

  test("S5 LLM nedostupan → null, bez rušenja (FR-12)", async () => {
    const llm: LlmPoziv = async () => {
      throw new Error("Groq je vratio HTTP 503");
    };
    const logovi: string[] = [];
    assert.equal(await napraviSavet(ulazIz("s5-llm-greska"), { llm, log: (p) => logovi.push(p) }), null);
    assert.match(logovi[0], /greška.*503/);
  });

  test("timeout LLM-a → null", async () => {
    const llm: LlmPoziv = () =>
      new Promise((_, odbij) => setTimeout(() => odbij(new Error("The operation was aborted due to timeout")), 10));
    assert.equal(await napraviSavet(ulazIz("s1-dobar"), { llm, log: tiho }), null);
  });

  test("LLM promeni kategoriju → savet se ne prikazuje", async () => {
    const llm = lazniLlm({ savet: "Vazduh je Loš, ostanite unutra.", osnov: "Kategorija Loš." });
    assert.equal(await napraviSavet(ulazIz("s1-dobar"), { llm, log: tiho }), null);
  });

  test("log ne sadrži ključ ni sadržaj prompta", async () => {
    const logovi: string[] = [];
    await napraviSavet(ulazIz("s1-dobar"), { llm: lazniLlm(DOBAR_SAVET), log: (p) => logovi.push(p) });
    assert.equal(logovi.length, 1);
    assert.doesNotMatch(logovi[0], /Liman|GROQ|Bearer/);
  });
});
