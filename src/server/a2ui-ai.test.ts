import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { LlmPoziv } from "../core/llm/index.js";
import { napraviGeneratorRasporeda } from "./a2ui-ai.js";

const tiho = () => {};
const ISPRAVAN = JSON.stringify({
  koren: "k",
  komponente: [
    { id: "k", tip: "Kolona", deca: ["g"] },
    { id: "g", tip: "Grafikon" },
  ],
});

function lazni(odgovori: Array<string | Error>): LlmPoziv & { pozivi: number } {
  const fn = Object.assign(
    async () => {
      const o = odgovori[Math.min(fn.pozivi, odgovori.length - 1)];
      fn.pozivi++;
      if (o instanceof Error) throw o;
      return o;
    },
    { pozivi: 0 },
  );
  return fn;
}

describe("generator rasporeda", () => {
  test("ispravan odgovor LLM-a → A2UI raspored", async () => {
    const gen = napraviGeneratorRasporeda(lazni([ISPRAVAN]), tiho);
    const r = await gen("samo grafikon");
    assert.ok(r);
    assert.equal(r?.koren, "ai-k");
  });

  test("ista želja → keš, LLM se ne zove ponovo (Osveži zadržava izgled)", async () => {
    const llm = lazni([ISPRAVAN]);
    const gen = napraviGeneratorRasporeda(llm, tiho);
    await gen("Samo grafikon");
    await gen("  samo   GRAFIKON ");
    assert.equal(llm.pozivi, 1);
  });

  test("neispravan JSON → null", async () => {
    assert.equal(await napraviGeneratorRasporeda(lazni(["nije json"]), tiho)("x"), null);
  });

  test("raspored koji ne prođe proveru (broj u tekstu) → null, sa razlogom u logu", async () => {
    const logovi: string[] = [];
    const los = JSON.stringify({ koren: "t", komponente: [{ id: "t", tip: "Tekst", tekst: "PM2.5 je 99" }] });
    const r = await napraviGeneratorRasporeda(lazni([los]), (p) => logovi.push(p))("x");
    assert.equal(r, null);
    assert.match(logovi[0], /odbačen.*sadrži broj/);
  });

  test("LLM nedostupan → null; neuspeh se ne kešira", async () => {
    const llm = lazni([new Error("HTTP 503"), ISPRAVAN]);
    const gen = napraviGeneratorRasporeda(llm, tiho);
    assert.equal(await gen("x"), null);
    assert.ok(await gen("x"));
    assert.equal(llm.pozivi, 2);
  });
});
