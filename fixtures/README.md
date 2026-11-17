# Demo scenariji (FR-14)

Izmišljeni podaci za razvoj i testove dok ne dobijemo pristup ekoNET API-ju.
Svaki fajl je tipa `DemoScenario` iz `src/core/tipovi.ts`.

| Fajl | Scenario | Očekivano |
|---|---|---|
| `s1-dobar.json` | S1 – sveže, niske vrednosti | „Dobar“ ili „Zadovoljavajući“, savet da je napolju u redu |
| `s2-los.json` | S2 – sveže, visoke vrednosti | „Loš“ ili gore, smanjiti napor ili trening unutra |
| `s3-zastareo.json` | S3 – poslednje merenje u 05:00, sada 09:20 | `stale`, poruka sa vremenom, bez kategorije i saveta |
| `s4-bez-pm25.json` | S4 – stanica meri samo PM10 | PM2.5 „nije dostupno“, kategorija iz PM10 uz napomenu |
| `s5-llm-greska.json` | S5 – podaci kao S1, LLM ne radi | merenja i kategorija, savet izostavljen uz poruku |
| `s6-bez-podataka.json` | nema nijednog merenja | `no_data`, bez kategorije i saveta |

- `sada` je referentno vreme scenarija: modul pravila ga koristi umesto stvarnog sata, pa provera svežine uvek daje isti rezultat.
- Merenja su satna, za poslednja 24 h, najnovije na kraju. Stanica `demo-liman` je izmišljena.
- Vrednosti su izmišljene, ne predstavljaju stvarno stanje vazduha.
