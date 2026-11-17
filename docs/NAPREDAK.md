# Napredak – Smart-city-aplikacija

Poslednje ažuriranje: 2026-11-17 (Sara)

## Zadaci

| ID | Zadatak | Vlasnik | Status | Grana | PR | Ažurirano |
|---|---|---|---|---|---|---|
| T01 | Pristup ekoNET API-ju (Mario, Nikola) | zajedno | U toku | — | — | 2026-11-17 |
| T02 | MCP Apps Quickstart | Sara | Gotovo | — | — | 2026-11-16 |
| T03 | A2UI Quickstart | Luka | [proveriti sa Lukom] | — | — | — |
| T04 | Prezentacija (D1) | zajedno | U toku | — | — | 2026-11-16 |
| T05 | Stitch skica i tabela mapiranja | Luka | U toku | — | — | 2026-11-16 |
| T06 | K1 ekoNET klijent + fixtures | Sara | Gotovo | `sara/ekonet` | #7 | 2026-11-17 |
| T07 | K2 modul pravila + testovi | Luka | Gotovo | `luka/pravila` | #2 | 2026-11-17 |
| T08 | K3 LLM korak (Groq, gpt-oss-120b) | Luka | Gotovo | `luka/llm-savet` | #6 | 2026-11-17 |
| T09 | K4 MCP server, 4 alata | Sara | U pregledu | `sara/server` | — | 2026-11-17 |
| T10 | Verzija A, 7 elemenata | Sara | Nije početo | `sara/ui-a` | — | — |
| T11 | Grafikon 24 h u verziji A | Sara | Nije početo | `sara/ui-a` | — | — |
| T12 | A2UI poruke iz rezultata | Luka | Nije početo | — | — | — |
| T13 | Verzija B + komponenta za grafikon | Luka | Nije početo | — | — | — |
| T14 | Scenariji S1–S5 na obe verzije | zajedno | Nije početo | — | — | — |
| T15 | README | zajedno | Nije početo | — | — | — |
| T16 | Demo i pisana preporuka (D6) | zajedno | Nije početo | — | — | — |
| — | Zajednički tipovi `src/core/tipovi.ts` | Luka | Gotovo | `luka/tipovi` | #1 | 2026-11-17 |
| — | Demo scenariji S1–S6 u `fixtures/` | Luka | Gotovo | `luka/pravila` | #2 | 2026-11-17 |
| — | Podešavanje: CLAUDE.md, podela rada, skillovi | Sara | Gotovo | `sara/podesavanje` | #3 | 2026-11-17 |
| — | Skillovi za napredak i ekran A, NAPREDAK.md | Sara | U toku | `sara/napredak` | — | 2026-11-17 |
| — | CI (GitHub Actions: typecheck, test, build) | Sara | Nije početo | — | — | — |

## Sledeći koraci
1. Luka: pregled PR-a za T09 (`sara/server`), posebno `src/server/server.ts`.
2. Sara: T10 ekran verzije A nad `Rezultat` iz `assess_air_quality`.
3. Luka: T12 – A2UI poruke iz `Rezultat` koji vraća `proceniKvalitet()` (`src/server/procena.ts`).
4. Zajedno: odgovor Maria/Nikole za ekoNET API (T01), pa pravi HTTP klijent u K1.
5. Sara: CI (GitHub Actions) kao mali poseban PR.

## Dnevnik
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

## Otvorena pitanja
- [ ] URL i autentifikacija ekoNET API-ja, ograničenje poziva?
- [ ] Koje stanice mere PM2.5 i PM10, koliko često?
- [ ] Prag svežine (predlog 2 h)?
- [ ] Kategorija iz satne vrednosti (EAQI 2024) ili 24-časovnog proseka?
- [x] ~~LLM za K3~~ – rešeno: Groq, model gpt-oss-120b (Luka, PR #6). Ključ ide u `.env`.
- [ ] Host za demo (basic-host, goose, Claude)?
- [ ] A2UI katalog v0.9 ili v1.0?
- [x] ~~`npm start` ne učitava `.env`~~ – rešeno: `main.ts` poziva `process.loadEnvFile()`, bez novog paketa (Sara, T09).
- [x] ~~Kružna zavisnost u `napraviSavet`~~ – rešeno: ulaz je `Omit<Rezultat, "advice" | "history">` (Luka, `tipovi.ts`).
