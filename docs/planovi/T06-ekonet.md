# T06 – K1 ekoNET klijent + fixtures (plan)

- **Vlasnik:** Sara
- **Grana:** `sara/ekonet` (od `main` @ `d7f24c6`)
- **Zavisi od:** T01 (pristup ekoNET API-ju), još nije rešeno
- **Status plana:** odobren 2026-11-17, uz izmene (vidi „Izmene posle pregleda“)
- **Datum:** 2026-11-17

## Polazno stanje

- `src/core/ekonet/` još ne postoji.
- `fixtures/` već ima scenarije s1–s6 u formatu `DemoScenario` (`src/core/tipovi.ts`). Lukin `eaqi.test.ts` i `src/server/a2ui.ts` ih već čitaju.
- Snimljenih odgovora pravog API-ja nema, jer T01 nije završen.
- Svih 6 scenarija koristi istu stanicu `demo-liman`. Zato se demo klijent pravi za jedan scenario. Inače bi `getLatest("demo-liman")` bilo dvosmisleno.

## Pristup bez T01

Prema odluci iz `docs/NAPREDAK.md` (2026-11-17), K1 za sada radi samo nad `fixtures/`. Format pravog ekoNET odgovora, URL i autentifikacija se ne izmišljaju. Izvor `api` postoji kao opcija, ali za sada daje jasnu grešku da T01 nije podešen.

## Fajlovi

| Fajl | Odgovornost |
|---|---|
| `src/core/ekonet/sema.ts` | Zod šeme za `Stanica`, `Merenje` i `DemoScenario`. Svaka je vezana za tip iz `tipovi.ts` preko `satisfies z.ZodType<...>`, da se šema i tip ne razilaze. |
| `src/core/ekonet/demo.ts` | `napraviDemoKlijent(scenario): EkonetKlijent`, bez I/O-a. Ponašanje je opisano niže. |
| `src/core/ekonet/ucitaj.ts` | `ucitajScenario(id)` i `listaScenarija()`: čitaju `fixtures/<id>.json` i proveravaju ga šemom. ID se proverava protiv liste poznatih scenarija, da se ne može podmetnuti putanja (`../`). |
| `src/core/ekonet/normalizuj.ts` | Samo sortiranje po vremenu i odbacivanje nevažećih vrednosti (detalji niže). |
| `src/core/ekonet/greske.ts` | Klasa `GreskaEkonet` sa kodom `nepoznata_stanica`, `neispravan_odgovor` ili `konfiguracija`. Server (T09) iz nje pravi status `error`. Kod `nedostupno` (API ne odgovara) dolazi sa T01. |
| `src/core/ekonet/index.ts` | Javni API modula i `napraviKlijent()`, koji bira izvor podataka (opisano niže). |
| `.env.example` | Promenljive `EKONET_IZVOR` i `EKONET_SCENARIO`, bez vrednosti, sa komentarom o dozvoljenim vrednostima. |

### Izbor izvora (`napraviKlijent()`)

- `EKONET_IZVOR` je `demo` ili `api`. Kad nije postavljena ili je prazna, podrazumeva se `demo`.
- Za `demo` se `EKONET_SCENARIO` bira iz `fixtures/`, a podrazumevano je `s1-dobar`.
- Za `api` se baca `GreskaEkonet("konfiguracija")` sa jasnom porukom da pristup ekoNET API-ju (T01) još nije podešen. `EKONET_SCENARIO` se tada ne gleda.
- Nepoznata vrednost za `EKONET_IZVOR` ili `EKONET_SCENARIO` baca `GreskaEkonet("konfiguracija")`. Poruka navodi dozvoljene vrednosti.
- Okruženje se prima kao parametar (podrazumevano `process.env`), da bi testovi radili bez menjanja globalnog stanja.

### Ponašanje demo klijenta

- `getStations()` vraća stanicu scenarija.
- `getLatest(id)` vraća najnovije merenje po veličini, i kad je staro. Svežinu proverava K2, ne K1.
- `getHistory(id, hours = 24)` vraća merenja iz prozora od `hours` sati pre `scenario.sada`.
- Nepoznat `stationId` baca `GreskaEkonet("nepoznata_stanica")`.

### Normalizacija (`normalizuj.ts`)

- Merenja se sortiraju po vremenu, najnovije na kraju. Poredi se trenutak, ne tekst, pa različiti pomaci zone ne smetaju.
- Odbacuju se merenja čija vrednost nije konačan broj (`NaN`, `Infinity`) ili je negativna. Odbacuje se i merenje čije vreme ne može da se pročita. Nevažeća vrednost nikad ne postaje 0 (pravilo 5).
- Aliasa imena veličina (`"pm25"`, `"pm2_5"`…) nema dok ne stigne T01 i ne vidimo pravi format.

## Testovi (`node --test`, samo nad `fixtures/`)

- **`demo.test.ts`**
  - `getLatest` vraća poslednje PM2.5 i PM10.
  - Za s4 vraća samo PM10, bez nule za PM2.5.
  - Za s6 vraća prazan niz.
  - Za s3 vraća staro merenje.
  - `getHistory` poštuje `hours`.
  - Nepoznata stanica baca grešku.
- **`ucitaj.test.ts`**
  - Svih 6 fixture-a prolazi šemu.
  - Neispravan JSON se odbija.
  - Nepoznat ID ili `../` baca grešku.
- **`normalizuj.test.ts`**
  - Sortiranje po trenutku, i kad se pomaci zone razlikuju.
  - `NaN`, `Infinity`, negativne vrednosti i nečitljivo vreme se odbacuju, a 0 ostaje.
  - Ulazni niz se ne menja.
- **`index.test.ts`** (izbor izvora)
  - Bez promenljivih: `demo` i `s1-dobar`.
  - `EKONET_SCENARIO` bira scenario (npr. s4 daje samo PM10).
  - `api` baca grešku koja pominje T01.
  - Nepoznat izvor ili scenario baca `GreskaEkonet("konfiguracija")`.
- **Integracioni test:** demo klijent (K1) i `proceni()` (K2) daju očekivani status za S1, S2, S3, S4 i s6.

## Zajednički fajlovi i tuđi kod

- `src/core/tipovi.ts`, `src/server/server.ts` i `package.json` se ne menjaju.
- `src/server/a2ui.ts` (Luka) se ne menja. U opisu PR-a ide napomena za Luku da pređe na `ucitajScenario()` iz `src/core/ekonet/`.
- Nema novih zavisnosti, `zod` već postoji.

## Kriterijum „gotovo“

- `npm run typecheck`, `npm test` i `npm run build` prolaze.
- Scenariji S1–S5 i s6 kroz K1 i K2 daju ishode iz `fixtures/README.md`.
- T09 može da koristi `EkonetKlijent` preko `napraviKlijent()` bez izmena kad stigne pravi API (zamenjuje se samo implementacija za `api`).

## Izmene posle pregleda (2026-11-17)

- U `index.ts` je dodat `napraviKlijent()` sa izborom izvora iz `EKONET_IZVOR` i `EKONET_SCENARIO`, plus `.env.example` i testovi za izbor izvora.
- `normalizuj.ts` je sveden na sortiranje i odbacivanje nevažećih vrednosti. Izbačeni su aliasi imena veličina i pretvaranje vremena.
- `src/server/a2ui.ts` se ne menja, umesto toga ide napomena za Luku u PR-u.

## Za opis PR-a

> **Napomena za Luku:** `src/server/a2ui.ts` i dalje sam čita `fixtures/` (svoj `ucitajScenario` i `DEMO_SCENARIJI`, bez Zod provere). U ovom PR-u ga nisam menjala. Kad ti odgovara, pređi na `ucitajScenario()` i `DEMO_SCENARIJI` iz `src/core/ekonet/index.ts`. Ti proveravaju fajl šemom i ne čitaju putanje van liste scenarija. Lista scenarija je ista kao tvoja, pa tip `DemoScenarioId` može da ostane.

## Otvoreno

- Format odgovora, URL i autentifikacija ekoNET API-ja (T01). Od toga zavise pravi HTTP klijent, aliasi imena veličina i snimljeni odgovori u `fixtures/`.
- `npm start` ne učitava `.env`. Promenljive za sada treba postaviti u PowerShell-u (`$env:EKONET_SCENARIO = "s2-los"`). Učitavanje `.env` je izmena `package.json` ili `main.ts`, pa se dogovara posebno.
