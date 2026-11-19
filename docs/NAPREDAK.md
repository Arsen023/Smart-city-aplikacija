# Napredak – Smart-city-aplikacija

Poslednje ažuriranje: 2026-11-18 (Sara)

## Zadaci

| ID | Zadatak | Vlasnik | Status | Grana | PR | Ažurirano |
|---|---|---|---|---|---|---|
| T01 | Pristup ekoNET API-ju (Mario, Nikola) | zajedno | U toku | — | — | 2026-11-17 |
| T02 | MCP Apps Quickstart | Sara | Gotovo | — | — | 2026-11-16 |
| T03 | A2UI Quickstart (proba verzije B) | Luka | Gotovo | `luka/a2ui-proba` | #4 | 2026-11-17 |
| T04 | Prezentacija (D1) | zajedno | U toku | — | — | 2026-11-16 |
| T05 | Stitch skica i tabela mapiranja | Luka | Gotovo | `luka/stitch-procena`, `luka/napredak-stitch` | #9, #13 | 2026-11-18 |
| T06 | K1 ekoNET klijent + fixtures | Sara | Gotovo | `sara/ekonet` | #7 | 2026-11-17 |
| T07 | K2 modul pravila + testovi | Luka | Gotovo | `luka/pravila` | #2 | 2026-11-17 |
| T08 | K3 LLM korak (Groq, gpt-oss-120b) | Luka | Gotovo | `luka/llm-savet` | #6 | 2026-11-17 |
| T09 | K4 MCP server, 4 alata | Sara | Gotovo | `sara/server` | #8 | 2026-11-17 |
| T10 | Verzija A, 7 elemenata | Sara | Gotovo | `sara/ui-a` | #12 | 2026-11-18 |
| T11 | Grafikon 24 h i „pre X min“ u verziji A | Sara | U pregledu | `sara/ui-a` | — | 2026-11-18 |
| T12 | A2UI poruke iz rezultata | Luka | Gotovo | `luka/ui-b` | #10 | 2026-11-18 |
| T13 | Verzija B + komponenta za grafikon, raspored po Stitch skici | Luka | Gotovo | `luka/ui-b`, `luka/ui-b-izgled` | #10, #16 | 2026-11-18 |
| T14 | Scenariji S1–S6 na obe verzije | zajedno | Nije početo | — | — | — |
| T15 | README | zajedno | Nije početo | — | — | — |
| T16 | Demo i pisana preporuka (D6) | zajedno | Nije početo | — | — | — |
| — | Zajednički tipovi `src/core/tipovi.ts` | Luka | Gotovo | `luka/tipovi` | #1 | 2026-11-17 |
| — | Demo scenariji S1–S6 u `fixtures/` | Luka | Gotovo | `luka/pravila` | #2 | 2026-11-17 |
| — | Podešavanje: CLAUDE.md, podela rada, skillovi | Sara | Gotovo | `sara/podesavanje` | #3 | 2026-11-17 |
| — | Skillovi za napredak i ekran A, NAPREDAK.md | Sara | Gotovo | `sara/napredak` | #5 | 2026-11-17 |
| — | Zajednički folder `src/zajednicko/` (EAQI boje, ID A2UI kataloga) | Luka | Gotovo | `luka/zajednicko` | #11 | 2026-11-18 |
| — | CI (GitHub Actions: typecheck, test, build) | Sara | Gotovo | `sara/ci` | #14 | 2026-11-18 |
| — | Chat aplikacija (sopstveni MCP host, prekidač A/B) za demo | Luka | Gotovo | `luka/chat` | #15 | 2026-11-18 |
| — | Snimci ekrana A za S1–S6 (`docs/snimci/`) | Sara | Nije početo | `sara/ui-a` | — | — |

## Sledeći koraci
1. Luka: pregled PR-a `sara/ui-a` (T11): `src/zajednicko/format.ts` i `geometrija.ts`, male izmene u `src/server/a2ui.ts` i `src/ui-b/komponente/grafikon.ts`, `_meta["smartcity/sada"]`, obrisan `src/ui-b/komponente/geometrija.ts`.
2. Sara: verzija A po Stitch skici, isti raspored kao B (NFR-01) – predložak `docs/stitch/stitch-sa-podacima.html` i `stitch-bez-preporuke.html`.
3. Sara: snimci S1–S6 za verziju A u `docs/snimci/` (uputstvo u `docs/snimci/README.md`).
4. Zajedno: potvrditi sa mentorom demo kroz našu chat aplikaciju (`npm run chat`).
5. Zajedno: keš saveta u `src/server/procena.ts` (isti savet u A i B, FR-13; keš 5 min, NFR-03).
6. Luka i Sara: T04 prezentacija – Stitch skice i zaključak T05, A2UI v0.9 i sopstvene komponente.
7. Zajedno: T14 (S1–S6 na obe verzije), T15 README, T16 demo i pisana preporuka (D6).
8. Zajedno: odgovor Maria/Nikole za ekoNET API (T01), pa pravi HTTP klijent u K1.

## Dnevnik
### 2026-11-18 – Sara – T11 i CI u pregled
- Ekran A sada ima svih 7 elemenata: grafikon 24 h (element 5) i „pre X min“ (element 3).
- `protekloVreme()` → `src/zajednicko/format.ts`, `geometrija.ts` + boje linija → `src/zajednicko/geometrija.ts`; A i B crtaju isto, bez kopije koda. Lukini fajlovi samo menjaju uvoz.
- Server šalje „sada“ u `_meta["smartcity/sada"]` rezultata `assess_air_quality`, bez izmene `Rezultat`-a. Plan: `docs/planovi/T11-grafikon-a.md`.
- `.github/workflows/ci.yml`: `npm ci`, typecheck, testovi, build A i B na Node 24 (grana `sara/ci`).
- 214 testova prolazi.

### 2026-11-18 – Luka – chat aplikacija (demo)
- `src/chat/`: sopstveni MCP host sa chatom. Groq bira alat (`get_stations`, `assess_air_quality` ili `assess_air_quality_a2ui`), ekran A ili B se prikazuje u razgovoru (AppBridge + sandbox na drugom originu), pa AI kratko odgovori.
- Prekidač „Verzija A · HTML / Verzija B · A2UI“ i oznaka na svakom ekranu, za prezentaciju. `?mcp=` bira MCP server (scenario), `?verzija=B`.
- Groq ključ samo na chat serveru; chat ne uvozi `src/core` ni `src/server` – sa serverom razgovara samo preko MCP-a. 13 testova.

### 2026-11-18 – Luka – T12, T13, T05
- `src/server/a2ui.ts`: A2UI v0.9 poruke iz `Rezultat`-a (ne iz fixtures), deterministički; za `stale` / `no_data` / `error` poruka umesto kategorije i saveta. `assess_air_quality_a2ui` i `osvezi_a2ui` koriste isti `proceniKvalitet` kao verzija A (PR #10).
- `src/ui-b/`: naš katalog = osnovni v0.9 + `KategorijaBadge` (boja + naziv, kontrast ≥ 4,5:1) + `Grafikon24h` (sopstveni SVG); izbor stanice i „Osveži“. Provereno u basic-host za S1–S4.
- `server.ts`: jedna linija, `registrujA2ui(server, dobijZavisnosti)`. Ukupno 172 testa.
- T05: prompt za Stitch i tabela mapiranja (PR #9). Tri skice u `docs/stitch/`: prva skica tima (bez ograničenja), konačne skice za S2 (sa podacima) i S3 (bez preporuke).
- T05 nalaz: bez ograničenja Stitch izmišlja skalu 0–100, pragove, izvore i medicinske savete; sa strogim promptom drži se teksta i brojeva, a izmišlja samo oblik grafikona i ukrase.
- T05 zaključak: Stitch kao vizuelni predložak, ne kao generator A2UI (A2UI pravi server deterministički, spec 8.3).
- T05 izvoz: AI Studio, Figma, MCP, Netlify, Lovable, Bolt – nijedan nije A2UI.

### 2026-11-18 – Sara – T10 u pregled
- `src/ui-a/`: ekran nad `Rezultat`-om, elementi 1, 2, 3 (samo vreme merenja), 4, 6, 7; stanja učitavanje, `ok`, `ok` bez saveta (S5), `stale`, `no_data`, `error`; tema hosta, safe area, „Osveži“, „Pokušaj ponovo“, izbor stanice iz `get_stations`, `updateModelContext`.
- `sema.ts` (Zod provera `structuredContent`), `prikaz.ts` (čista funkcija, bez DOM-a), `crtaj.ts` (samo `textContent`, bez `innerHTML`).
- `tekstVrednosti()` premeštena u `src/zajednicko/format.ts`; `src/server/procena.ts` je ponovo izvozi, ponašanje servera isto.
- typecheck, 196 testova i build A i B prolaze. Bez izmena u `src/core/tipovi.ts` i `package.json`.

### 2026-11-18 – Sara – pregled i T10
- Pregledani PR #10 (T12/T13) i #11 (`src/zajednicko/`): pravila zavisnosti poštovana, typecheck, 173 testa i build A i B prolaze.
- Sitne napomene za Luku: MIME `application/a2ui+json` upisan dvaput (`src/server/a2ui.ts`, `src/ui-b/app.ts`); A2UI poruke u ekranu B se parsiraju bez Zod provere; `TODO(EEA)` za boje; ekran B ima 1 MB (259 kB gzip).
- Ažurirana tabela: T05 (#9), T09 (#8), T12/T13 (#10), zajedničko (#11). Počinje T10 na `sara/ui-a`.

### 2026-11-17 – Sara – T09
- `src/server/alati.ts`: alati `get_stations`, `get_latest`, `get_history`, `assess_air_quality` (Zod ulaz, `content` na srpskom za sve statuse, `structuredContent`) i resurs `ui://air/dashboard-a` sa CSP bez spoljnih domena.
- `src/server/procena.ts`: tok K1 → K2 → K3 (K3 samo za `ok`); greške postaju status `error`, bez izuzetka ka hostu.
- K1: `napraviIzvor(env)` vraća klijent, `sada` (u demo režimu vreme scenarija) i `llmGreska` (S5). `main.ts` učitava `.env` preko `process.loadEnvFile()`.
- Uklonjen Quickstart alat `get-time`. Testovi za S1–S5, s6 i sve alate preko `InMemoryTransport`. Plan: `docs/planovi/T09-server.md`.

### 2026-11-17 – Luka – T03, T08
- T03: proba verzije B – A2UI renderer (`@a2ui/lit` 0.15) u MCP App iframe-u, „Osveži“ preko `callServerTool` (PR #4).
- T08: `src/core/llm/` – prompt, provera izlaza (JSON, dužina, ista kategorija, samo brojevi iz ulaza, bez medicinskih saveta), Groq poziv sa timeout-om 4 s; 23 testa (PR #6).
- Probano sa pravim ključem: `llama-3.3-70b-versatile` nije dostupan; rade `openai/gpt-oss-120b` i `qwen/qwen3.8-27b`, ispod 1,4 s po pozivu.

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
| 2026-11-18 | Demo kroz sopstvenu chat aplikaciju (`src/chat/`), ne kroz Claude/VS Code | Mentor očekuje aplikaciju sa chatom; ne zavisimo od tuđeg naloga. Odstupanje od spec (host je bio npr. Claude) – potvrditi sa mentorom | Luka |
| 2026-11-18 | Google Stitch koristimo kao vizuelni predložak, ne kao generator A2UI komponenti | A2UI pravi server deterministički iz `Rezultat`-a (spec 8.3); bez strogog prompta Stitch izmišlja sadržaj (T05) | Luka |
| 2026-11-18 | Šeme sopstvenih A2UI komponenti preko `zod/v3` | A2UI interno koristi Zod 3; `zod/v3` je deo instaliranog Zod 4, bez novog paketa | Luka |
| 2026-11-18 | `src/zajednicko/` za konstante i čiste funkcije koje dele A, B i server (boje EAQI, ID kataloga) | Isti izgled A i B (NFR-01); server ne uvozi iz `src/ui-*` | zajedno (PR #11) |
| 2026-11-18 | Prikazi smeju da uvoze `src/core/vreme.ts` (novi red u CLAUDE.md) | Format datuma `16.11.2026. 09:00` na jednom mestu; čiste funkcije bez I/O-a | Sara (PR #12) |
| 2026-11-18 | `tekstVrednosti()` u `src/zajednicko/format.ts` | Isti tekst vrednosti i „nije dostupno“ u serveru i ekranu A, bez kopije | Sara |
| 2026-11-18 | T10 ide bez „pre X min“ i grafikona (ostaju TODO) | Čeka se dogovor o premeštanju `protekloVreme()` i `geometrija.ts` u `src/zajednicko/` | Sara |
| 2026-11-18 | `protekloVreme()` i `geometrija.ts` (sa bojama linija) u `src/zajednicko/` | Isti tekst vremena i isti grafikon u A i B (NFR-01), bez kopije | Sara (čeka potvrdu Luke u PR-u) |
| 2026-11-18 | „sada“ servera ide ekranu A u `_meta["smartcity/sada"]`, ne u `Rezultat` | `Rezultat` se ne menja bez dogovora; u demo režimu „pre X min“ mora biti od vremena scenarija | Sara |

## Otvorena pitanja
- [ ] URL i autentifikacija ekoNET API-ja, ograničenje poziva?
- [ ] Koje stanice mere PM2.5 i PM10, koliko često?
- [ ] Prag svežine (predlog 2 h)?
- [ ] Kategorija iz satne vrednosti (EAQI 2024) ili 24-časovnog proseka?
- [x] ~~LLM za K3~~ – rešeno: Groq, model gpt-oss-120b (Luka, PR #6). Ključ ide u `.env`.
- [ ] Host za demo (basic-host, goose, Claude)?
- [x] ~~A2UI katalog v0.9 ili v1.0?~~ – rešeno: v0.9, jer je to verzija koju Lit renderer podržava (Luka, PR #4).
- [ ] Isti savet u A i B (FR-13): svaki poziv alata ponovo zove LLM, pa se tekst razlikuje. Predlog: keš saveta po stanici i vremenu merenja (uz NFR-03).
- [ ] Smernice za savet (spec 6.1) uskladiti sa EEA – EEA je blaža za „Umeren“.
- [ ] `protekloVreme()` i `geometrija.ts` premešteni u `src/zajednicko/` u PR-u `sara/ui-a` – Luka potvrđuje u pregledu.
- [x] ~~Novi red u CLAUDE.md: „Prikazi smeju da uvoze i `src/core/vreme.ts`“~~ – prihvaćeno sa PR-om #12.
- [ ] Boje EAQI kategorija: potvrditi kodove iz zvaničnog EEA izvora (`TODO(EEA)` u `src/zajednicko/boje-eaqi.ts`).
- [x] ~~`npm start` ne učitava `.env`~~ – rešeno: `main.ts` poziva `process.loadEnvFile()`, bez novog paketa (Sara, T09).
- [x] ~~Kružna zavisnost u `napraviSavet`~~ – rešeno: ulaz je `Omit<Rezultat, "advice" | "history">` (Luka, `tipovi.ts`).
