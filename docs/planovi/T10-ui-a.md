# T10 – Verzija A, ekran nad `Rezultat`-om (plan)

- **Vlasnik:** Sara
- **Grana:** `sara/ui-a` (sadrži `main` @ `500a4c4`, PR #11)
- **Zavisi od:** T09 (server, 4 alata), u `main`-u od PR #8.
- **Status plana:** odobren 2026-11-18, uz izmene (vidi „Izmene posle pregleda“)
- **Datum:** 2026-11-18

## Opseg ovog PR-a

| # | Element (spec 8.1) | U ovom PR-u |
|---|---|---|
| 1 | Izbor stanice | da |
| 2 | PM2.5 i PM10 sa jedinicom, „nije dostupno“ umesto 0 | da |
| 3 | Vreme merenja i „pre X min“ | samo vreme merenja (`16.11.2026. 09:00`); „pre X min“ je TODO |
| 4 | Kategorija: boja iz `src/zajednicko/boje-eaqi.ts` + naziv | da |
| 5 | Grafikon 24 h | ne, prazno mesto sa TODO (T11) |
| 6 | Savet | da |
| 7 | Osnov saveta (i pravilo) | da |

Stanja: učitavanje, `ok`, `stale`, `no_data`, `error` (status `error` ili `isError`), `ok` bez saveta (S5).
Tema hosta, safe area i dugme „Osveži“. Fullscreen nije u ovom PR-u.

**Zašto „pre X min“ i grafikon čekaju:** `protekloVreme()` je u `src/server/a2ui.ts`, a `geometrija.ts` u `src/ui-b/komponente/`. Ekran A ne sme da uvozi ni iz jednog od ta dva mesta. Predlog Luki je da obe funkcije pređu u `src/zajednicko/`. Do njegovog odgovora ostaju dva `TODO(T10/zajednicko)` i nijedna kopija koda. Lukine fajlove ne diram.

## Polazno stanje

- `src/ui-a/app.ts` i `index.html` su ekran iz Quickstart-a: tekst iz `content` i dugme koje poziva `assess_air_quality`.
- Server već vraća ceo `Rezultat` u `structuredContent` (`assess_air_quality`). Lista stanica dolazi iz `get_stations` (`structuredContent.stanice`).
- Oba alata nemaju `_meta.ui.visibility`, što znači podrazumevano `["model", "app"]` (proveren `spec.types.d.ts` u `@modelcontextprotocol/ext-apps`). Ekran ih zove preko `callServerTool`, **bez izmena na serveru**.

## Fajlovi

| Fajl | Šta radi |
|---|---|
| `src/ui-a/index.html` | Kostur ekrana: zaglavlje (naslov, izbor stanice, „Osveži“), vrednosti, vreme, kategorija, poruka/napomena, mesto za grafikon (`hidden`, TODO T11), savet, osnov. CSS sa promenljivama hosta i rezervnim vrednostima (`var(--color-background-primary, #fff)`, `var(--font-sans, system-ui, sans-serif)`). Region `aria-live="polite"` za promene stanja. |
| `src/zajednicko/format.ts` (novo) + `format.test.ts` | `tekstVrednosti()` premeštena iz `src/server/procena.ts`. `procena.ts` je uvozi i dalje izvozi pod istim imenom, pa `src/server/a2ui.ts` (Luka) radi bez izmene. |
| `src/server/procena.ts` | Samo premeštanje `tekstVrednosti` (uvoz + ponovni izvoz). Ponašanje se ne menja. |
| `CLAUDE.md` | Pravila zavisnosti: „Prikazi smeju da uvoze i `src/core/vreme.ts` (čiste funkcije, bez I/O-a).“ |
| `src/ui-a/sema.ts` (novo) | Zod šeme za `Rezultat` i `{ stanice }` iz `get_stations`. `procitajRezultat(unknown) → Rezultat \| null`. Neispravan oblik ide u stanje „greška“, ne ruši ekran. Tipovi se uzimaju iz `src/core/tipovi.ts`, a šema se proverava sa `satisfies`. |
| `src/ui-a/prikaz.ts` (novo) | Čista funkcija `modelEkrana(stanje) → ModelEkrana`, bez DOM-a. Iz rezultata ili greške određuje koji se delovi vide i koji je tekst (vrednosti, vreme, kategorija sa bojama, poruka, savet, osnov). Bez pravila i pragova: samo bira šta da prikaže od onoga što je server vratio. |
| `src/ui-a/crtaj.ts` (novo) | Upisuje `ModelEkrana` u DOM (`textContent`, `hidden`, boje kategorije), bez `innerHTML` sa podacima. |
| `src/ui-a/app.ts` | Povezivanje sa hostom, tema, događaji, pozivi alata, `updateModelContext`. |
| `src/ui-a/sema.test.ts`, `src/ui-a/prikaz.test.ts` (novo) | Testovi, vidi dole. |

Zajednički fajlovi (`src/core/tipovi.ts`, `src/server/server.ts`, `package.json`) se **ne menjaju**. CLAUDE.md se menja za jedan red, pa to javi Luki. `zod` je već zavisnost, pa nema novih paketa.

## Tok u `app.ts`

1. `app.connect()`, pa odmah `primeniKontekst(app.getHostContext())`. Isto se radi u `app.onhostcontextchanged`.
   - `applyDocumentTheme(ctx.theme)`, `applyHostStyleVariables(ctx.styles.variables)`, `applyHostFonts(ctx.styles.css.fonts)`
   - `safeAreaInsets` → `padding` na korenu
2. `app.ontoolresult` → `procitajRezultat(structuredContent)` → crtanje. Ako je `isError` ili oblik nije ispravan, crta se stanje „greška“.
3. Posle prvog rezultata se jednom poziva `get_stations` i puni `<select>`. Izabrana je `result.station.id`. Ako poziv ne uspe, `<select>` ostaje sa jednom, trenutnom stanicom i ekran radi dalje.
4. Promena stanice, „Osveži“ i „Pokušaj ponovo“ → `callServerTool({ name: "assess_air_quality", arguments: { stationId } })`.
   - Za vreme poziva: dugmad su onemogućena, `aria-busy="true"`, tekst „Osvežavanje…“. Stari sadržaj ostaje, da visina ne skače.
   - Drugi klik dok poziv traje se ignoriše.
   - Izuzetak ili `isError` → stanje „greška“ sa porukom na srpskom.
5. Posle svakog novog rezultata: `app.updateModelContext({ content: [{ type: "text", text }] })` sa stanicom, vremenom merenja i kategorijom ili statusom.

## Stanja (šta se vidi)

| Stanje | Vrednosti | Vreme | Kategorija | Poruka | Savet / osnov | Grafikon |
|---|---|---|---|---|---|---|
| učitavanje | — | — | — | „Učitavanje…“ (kostur fiksne visine) | — | — |
| `ok` | da | da | boja + naziv (+ `napomena`, S4) | — | da | TODO |
| `ok`, `advice: null` (S5) | da | da | da | `message` (npr. „Savet trenutno nije dostupan…“) | ne | TODO |
| `stale` (S3) | da | da | **ne** | `message` sa vremenom poslednjeg merenja | **ne** | TODO |
| `no_data` | ne | „nema podataka“ | ne | `message` | ne | ne |
| `error` / `isError` | ne | ne | ne | `message` ili opšta poruka + „Pokušaj ponovo“ | ne | ne |

Kategorija se crta samo kad je `status === "ok"` i `category !== null`. Ekran ne zaključuje ništa preko toga (pravila 1, 2, 4). Naziv se uvek ispisuje uz boju (NFR-07).

## Testovi (`node --test`, bez DOM-a, bez mreže)

- `sema.test.ts`: ispravan `Rezultat` prolazi. Odbijaju se: nepoznat status, `vrednost: "12"`, `null` i objekat bez `station`. Odbija se i `{ stanice }` bez `id`.
- `prikaz.test.ts`: `Rezultat`-i za S1–S6 i `error`, napravljeni u testu po uzoru na `fixtures/`, plus stanje učitavanja:
  - `ok`: vidljivi su kategorija, savet i osnov, a boja je ista kao `bojeKategorije(nivo)`
  - S4: PM2.5 „nije dostupno“ (nikad „0“), vidi se `napomena`
  - S5: nema saveta, vidi se poruka
  - `stale`: nema kategorije ni saveta, vide se poruka i vrednosti
  - `no_data` i `error`: samo poruka; za `error` dugme „Pokušaj ponovo“
  - `category` postoji, a status nije `ok`: kategorija se ne prikazuje (odbrana od nedoslednog ulaza)
  - format vremena: `16.11.2026. 09:00`
  - vrednosti se prikazuju kroz `tekstVrednosti` iz `src/zajednicko/format.ts`, npr. `PM2.5 12,4 µg/m³`
- `src/zajednicko/format.test.ts`: decimalni zarez, `null` daje „nije dostupno“ (nikad „0“), a vrednost `0` daje „0 µg/m³“.

## Izmene posle pregleda (2026-11-18)

1. **Vreme:** ekran uvozi `prikazDatumVreme` iz `src/core/vreme.ts`. U CLAUDE.md se dopunjuju pravila zavisnosti: „Prikazi smeju da uvoze i `src/core/vreme.ts` (čiste funkcije, bez I/O-a).“
2. **Format vrednosti:** nema novog formatiranja u ekranu. `tekstVrednosti` prelazi iz `src/server/procena.ts` u `src/zajednicko/format.ts`, a `procena.ts` je ponovo izvozi pod istim imenom. Test je u `src/zajednicko/format.test.ts`.
3. **Snimci ekrana** idu u `docs/snimci/T10/`.

## Kada je gotovo

- `npm run typecheck`, `npm test` i `npm run build` prolaze.
- U basic-host-u (http://localhost:8080), za `EKONET_SCENARIO` = s1 … s6 i za `EKONET_IZVOR=api` (stanje `error`), vidi se tačno ono iz tabele stanja, u svetloj i tamnoj temi.
- „Osveži“ i promena stanice rade bez skakanja visine. U demo režimu postoji jedna stanica (`demo-liman`), pa se promena stanice proverava samo testom.
- Snimci ekrana S1, S3, S4 i S5 su u `docs/snimci/T10/` (za prezentaciju).
- Nema uvoza iz `src/ui-b/` ni `src/server/` (grep) i nema `any`.
- NAPREDAK.md: T10 prelazi u „U pregledu“ (skill `provera-pre-pr`).
