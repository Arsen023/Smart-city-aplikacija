# Baza: istorija merenja kvaliteta vode (FishNET)

| Fajl | Šta radi |
|---|---|
| `01-sema.sql` | Pravi tabele `uredjaj` i `merenje_vode` i indeks. |
| `02-istorija.sql` | Upisuje uređaj `fishnet-1` i 136 merenja iz `podaci/historydata.json`. |
| `podaci/historydata.json` | Originalni odgovor `historydata` iz API-ja (bez ključa). |

Oba SQL fajla mogu da se pokrenu više puta: ništa se ne briše i ne duplira.

## Pokretanje u pgAdmin-u

1. Levo: **Servers → PostgreSQL → Databases**, desni klik → **Create → Database…**, ime `smartcity` → **Save**.
2. Klikni na bazu `smartcity`, pa gore **Tools → Query Tool**.
3. **Open File** (ikonica fascikle) → `db/01-sema.sql` → **Execute** (F5).
4. Isto za `db/02-istorija.sql`.
5. Provera:
   ```sql
   SELECT count(*), min(vreme), max(vreme) FROM merenje_vode;   -- 136 redova
   ```

## Šta je odlučeno i šta treba proveriti

- **Prazni zapisi:** 100 od 236 zapisa ima sve vrednosti `null` (uređaj se javio bez merenja). Oni se ne upisuju; tabela ih i odbija (`CHECK`).
- **Vreme:** u API-ju je bez zone (`2023-01-23T00:07:59`). Upisuje se kao **UTC**, jer `currentdata` vreme kasni tačno sat za našim lokalnim. **Potvrditi sa DunavNET-om.**
- **Uređaj:** API ne vraća `deviceId` u odgovoru, pa je uređaj nazvan `fishnet-1`. Kad dobijemo prave id-jeve, upisati ih u `uredjaj.id`.
- **Jedinice** (mV, mg/L, %, ppm…) su pretpostavka – potvrditi.
- **`dc02` u API-ju** (nula umesto slova O) je u bazi `dco2`.
- **`currentdata`** se ne čuva u bazi: ide direktno na dashboard (poslednje stanje uređaja).
