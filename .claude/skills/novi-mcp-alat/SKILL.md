---
name: novi-mcp-alat
description: Dodaje ili menja MCP alat u src/server/ Smart-city-aplikacije (get_stations, get_latest, get_history, assess_air_quality, alat za A2UI) - Zod ulaz, structuredContent, veza sa ui:// ekranom, testovi. Koristi kad treba registrovati alat ili ga povezati sa prikazom A ili B.
---

# Novi MCP alat

Cilj: svi alati izgledaju isto, vraćaju dogovoreni format i rade i u hostu bez MCP Apps podrške.

## Pre koda

1. Pročitaj `CLAUDE.md`, `src/core/tipovi.ts` i postojeće alate u `src/server/`.
2. Za referencu API-ja pogledaj kloniran `ext-apps` repo (van projekta):
   `src/server/index.ts` (`registerAppTool`, `registerAppResource`) i primere
   `examples/basic-server-vanillajs/`, `examples/wiki-explorer-server/` (`callServerTool`).
   Ne pogađaj potpise funkcija - proveri ih tamo.

## Pravila za alat

- **Ime:** snake_case, engleski (`assess_air_quality`).
- **Opis (`description`):** jedna-dve rečenice na engleskom, šta alat radi i kada ga model poziva.
- **Ulaz:** Zod šema. `stationId` je string; ostalo opciono sa podrazumevanom vrednošću.
- **Logika:** alat samo poziva `src/core/` (`ekonet`, `pravila`, `llm`). U alatu nema pravila ni pragova.
- **Izlaz:**
  - `content`: kratak tekst na srpskom za model i za hostove bez MCP Apps
    (npr. "Liman: PM2.5 12,4 µg/m³ u 09:00, kategorija Zadovoljavajući.").
  - `structuredContent`: ceo objekat tipa iz `src/core/tipovi.ts` (`Rezultat` za `assess_air_quality`).
- **Statusi:** `ok`, `stale`, `no_data`, `error`. Za sve osim `ok`: `category` i `advice` su `null`,
  `message` objašnjava razlog na srpskom. Greška API-ja ne baca izuzetak ka hostu - vraća `status: "error"`.
- **Ekran:** ako alat ima prikaz, veži ga preko `_meta.ui.resourceUri` na `ui://...` resurs
  registrovan sa `registerAppResource`. Verzija A: `ui://air/dashboard-a`, verzija B: `ui://air/dashboard-b`.
- **CSP:** u `_meta.ui` resursa navedi samo domene koji su stvarno potrebni.
- **Ključevi:** samo iz `process.env`, nikad u `content` ni `structuredContent`.

## Test

- Za svaki alat bar jedan test (`node --test`) koji ga poziva sa podacima iz `fixtures/`
  (mock `src/core/ekonet`, mock `src/core/llm`) i proverava `content` i `structuredContent`.
- Pokrij `ok` i bar jedan od `stale` / `no_data`.

## Provera u hostu

1. `npm start` (Terminal 1).
2. `basic-host` iz `ext-apps/examples/basic-host` (Terminal 2), http://localhost:8080.
3. Pozovi alat i proveri da se ekran prikazuje i da su podaci isti kao u testu.

Na kraju predloži skill `provera-pre-pr`.
