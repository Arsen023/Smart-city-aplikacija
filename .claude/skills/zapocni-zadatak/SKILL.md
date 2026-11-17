---
name: zapocni-zadatak
description: Počinje novi zadatak iz specifikacije (T01–T16) u Smart-city-aplikaciji - povlači main, pravi granu sara/... ili luka/..., čita pravila i pravi plan pre koda. Koristi kad korisnik kaže "počni T07", "novi zadatak" ili "radim na ...".
---

# Započni zadatak

Cilj: svaki zadatak počinje sa čistog `main`-a, na sopstvenoj grani, sa planom koji poštuje `CLAUDE.md`.

## Koraci

1. **Utvrdi zadatak.** Ako korisnik nije naveo ID (T01–T16), pitaj koji je. Pronađi ga u
   `docs/PODELA-RADA.md` (odeljak 3) i zapiši: vlasnik, fajlovi, od čega zavisi.
2. **Proveri zavisnosti.** Ako zadatak zavisi od nečega što još nije u `main`, reci to i
   predloži kako da se radi bez toga (npr. nad podacima iz `fixtures/`). Ne izmišljaj tuđi kod.
3. **Pripremi git** (PowerShell):
   ```powershell
   git status
   git switch main
   git pull
   git switch -c <ime>/<kratak-opis>
   ```
   Ako `git status` pokaže nesačuvane izmene, stani i pitaj šta sa njima pre promene grane.
   Ime grane: `sara/...` ili `luka/...`, kratko, engleski ili srpski bez dijakritika.
4. **Pročitaj pravila.** `CLAUDE.md` (posebno "Pravila koja se ne krše" i "Arhitektura"),
   `src/core/tipovi.ts` i postojeći kod u folderu zadatka.
5. **Napravi plan i pokaži ga pre kodiranja:**
   - koje fajlove praviš ili menjaš
   - koje testove pišeš
   - da li diraš zajednički fajl (`src/core/tipovi.ts`, `src/server/server.ts`, `package.json`)
     - ako da, napomeni da korisnik mora da javi drugom članu tima
   - šta je "gotovo" (kriterijum iz specifikacije, poglavlje 10)
6. Kreni sa kodom tek kad korisnik potvrdi plan.

## Ne radi

- Ne radi na `main` grani.
- Ne menjaj `src/core/tipovi.ts` ni dogovorene potpise bez izričite potvrde.
- Ne počinji dva zadatka na istoj grani.
