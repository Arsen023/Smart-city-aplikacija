# Podela rada i način rada sa gitom

Kratak dogovor kako Sara i Luka rade na projektu, da ne smetamo jedno drugom.
Zasnovano na specifikaciji (poglavlja 4, 10 i 11).

## 1. Ideja u jednoj rečenici

Jedan repozitorijum, jedno zajedničko jezgro (podaci → pravila → LLM savet → MCP server)
i dva prikaza istog rezultata: **verzija A** (naš HTML/JS) i **verzija B** (A2UI).

```
Sara: K1 ekonet ──┐
                  ├──► Sara: K4 server.ts ──► Sara: verzija A (ui-a)
Luka: K2 pravila ─┤                      └──► Luka: verzija B (ui-b)
Luka: K3 llm ─────┘
```

## 2. Struktura repoa

```
main.ts              pokretanje HTTP MCP servera
src/core/            zajedničko jezgro (K1, K2, K3) + tipovi.ts
src/server/          K4 MCP server: alati i ui:// resursi
src/ui-a/            verzija A (HTML/JS)
src/ui-b/            verzija B (A2UI)
fixtures/            snimljeni API odgovori za demo režim (FR-14)
docs/                ovaj dokument, Stitch procena, beleške
```

Pravilo: `ui-a` i `ui-b` nikad ne uvoze jedno iz drugog. Oba zavise samo od `src/core/tipovi.ts`.

## 3. Ko šta radi

### Sara – podaci, server, verzija A

| Zadatak | Fajlovi | Zavisi od |
|---|---|---|
| T02 MCP Apps Quickstart | ✅ urađeno (osnova repoa) | — |
| T06 K1 ekoNET klijent + normalizacija | `src/core/ekonet/` | T01 (pristup API-ju) |
| T06 snimljeni odgovori za demo | `fixtures/` | T01 |
| T09 K4 MCP server, 4 alata | `src/server/` | T06, T07, T08 |
| T10 verzija A, svih 7 elemenata | `src/ui-a/` | T09 |
| T11 grafikon 24 h u verziji A | `src/ui-a/` | T10 |

### Luka – pravila, LLM, verzija B

| Zadatak | Fajlovi | Zavisi od |
|---|---|---|
| T03 A2UI Quickstart | van repoa | — |
| T05 Stitch skica i tabela mapiranja (D5) | `docs/stitch/` | T03 |
| T07 K2 modul pravila (EAQI, svežina, testovi) | `src/core/pravila/` | — (može odmah) |
| T08 K3 LLM korak (prompt, poziv, provera) | `src/core/llm/` | T07 |
| T12 A2UI poruke iz rezultata alata | `src/server/a2ui.ts` | T09 |
| T13 verzija B + komponenta za grafikon | `src/ui-b/` | T12 |

### Zajedno

| Zadatak | Kada |
|---|---|
| T01 pristup ekoNET API-ju (Mario, Nikola) | odmah |
| `src/core/tipovi.ts` – zajednički format rezultata | odmah, pre T06/T07 |
| T04 prezentacija (D1, 5–7 slajdova) | posle T02 i T03 |
| T14 scenariji S1–S5 na obe verzije | kad su A i B gotove |
| T15 README, T16 demo i pisana preporuka (D6) | na kraju |

## 4. Zajednički fajlovi – menjaju se samo uz dogovor

| Fajl | Zašto je osetljiv | Pravilo |
|---|---|---|
| `src/core/tipovi.ts` | ugovor između svih delova (format iz poglavlja 7) | pišemo ga zajedno; svaka izmena uz poruku drugom |
| `src/server/server.ts` | Sarin, ali Luka dodaje resurs za verziju B | Luka menja preko malog PR-a |
| `package.json` | zavisnosti i skripte | nove pakete dodaje onaj kome trebaju, uz poruku |
| `README.md` | uputstvo za obe verzije | dopunjavamo na kraju |

Dogovoreni potpisi funkcija (da Sarin server zna šta poziva):

```ts
// src/core/pravila  (Luka)
proceni(merenja: Merenje[], sada: Date): ProcenaPravila
// → status ok | stale | no_data, kategorija, odredjujuca veličina, pravilo

// src/core/llm  (Luka)
napraviSavet(rezultat: Rezultat): Promise<{ savet: string; osnov: string } | null>
// → null ako LLM nije dostupan ili izlaz ne prođe proveru

// src/core/ekonet  (Sara)
getStations(): Promise<Stanica[]>
getLatest(stationId: string): Promise<Merenje[]>
getHistory(stationId: string, hours?: number): Promise<SatnaVrednost[]>
```

Nazivi su predlog – važno je da ih dogovorimo pre nego što krenemo.

## 5. Kako radimo sa gitom

### Osnovno pravilo

**Niko ne radi direktno na `main`.** Za svaki zadatak pravimo novu granu,
a u `main` ulazi samo preko Pull Requesta (PR) koji je drugi pogledao.

Grane se zovu `ime/zadatak`:

```
sara/ekonet     sara/server     sara/ui-a
luka/pravila    luka/llm-savet  luka/ui-b
```

### Korak po korak

1. **Pre početka zadatka** – povuci najnoviji `main` i napravi granu od njega:
   ```bash
   git checkout main
   git pull
   git checkout -b luka/pravila
   ```
2. **Dok radiš** – commituj često, sa jasnom porukom:
   ```bash
   git add .
   git commit -m "Pragovi EAQI i testovi granica za PM2.5"
   ```
3. **Pošalji granu na GitHub:**
   ```bash
   git push -u origin luka/pravila
   ```
4. **Otvori PR** – na GitHubu klikni „Compare & pull request“, napiši šta si uradio.
5. **Drugi pregleda** – pogleda izmene, ostavi komentar ili odobri.
6. **Merge** – klik na „Merge pull request“, pa „Delete branch“.
7. **Oboje povučete novi `main`:**
   ```bash
   git checkout main
   git pull
   ```

### Da izbegnemo konflikte

- Grana treba da živi **2–3 dana, ne 2 nedelje**. Manji PR-ovi, češće.
- Ako je drugi u međuvremenu spojio nešto u `main`, povuci to u svoju granu:
  ```bash
  git pull origin main
  ```
- Pre nego što dirneš zajednički fajl (odeljak 4), javi drugom.
- `node_modules/`, `dist/` i `.env` nikad ne idu u git (već su u `.gitignore`).
- API ključevi idu samo u `.env`, nikad u kod.

### Zaštita `main` grane (preporuka)

Na GitHubu: **Settings → Branches → Add rule** za `main` →
uključiti „Require a pull request before merging“.
Tako ni slučajno ne može da se pushuje direktno na `main`.

## 6. Redosled – šta sad

1. **Odmah, zajedno:** pisati Mariu i Nikoli za ekoNET API (T01) i doneti odgovore na pitanja iz 12.1 specifikacije.
2. **Odmah, zajedno:** napisati `src/core/tipovi.ts` i dogovoriti potpise iz odeljka 4.
3. **Paralelno:**
   - Sara: T06 ekoNET klijent i fixtures (čim stigne pristup).
   - Luka: T07 modul pravila sa testovima, pa T03 A2UI Quickstart.
4. **Prezentacija (D1)** posle oba quickstarta.
5. **Spajanje:** Sara T09 server koristi Lukine `pravila/` i `llm/`.
6. **Prikazi paralelno:** Sara verzija A, Luka verzija B.
7. **Zajedno:** S1–S5, README, demo i preporuka.

## 7. Otvorena pitanja (iz specifikacije, 12.1)

- URL i autentifikacija ekoNET API-ja, ograničenje poziva?
- Koliko često stižu merenja i koje stanice mere PM2.5 i PM10?
- Podrazumevana stanica za demo?
- Prag svežine: 2 h ili drugi?
- Kategorija iz satne vrednosti (EAQI 2024) ili 24-časovnog proseka?
- Koji LLM i čiji ključ za K3?
- U kom hostu radimo demo i podržava li MCP Apps?
- A2UI katalog v0.9 ili v1.0?
