---
name: test-scenariji
description: Pravi i održava test podatke u fixtures/ i scenarije S1–S5 iz specifikacije Smart-city-aplikacije (dobar vazduh, loš vazduh, zastareli podaci, nedostaje veličina, LLM nedostupan), za Vitest testove i demo režim. Koristi kad treba nov fixture, demo podaci ili provera scenarija.
---

# Test podaci i scenariji S1–S5

Cilj: isti podaci služe testovima, razvoju bez API-ja i demou, pa obe verzije prikaza (A i B) dobijaju identičan ulaz.

## Struktura

```
fixtures/
  stations.json                 lista stanica
  s1-good/latest.json           S1 Dobar vazduh
  s1-good/history.json
  s2-poor/...                   S2 Loš vazduh
  s3-stale/...                  S3 Zastareli podaci
  s4-missing-pm25/...           S4 Nedostaje veličina
  s5-llm-down/...               S5 LLM nedostupan (isti podaci kao S1, LLM mock vraća null)
  README.md                     šta je koji scenario i odakle su podaci
```

## Scenariji (specifikacija, poglavlje 10)

| ID | Ulaz | Očekivano |
|---|---|---|
| S1 | Sveže merenje, niske PM vrednosti | Kategorija Dobar ili Zadovoljavajući, savet, osnov vidljiv |
| S2 | Sveže merenje, visoke PM vrednosti | Kategorija Loš ili gora, savet da se napor smanji |
| S3 | Poslednje merenje starije od praga svežine | `status: "stale"`, poruka sa vremenom, bez kategorije i saveta |
| S4 | Stanica bez PM2.5 | PM2.5 "nije dostupno", kategorija iz PM10 uz napomenu |
| S5 | LLM vraća grešku ili `null` | Merenja i kategorija prikazani, savet izostavljen uz poruku |

## Pravila

- **Izmišljeni podaci su jasno označeni.** U `fixtures/README.md` i u polju `"_source"` svakog fajla:
  `"izmisljeno"` ili `"snimljeno sa ekoNET API-ja <datum>"`.
- **Format prati ekoNET odgovor**, ne naš `Rezultat` - fixture je ulaz u K1, a K1 ga normalizuje.
  Dok ne znamo pravi format API-ja, koristi najjednostavniji format i označi ga kao privremeni.
- **Vremena relativno:** S3 mora da bude zastareo i sutra. U testovima prosleđuj `now`
  u `proceni(merenja, sada)`, ne oslanjaj se na trenutni sat.
- **Vrednosti za S1 i S2 biraj iz EAQI tabele** iz `src/core/pravila/` konfiguracije,
  tako da padaju jasno unutar kategorije, ne na granici (granice testira Luka posebno).
- **Bez ključeva i ličnih podataka** u fixture fajlovima.

## Posle izmene

1. Pokreni `npm test`.
2. Ako postoji demo režim (FR-14), proveri svaki scenario u `basic-host`-u za obe verzije prikaza.
3. Ažuriraj `fixtures/README.md`.
