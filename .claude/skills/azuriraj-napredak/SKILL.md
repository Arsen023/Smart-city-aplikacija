---
name: azuriraj-napredak
description: Vodi evidenciju napretka Smart-city-aplikacije u docs/NAPREDAK.md - status zadataka T01–T16, šta je urađeno, odluke i otvorena pitanja. Koristi na kraju svake sesije rada, pre PR-a, posle merge-a, ili kad korisnik pita "dokle smo stigli", "šta je urađeno", "šta je sledeće".
---

# Ažuriraj napredak

Cilj: jedan fajl, `docs/NAPREDAK.md`, u kome Sara, Luka i mentor u svakom trenutku vide
šta je urađeno, šta je u toku, šta je sledeće i zašto su donete odluke.

## Kada

- Na kraju sesije rada (i kad zadatak nije gotov).
- U skillu `provera-pre-pr`, pre push-a: status zadatka postaje "U pregledu".
- Posle merge-a u `main`: status postaje "Gotovo", sa brojem PR-a.
- Kad korisnik pita "dokle smo stigli" - pročitaj fajl i odgovori iz njega, ne iz pamćenja.

## Koraci

1. Pročitaj `docs/NAPREDAK.md`. Ako ne postoji, napravi ga po strukturi ispod.
2. Utvrdi stanje iz činjenica, ne iz pretpostavki:
   ```powershell
   git branch --show-current
   git log --oneline main..HEAD
   git status --short
   ```
3. Ažuriraj samo red zadatka na kome se radilo u tabeli "Zadaci"
   (status, grana, PR, datum). Statusi: `Nije početo`, `U toku`, `U pregledu`, `Gotovo`, `Blokirano`.
4. Dodaj zapis u "Dnevnik" (najnoviji na vrhu): datum, ko, zadatak, 2–4 kratke stavke šta je urađeno.
5. Ako je doneta odluka (izbor biblioteke, format podataka, odstupanje od specifikacije),
   dodaj je u "Odluke" sa razlogom. Odluku koja menja `src/core/tipovi.ts` označi kao ZAJEDNIČKU.
6. Ažuriraj "Otvorena pitanja": dodaj nova, precrtaj odgovorena (sa odgovorom).
7. Ažuriraj "Sledeći koraci" (najviše 5, konkretno, sa vlasnikom).
8. Pokaži korisniku izmenu (diff) pre nego što je sačuvaš kao gotovu.

## Pravila

- Piši kratko, na srpskom, činjenice. Bez "uspešno", "odlično" i sličnog.
- Ne menjaj tuđe redove u dnevniku. Ispravke idu kao nov zapis.
- Datumi u formatu `2026-11-17`.
- Fajl je zajednički: pre izmene `git pull` ako je moguće, da ne pravite konflikt.

## Struktura fajla

```markdown
# Napredak – Smart-city-aplikacija

Poslednje ažuriranje: <datum> (<ko>)

## Zadaci

| ID | Zadatak | Vlasnik | Status | Grana | PR | Ažurirano |
|---|---|---|---|---|---|---|
| T01 | Pristup ekoNET API-ju | zajedno | ... | — | — | ... |
...

## Sledeći koraci
1. ...

## Dnevnik
### <datum> – <ko> – <T__>
- ...

## Odluke
| Datum | Odluka | Razlog | Ko |
|---|---|---|---|

## Otvorena pitanja
- [ ] ...
```
