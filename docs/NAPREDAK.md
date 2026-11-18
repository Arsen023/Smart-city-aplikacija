# Napredak – Smart-city-aplikacija

Poslednje ažuriranje: 2026-11-18 (Luka)

## Zadaci

| ID | Zadatak | Vlasnik | Status | Grana | PR | Ažurirano |
|---|---|---|---|---|---|---|
| T01 | Pristup ekoNET API-ju (Mario, Nikola) | zajedno | U toku | — | — | 2026-11-17 |
| T02 | MCP Apps Quickstart | Sara | Gotovo | — | — | 2026-11-16 |
| T03 | A2UI Quickstart (proba verzije B) | Luka | Gotovo | `luka/a2ui-proba` | #4 | 2026-11-17 |
| T04 | Prezentacija (D1) | zajedno | U toku | — | — | 2026-11-16 |
| T05 | Stitch skica i tabela mapiranja | Luka | U toku | `luka/napredak-stitch` | #9 (prompt, tabela) | 2026-11-18 |
| T06 | K1 ekoNET klijent + fixtures | Sara | Gotovo | `sara/ekonet` | #7 | 2026-11-17 |
| T07 | K2 modul pravila + testovi | Luka | Gotovo | `luka/pravila` | #2 | 2026-11-17 |
| T08 | K3 LLM korak (Groq, gpt-oss-120b) | Luka | Gotovo | `luka/llm-savet` | #6 | 2026-11-17 |
| T09 | K4 MCP server, 4 alata | Sara | Gotovo | `sara/server` | #8 | 2026-11-17 |
| T10 | Verzija A, 7 elemenata | Sara | Nije početo | `sara/ui-a` | — | — |
| T11 | Grafikon 24 h u verziji A | Sara | Nije početo | `sara/ui-a` | — | — |
| T12 | A2UI poruke iz rezultata | Luka | Gotovo | `luka/ui-b` | #10 | 2026-11-18 |
| T13 | Verzija B + komponenta za grafikon | Luka | Gotovo | `luka/ui-b` | #10 | 2026-11-18 |
| T14 | Scenariji S1–S5 na obe verzije | zajedno | Nije početo | — | — | — |
| T15 | README | zajedno | Nije početo | — | — | — |
| T16 | Demo i pisana preporuka (D6) | zajedno | Nije početo | — | — | — |
| — | Zajednički tipovi `src/core/tipovi.ts` | Luka | Gotovo | `luka/tipovi` | #1 | 2026-11-17 |
| — | Demo scenariji S1–S6 u `fixtures/` | Luka | Gotovo | `luka/pravila` | #2 | 2026-11-17 |
| — | Podešavanje: CLAUDE.md, podela rada, skillovi | Sara | Gotovo | `sara/podesavanje` | #3 | 2026-11-17 |
| — | Skillovi za napredak i ekran A, NAPREDAK.md | Sara | Gotovo | `sara/napredak` | #5 | 2026-11-17 |
| — | CI (GitHub Actions: typecheck, test, build) | Sara | Nije početo | — | — | — |

## Sledeći koraci
1. Sara: T10/T11 ekran verzije A nad `Rezultat` iz `assess_air_quality` (7 elemenata + grafikon).
2. Luka: T05 – Stitch skica stanja bez preporuke i zaključak u `docs/stitch/procena.md`.
3. Zajedno: dogovor o kešu saveta u `src/server/procena.ts` (isti savet u A i B, FR-13; keš 5 min, NFR-03).
4. Zajedno: odgovor Maria/Nikole za ekoNET API (T01), pa pravi HTTP klijent u K1.
5. Sara: CI (GitHub Actions) kao mali poseban PR.

## Dnevnik
### 2026-11-18 – Luka – T12, T13, T05
- `src/server/a2ui.ts`: A2UI v0.9 poruke iz `Rezultat`-a (ne iz fixtures), deterministički; za `stale` / `no_data` / `error` poruka umesto kategorije i saveta. `assess_air_quality_a2ui` i `osvezi_a2ui` koriste isti `proceniKvalitet` kao verzija A (PR #10).
- `src/ui-b/`: naš katalog = osnovni v0.9 + `KategorijaBadge` (boja + naziv, kontrast ≥ 4,5:1) + `Grafikon24h` (sopstveni SVG); izbor stanice i „Osveži“. Provereno u basic-host za S1–S4.
- `server.ts`: jedna linija, `registrujA2ui(server, dobijZavisnosti)`. Ukupno 172 testa.
- T05: prompt za Stitch i tabela mapiranja (PR #9); analizirana prva Stitch skica (`docs/stitch/stitch-sa-podacima.png`).

### 2026-11-17 – Luka – T03, T08
- T03: proba verzije B – A2UI renderer (`@a2ui/lit` 0.15) u MCP App iframe-u, „Osveži“ preko `callServerTool` (PR #4).
- T08: `src/core/llm/` – prompt, provera izlaza (JSON, dužina, ista kategorija, samo brojevi iz ulaza, bez medicinskih saveta), Groq poziv sa timeout-om 4 s; 23 testa (PR #6).
- Probano sa pravim ključem: `llama-3.3-70b-versatile` nije dostupan; rade `openai/gpt-oss-120b` i `qwen/qwen3.8-27b`, ispod 1,4 s po pozivu.

### 2026-11-17 – Sara – T09
- `src/server/alati.ts`: alati `get_stations`, `get_latest`, `get_history`, `assess_air_quality` (Zod ulaz, `content` na srpskom za sve statuse, `structuredContent`) i resurs `ui://air/dashboard-a` sa CSP bez spoljnih domena.
- `src/server/procena.ts`: tok K1 → K2 → K3 (K3 samo za `ok`); greške postaju status `error`, bez izuzetka ka hostu.
- K1: `napraviIzvor(env)` vraća klijent, `sada` (u demo režimu vreme scenarija) i `llmGreska` (S5). `main.ts` učitava `.env` preko `process.loadEnvFile()`.
- Uklonjen Quickstart alat `get-time`. Testovi za S1–S5, s6 i sve alate preko `InMemoryTransport`. Plan: `docs/planovi/T09-server.md`.

### 2026-11-17 – Sara – T06
- `src/core/ekonet/`: demo klijent (`EkonetKlijent`) nad `fixtures/`, Zod šeme, normalizacija (sortiranje, odbacivanje nevažećih vrednosti), `GreskaEkonet`.
- `napraviKlijent()` bira izvor iz `EKONET_IZVOR` i `EKONET_SCENARIO`; `api` daje grešku dok se ne reši T01.
- Testovi za K1 i integracioni test K1 → K2 za s1–s6. Plan: `docs/planovi/T06-ekonet.md`.

### 2026-11-17 – Luka – tipovi i pravila
- `src/core/tipovi.ts`: zajednički tipovi i potpisi (`EkonetKlijent`, `ProceniFn`, `SatneVrednostiFn`, `NapraviSavetFn`).
- `src/core/pravila/`: EAQI kategorija, satne vrednosti, provera svežine, testovi (`node --test`).
- `fixtures/`: scenariji S1–S6 tipa `DemoScenario`.

### 2026-11-17 – Sara – podešavanje
- Repo prebačen na strukturu `src/core`, `src/server`, `src/ui-a`, `src/ui-b`, `fixtures`, `docs`.
- Dodati `CLAUDE.md`, `docs/PODELA-RADA.md` i skillovi za Claude Code.
- Uklonjeni zaostali `main.js` i `server.js` iz korena.

### 2026-11-16 – Sara, Luka – početak
- Urađen MCP Apps Quickstart, server radi u basic-host-u.
- Napravljena specifikacija i prva prezentacija.

## Odluke
| Datum | Odluka | Razlog | Ko |
|---|---|---|---|
| 2026-11-17 | Imena domena u kodu na srpskom (`tipovi`, `pravila`, `proceni`), MCP alati i ekoNET funkcije na engleskom | Usklađeno sa Lukinim `tipovi.ts` | zajedno |
| 2026-11-17 | Ne čekamo API: K1 radi nad `fixtures/` | Da T06 i T09 ne kasne | zajedno |
| 2026-11-17 | Jedna grana po zadatku, merge samo preko PR-a | `docs/PODELA-RADA.md` | zajedno |
| 2026-11-17 | Testovi preko `node --test` + tsx (bez Vitest-a) | Već postavljeno u `package.json`, bez dodatne zavisnosti | Luka |
| 2026-11-17 | K1 bira izvor preko `EKONET_IZVOR` (`demo` podrazumevano, `api` čeka T01) i `EKONET_SCENARIO` | Server ne zavisi od toga da li API postoji; demo uvek isto daje | Sara |
| 2026-11-17 | Svežinu proverava samo K2; K1 vraća i staro merenje | Jedno mesto za pravilo svežine | Sara |
| 2026-11-17 | `stationId` u `assess_air_quality` je opcion; bez njega se uzima prva stanica | Demo radi i kad model ne pozove `get_stations` | Sara |
| 2026-11-17 | `values` su sirova poslednja merenja iz `getLatest`, kategorija iz satnog proseka (K2) | Proverava se ponovo sa pravim API-jem (T01) | Sara |
| 2026-11-17 | Keš od 5 min (NFR-03) se za sada ne pravi | Čeka pravi API (T01) | Sara |
| 2026-11-17 | U demo režimu „sada“ je vreme scenarija, ne pravi sat | Demo uvek daje isti rezultat | Sara |
| 2026-11-17 | EAQI pragovi iz EEA tabele (2024); vrednost se zaokružuje na ceo broj pre poređenja | Tabela je u celim brojevima. Potvrditi sa mentorom | Luka |
| 2026-11-17 | Ako je jedna veličina zastarela, kategorija iz sveže uz napomenu; `stale` tek kad su obe stare | Ne gubi se preporuka zbog jedne veličine. Potvrditi sa mentorom | Luka |
| 2026-11-17 | LLM: Groq; podrazumevani model `openai/gpt-oss-120b`, menja se preko `GROQ_MODEL` (isproban i `qwen/qwen3.8-27b`) | `llama-3.3-70b-versatile` nije dostupan sa ključem; oba modela prošla proveru | Luka |
| 2026-11-17 | A2UI protokol v0.9 | Lit renderer `@a2ui/lit` 0.15 podržava v0.9, ne v1.0 | Luka |
| 2026-11-18 | Kategorija u boji i grafikon kao sopstvene komponente u našem A2UI katalogu | Osnovni katalog nema boju teksta ni grafikon (T05) | Luka |
| 2026-11-18 | Šeme sopstvenih A2UI komponenti preko `zod/v3` | A2UI interno koristi Zod 3; `zod/v3` je deo instaliranog Zod 4, bez novog paketa | Luka |

## Otvorena pitanja
- [ ] URL i autentifikacija ekoNET API-ja, ograničenje poziva?
- [ ] Koje stanice mere PM2.5 i PM10, koliko često?
- [ ] Prag svežine (predlog 2 h)?
- [ ] Kategorija iz satne vrednosti (EAQI 2024) ili 24-časovnog proseka?
- [x] ~~LLM za K3~~ – rešeno: Groq, model gpt-oss-120b (Luka, PR #6). Ključ ide u `.env`.
- [ ] Host za demo (basic-host, goose, Claude)?
- [x] ~~A2UI katalog v0.9 ili v1.0?~~ – rešeno: v0.9, jer je to verzija koju Lit renderer podržava (Luka, PR #4).
- [ ] Isti savet u A i B (FR-13): svaki poziv alata ponovo zove LLM, pa se tekst razlikuje. Predlog: keš saveta po stanici i vremenu merenja (uz NFR-03).
- [ ] EAQI boje u `src/ui-b/komponente/boje.ts` – potvrditi sa zvaničnom EEA legendom.
- [ ] Smernice za savet (spec 6.1) uskladiti sa EEA – EEA je blaža za „Umeren“.
- [x] ~~`npm start` ne učitava `.env`~~ – rešeno: `main.ts` poziva `process.loadEnvFile()`, bez novog paketa (Sara, T09).
- [x] ~~Kružna zavisnost u `napraviSavet`~~ – rešeno: ulaz je `Omit<Rezultat, "advice" | "history">` (Luka, `tipovi.ts`).
