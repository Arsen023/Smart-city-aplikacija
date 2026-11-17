# T09 – K4 MCP server, 4 alata (plan)

- **Vlasnik:** Sara
- **Grana:** `sara/server` (od `main` @ `f4e66f0`)
- **Zavisi od:** T06 (K1), T07 (K2), T08 (K3). Sva tri su u `main`-u.
- **Status plana:** odobren 2026-11-17, uz izmene (vidi „Izmene posle pregleda“)
- **Datum:** 2026-11-17

## Polazno stanje

- `src/server/server.ts` još ima primer alat `get-time` iz Quickstart-a i resurs `ui://get-time/mcp-app.html`.
- `src/server/a2ui-alati.ts` (Luka, T03 proba) registruje `assess_air_quality_a2ui` i `osvezi_a2ui`. Server ga poziva preko `registrujA2uiProbu(server)`.
- `src/ui-a/app.ts` na dugme poziva `get-time`.
- K1 ima `napraviKlijent(env)`, K2 ima `proceni(merenja, sada)` i `satneVrednosti(merenja)`, a K3 ima `napraviSavet(ulaz, { llm })`.

## Koje je vreme „sada“

`proceni()` dobija `sada` kao parametar. U demo režimu to mora biti `scenario.sada`, ne pravi sat, da bi demo uvek davao isto. Scenario S5 (`llmGreska: true`) traži da LLM poziv ne uspe.

Zato se u K1 dodaje `napraviIzvor(env)`, koja vraća `{ klijent, sada: () => Date, llmGreska: boolean }`:

- za `demo`: `sada` = `scenario.sada`, a `llmGreska` se uzima iz scenarija
- za `api`: `sada` = `new Date()`, `llmGreska` = `false` (i dalje baca grešku dok ne stigne T01)

Interfejs `EkonetKlijent` i `napraviKlijent()` ostaju isti.

## Fajlovi

| Fajl | Odgovornost |
|---|---|
| `src/core/ekonet/index.ts` (+ `index.test.ts`) | `napraviIzvor(env)`, opisano gore. |
| `src/server/procena.ts` (novo) | `proceniKvalitet(zavisnosti, stationId?) → Promise<Rezultat>`. Zavisnosti (klijent, `sada`, `napraviSavet`) se prosleđuju spolja, pa se funkcija testira bez MCP-a. Bez pravila i pragova, samo poziva K1–K3. |
| `src/server/alati.ts` (novo) | `registrujAlate(server, zavisnosti)`: 4 alata i resurs `ui://air/dashboard-a`. |
| `src/server/server.ts` ⚠ zajednički | Uklanja se `get-time` i njegov resurs, dodaje se `registrujAlate(server)`. `registrujA2uiProbu` ostaje kako jeste. |
| `main.ts` | Na vrhu učitava `.env` preko `process.loadEnvFile()` u `try/catch`. Bez `.env` važe podrazumevane vrednosti. Bez novih paketa. |
| `src/ui-a/app.ts` (jedna linija) | Dugme poziva `assess_air_quality` umesto `get-time`, da ekran ne pukne dok ne stigne T10. |

### Tok `proceniKvalitet`

1. Ako `stationId` nije zadat, uzima se prva stanica iz `getStations()`.
2. K1: `getLatest(id)` i `getHistory(id, 24)`.
3. K2: `proceni(history, sada())` i `satneVrednosti(history)`.
4. `values`: za PM2.5 i PM10 poslednja vrednost iz `getLatest`, a `null` ako je nema (pravilo 5).
5. K3 se zove **samo** kad je status `ok`. Za S5 se prosleđuje `llm` koji baca grešku.
6. Kad je status `ok` a savet je `null`: `message` = „Savet trenutno nije dostupan. Prikazana su merenja i kategorija.“
7. `GreskaEkonet` i svaka druga greška daju `status: "error"`, a `category`, `advice` i `measuredAt` su `null`. `message` je jasna poruka na srpskom. Izuzetak nikad ne ide ka hostu (NFR-05).

### Alati (`alati.ts`)

| Alat | Ulaz (Zod) | `structuredContent` | Ekran |
|---|---|---|---|
| `get_stations` | — | `{ stanice: Stanica[] }` | — |
| `get_latest` | `stationId: string` | `{ stationId, merenja: Merenje[] }` | — |
| `get_history` | `stationId: string`, `hours` ceo broj 1–168, podrazumevano 24 | `{ stationId, hours, merenja: Merenje[] }` (sirova merenja) | — |
| `assess_air_quality` | `stationId?: string` | `Rezultat` | `ui://air/dashboard-a` |

- Opis alata je na engleskom, a `content` postoji za **sve statuse** (`ok`, `stale`, `no_data`, `error`) kao kratak tekst na srpskom za model i za hostove bez MCP Apps, npr. „Liman, Novi Sad (demo): PM2.5 12,4 µg/m³, PM10 21,8 µg/m³ u 16.11.2026. 09:00. Kategorija: Zadovoljavajući.“ Za `stale`, `no_data` i `error` tekst nosi `message` (npr. vreme poslednjeg merenja ili razlog greške).
- Greška u `get_*` alatima se vraća kao `isError: true` sa porukom, bez izuzetka.
- Resurs `ui://air/dashboard-a` vraća `dist/ui-a/index.html`. CSP je bez spoljnih domena.
- Ključevi se nikad ne pojavljuju u `content` ni `structuredContent`.

## Testovi (`node --test`, fixtures i lažni LLM, bez mreže)

- **`src/server/procena.test.ts`**
  - S1: `ok`, ima kategoriju i savet.
  - S2: `ok`, lošija kategorija.
  - S3: `stale`, `category` i `advice` su `null`, LLM se **ne poziva**, `message` sadrži vreme poslednjeg merenja.
  - S4: PM2.5 je `null` (ne 0) i postoji `napomena`.
  - S5: `ok`, kategorija postoji, `advice` je `null` i postoji poruka.
  - s6: `no_data`, LLM se ne poziva.
  - Nepoznata stanica daje `error`, bez izuzetka.
  - LLM koji vrati neispravan JSON daje `advice: null`.
- **`src/server/alati.test.ts`**
  - Pravi `McpServer` i klijent preko `InMemoryTransport`, poziva sva 4 alata i proverava `content` i `structuredContent`.
  - `assess_air_quality` ima `_meta.ui.resourceUri` = `ui://air/dashboard-a`.
  - Neispravan ulaz (npr. `hours: 0`) se odbija.
  - `content` tekst postoji i na srpskom je za `ok`, `stale`, `no_data` i `error`.
- **`src/core/ekonet/index.test.ts`**
  - `napraviIzvor` vraća `sada` iz scenarija i `llmGreska` za s5.

## Zajednički fajlovi i tuđi kod

- Menja se `src/server/server.ts`. **Javiti Luki pre početka**, jer i njegov T12 ide u `src/server/`.
- `src/core/tipovi.ts`, dogovoreni potpisi i `package.json` se ne menjaju. Nema novih zavisnosti.
- `src/server/a2ui.ts` i `a2ui-alati.ts` (Luka) se ne menjaju.

## Kriterijum „gotovo“

- `npm run typecheck`, `npm test` i `npm run build` prolaze.
- Sva 4 alata rade u basic-host-u nad demo podacima (`npm start` i `ext-apps/examples/basic-host`).
- Scenariji S1–S5 i s6 daju status i polja iz `fixtures/README.md` i specifikacije (poglavlje 10).
- Za `stale`, `no_data` i `error` važi: `category` i `advice` su `null` i LLM se ne poziva (pravilo 2).

## Odluke (prihvaćene 2026-11-17)

1. **`values`** dolaze iz `getLatest`, kao sirova poslednja vrednost. Kategorija se računa iz satnog proseka, pa se ta dva broja mogu malo razlikovati. **Proverava se ponovo kad stigne pravi API (T01)**, kad vidimo koliko često stanice mere.
2. **`stationId` u `assess_air_quality` je opcion.** Ako ga nema, uzima se prva stanica, da demo radi i kad model ne pozove `get_stations`.
3. **Keš od 5 min (NFR-03)** se za sada ne pravi. Ostaje TODO dok ne stigne pravi API (T01).

## Izmene posle pregleda (2026-11-17)

- `main.ts` učitava `.env` preko `process.loadEnvFile()` u `try/catch`, bez novih paketa.
- `content` tekst postoji za sve statuse, sa porukom na srpskom.
- Odluke 1–3 prihvaćene. Uz odluku 1 dopisano da se proverava ponovo sa pravim API-jem.

## Napomene iz implementacije

- K2 dobija istoriju **i** poslednja merenja (`spojiMerenja`). Kad je poslednje merenje starije od 24 h, status je i dalje `stale` sa vremenom tog merenja (pravilo 2), a ne `no_data`.
- Za `status: "error"` je `rule` prazan string, jer procena nije ni urađena. Ekran (T10) ga tada ne prikazuje.
- Zavisnosti (izvor + K3) se prave jednom po procesu, pri prvom pozivu alata. Kad podešavanje ne valja (npr. `EKONET_IZVOR=api`), alati vraćaju `error` sa porukom, a server ne pada.

## Otvoreno

- Format i URL ekoNET API-ja (T01). Od toga zavise keš i pravo vreme `sada`.
- Luka (T12) prelazi sa `podaciZaPrikaz(scenario)` na `Rezultat` iz `proceniKvalitet`.
