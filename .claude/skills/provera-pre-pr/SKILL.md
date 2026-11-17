---
name: provera-pre-pr
description: Proverava granu pre Pull Requesta u Smart-city-aplikaciji - pokreće typecheck, lint, format, testove i build, proverava pravila iz CLAUDE.md i piše opis PR-a. Koristi kad korisnik kaže "spremi PR", "da li je gotovo", "proveri pre push-a".
---

# Provera pre Pull Requesta

Cilj: u `main` ulazi samo kod koji prolazi CI i ne krši pravila projekta.

## 1. Automatske provere

Pokreni redom i za svaku grešku predloži ispravku:

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Ne nastavljaj na korak 3 dok sve ne prođe. Ne isključuj pravila linta i ne briši testove da bi prošlo.

## 2. Ručna provera pravila (pogledaj `git diff main...HEAD`)

Za svaku stavku napiši DA / NE / NE ODNOSI SE:

- [ ] Kategoriju računa samo `src/core/pravila/`, nigde LLM ni prikaz.
- [ ] Kad je status `stale` ili `no_data`: `category` i `advice` su `null`, LLM se ne poziva.
- [ ] `src/core/tipovi.ts` i dogovoreni potpisi nisu menjani (ako jesu: označi kao ZAJEDNIČKA IZMENA).
- [ ] `src/ui-a/` i `src/ui-b/` ne uvoze jedno iz drugog; `src/core/` ne uvozi iz `src/server/` ni `src/ui-*`.
- [ ] Nema logike pravila ni poziva LLM-a u `src/ui-a/` ili `src/ui-b/`.
- [ ] Nedostajuća veličina se prikazuje kao "nije dostupno", ne kao 0.
- [ ] EAQI pragovi nisu izmišljeni (stoje u konfiguraciji, sa izvorom).
- [ ] Nema `any`; spoljni podaci prolaze kroz Zod.
- [ ] Nema ključeva, tokena ni `.env` vrednosti u kodu, logovima, testovima ni `fixtures/`.
- [ ] Nove funkcije u `src/core/pravila/` imaju testove (granice, `stale`, `no_data`, samo PM2.5 / samo PM10).
- [ ] Nove zavisnosti u `package.json` su opravdane.
- [ ] Tekst za korisnika je na srpskom, latinicom.

Ako je neka stavka NE, popravi je ili jasno objasni zašto ostaje.

## 3. Opis PR-a

Napiši opis koji korisnik kopira na GitHub:

```markdown
## Zadatak
T__ – <naziv iz specifikacije>

## Šta je urađeno
- ...

## Kako testirati
1. ...

## Provere
- [x] typecheck, lint, format, test, build
- [x] pravila iz CLAUDE.md

## Napomene za pregled
- <zajednički fajlovi koji su dirani, otvorena pitanja>
```

## 4. Slanje

Predloži, ali ne pokreći bez potvrde:

```powershell
git push -u origin <grana>
```

Podseti: PR ka `main`, sačekati zeleni CI i pregled drugog člana tima.
