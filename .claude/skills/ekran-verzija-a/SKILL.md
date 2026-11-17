---
name: ekran-verzija-a
description: Pravi i dorađuje ekran verzije A (MCP App, src/ui-a/) Smart-city-aplikacije - povezivanje sa hostom, tema hosta, stanja ekrana, 7 elemenata, grafikon, osvežavanje, model context. Koristi za zadatke T10 i T11 i svaku izmenu u src/ui-a/.
---

# Ekran verzije A (src/ui-a/)

Cilj: ekran koji izgleda kao deo host aplikacije, ispravno prikazuje sva stanja
i crta isključivo ono što server vrati u `structuredContent` (tip `Rezultat` iz `src/core/tipovi.ts`).

## Pre koda

1. Pročitaj `CLAUDE.md`, `src/core/tipovi.ts`, `src/ui-a/` i alat `assess_air_quality` u `src/server/`.
2. Za API klase `App` proveri izvor u kloniranom `ext-apps` repou (van projekta):
   `src/app.ts`, i primere `examples/basic-server-vanillajs/`, `examples/wiki-explorer-server/`,
   `examples/system-monitor-server/`. Ne pogađaj imena metoda.

## Obavezni obrasci

**Povezivanje i tema hosta**
- `app.connect()`, pa odmah primeni `app.getHostContext()`.
- `app.onhostcontextchanged` za kasnije promene.
- Primena: `applyDocumentTheme`, `applyHostStyleVariables`, `applyHostFonts`; padding iz `safeAreaInsets`.
- Pozadina, tekst i ivice: CSS promenljive hosta sa rezervnom vrednošću, npr.
  `var(--color-background-primary, #fff)`, `var(--font-sans, system-ui, sans-serif)`.
  Boje EAQI kategorija i serija grafikona su naše (sadržaj), ali rade i u tamnoj temi.
- Bez naziva brenda u ekranu; naslov sadržaja je dozvoljen ("Kvalitet vazduha – Liman").

**Podaci**
- Ulaz: `app.ontoolresult` → `result.structuredContent` kao `Rezultat`. Proveri oblik (type guard)
  pre crtanja; neispravan podatak = stanje "greška", ne pad ekrana.
- Promena stanice i dugme "Osveži": `app.callServerTool({ name, arguments })` i čitanje `structuredContent`.
  Proveri `result.isError`.
- Alati koje zove samo ekran (npr. istorija za grafikon) registruju se sa `_meta.ui.visibility: ["app"]`
  - to radi `src/server/` (skill `novi-mcp-alat`), ne ekran.
- Posle promene stanice javi modelu šta korisnik gleda: `app.updateModelContext(...)` sa kratkim tekstom
  (stanica, vreme merenja, kategorija ili status).

**Stanja ekrana (sva moraju da postoje i da se vide u basic-host-u)**

| Stanje | Kada | Šta se vidi |
|---|---|---|
| Učitavanje | pre prvog rezultata ili tokom `callServerTool` | skeleton/poruka, bez skakanja visine |
| `ok` | status ok | svih 7 elemenata |
| `stale` | status stale | merenja i vreme, poruka sa vremenom poslednjeg merenja, BEZ kategorije i saveta |
| `no_data` | status no_data | poruka, bez kategorije, saveta i grafikona |
| `error` | status error ili `isError` | poruka i dugme "Pokušaj ponovo" |
| bez saveta | `advice === null` uz status ok (S5) | sve osim saveta, uz napomenu |

**7 elemenata (specifikacija 8.1):** izbor stanice; PM2.5 i PM10 sa jedinicom; vreme merenja i "pre X min";
kategorija (boja + naziv, nikad samo boja); grafikon 24 h; savet; osnov saveta.
Nedostajuća veličina = "nije dostupno", nikad 0.

**Grafikon (T11)**
- Podaci za grafikon: `history` iz `Rezultat`-a (satne vrednosti pravi K2, `satneVrednosti`), ekran ih samo crta.
- Chart.js ili ručni SVG, uključen kroz Vite build (ne CDN - CSP iframe-a).
- Dve linije (PM2.5, PM10), jedinica na osi, vreme Europe/Belgrade, prazna mesta za sate bez merenja (ne nula).
- Boje se menjaju sa temom hosta; legenda tekstom.

**Prikaz**
- Prvo `inline`. Fullscreen samo ako je u `availableDisplayModes`, preko `app.requestDisplayMode`;
  u fullscreen-u ukloni zaobljenje kontejnera.
- Tekst na srpskom, latinicom; vreme `16.11.2026. 09:00`.
- Kontrast teksta najmanje 4,5:1.

## Ne radi

- Nema računanja kategorije, pragova ni poziva LLM-a u `src/ui-a/`.
- Nema uvoza iz `src/ui-b/`.
- Nema `fetch` ka spoljnim API-jima iz ekrana - samo preko alata servera.

## Provera

1. `npm start` i basic-host (http://localhost:8080).
2. Prođi scenarije S1–S5 iz `fixtures/` (skill `test-scenariji`) u svetloj i tamnoj temi.
3. Napravi snimke ekrana za `docs/` (za prezentaciju i demo).
4. Pokreni `provera-pre-pr`.
