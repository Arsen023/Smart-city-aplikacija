# T05 – Google Stitch skica i procena prevoda u A2UI (D5)

Zadatak iz specifikacije, poglavlje 8.4:

- U Stitch-u napraviti skicu istog ekrana, **sa podacima i bez njih**.
- Za svaki element proveriti postoji li A2UI komponenta i upisati rezultat u tabelu.
- Sadržaj koji Stitch izmisli (skala 0–100, pragovi, izvori…) **ne prenosi se** u aplikaciju.
- Zaključak: da li Stitch koristimo za generisanje A2UI komponenti ili samo kao vizuelni predložak.

**Prihvaćeno kada (spec 10, D5):** za svaki element ekrana postoji ocena: da, delimično ili ne.

Status: 🟡 tabela popunjena na osnovu A2UI probe (T03); skice iz Stitch-a i odeljak 3 čekaju.

---

## 1. Prompt za Stitch

Prompt je napisan tako da Stitch dobije naše prave elemente i vrednosti, a ne da izmišlja
skale i pragove. Isti prompt, dva puta – jednom za stanje sa podacima, jednom bez preporuke.

### 1a. Stanje sa podacima (scenario S2, loš vazduh)

```
Mobile-friendly card UI for an air quality assistant that answers:
"Is it a good time for a walk or a workout outside?" All text in Serbian (Latin script).

Show exactly these elements, top to bottom:
1. Station picker (dropdown) – selected: "Liman, Novi Sad"
2. Latest values in a row: "PM2.5: 82.9 µg/m³" and "PM10: 149.3 µg/m³"
3. Measurement time: "Merenje: 16.11.2026. 09:00 (pre 20 min)"
4. Air quality category as a colored badge WITH its name: "Loš" (level 4 of 6, European Air Quality Index)
5. Simple line chart of PM2.5 and PM10 for the last 24 hours, with unit µg/m³ and hour axis
6. Advice text: "Izbegavajte intenzivne vežbe napolju i birajte laganu šetnju ili trening niskog intenziteta."
7. Small caption "Osnov": "Liman, Novi Sad, 16.11.2026. 09:00: PM2.5 82.9 µg/m³, PM10 149.3 µg/m³, kategorija Loš po EAQI, satne vrednosti, najlošiji podindeks."
8. Button "Osveži"

Do not add any other numbers, scores, scales, thresholds, health conditions or data sources.
Category must be readable without color (always show the name). Text contrast at least 4.5:1.
```

### 1b. Stanje bez preporuke (scenario S3, zastareli podaci)

```
Same air quality card, but the data is stale. All text in Serbian (Latin script).

Show:
1. Station picker – selected: "Liman, Novi Sad"
2. Latest values: "PM2.5: 3.7 µg/m³", "PM10: 6.6 µg/m³"
3. Measurement time: "Merenje: 16.11.2026. 05:00"
4. Instead of the category and the advice, one clear notice:
   "Poslednje merenje je od 16.11. u 05:00. Ne dajemo preporuku."
5. Line chart for the last 24 hours (data ends at 05:00)
6. Button "Osveži"

No category badge, no advice. Do not add any other numbers or data.
```

Snimke ekrana sačuvati ovde:

- `docs/stitch/stitch-sa-podacima.png`
- `docs/stitch/stitch-bez-preporuke.png`

---

## 2. Tabela mapiranja na A2UI

Katalog: **A2UI v0.9, osnovni katalog** (`@a2ui/web_core` 0.15) – komponente:
Text, Image, Icon, Video, AudioPlayer, Row, Column, List, Card, Tabs, Modal, Divider,
Button, TextField, CheckBox, ChoicePicker, Slider, DateTimeInput.

Kolona „Proba“ kaže da li je element već isproban u T03 (`src/server/a2ui.ts`).

| # | Element ekrana (spec 8.1) | A2UI komponenta | Ocena | Proba | Napomena |
|---|---|---|---|---|---|
| 1 | Izbor stanice (naziv i lokacija) | `ChoicePicker` (ili `Button` po stanici) | **da** | ne | Postoji u katalogu; izbor šalje akciju serveru (`callServerTool`), kao „Osveži“. |
| 2 | Poslednje vrednosti PM2.5 i PM10 sa jedinicama | `Row` + `Text` (`formatString`) | **da** | ✅ | „nije dostupno“ dolazi kao tekst sa servera (FR-04). |
| 3 | Vreme merenja i koliko je prošlo | `Text` (`formatString`) | **da** | ✅ vreme | „pre 20 min“ računa server i šalje kao tekst; katalog ima i `formatDate`. |
| 4 | EAQI kategorija sa bojom i nazivom | `Text` u `Card` | **delimično** | ✅ naziv | Naziv radi; **boja ne** – `Text` nema svojstvo boje. Rešenje: sopstvena komponenta (npr. `KategorijaBadge`) u našem katalogu. Naziv je uvek prisutan (NFR-07). |
| 5 | Grafikon za poslednja 24 h | — | **ne** | ne | Nema grafikona u katalogu. Rešenje: sopstvena komponenta (Zod šema + `A2uiLitElement`) ili rezerva: tabela satnih vrednosti preko `List` + `Row` + `Text`. |
| 6 | Savet LLM-a | `Text` | **da** | ne | Isti tekst kao u verziji A (FR-13); dolazi iz `napraviSavet`. |
| 7 | Osnov saveta | `Text` (`variant: caption`) | **da** | ✅ (pravilo) | |
| — | Poruka „bez preporuke“ (stale / no_data) | `Text` | **da** | ✅ | Zamenjuje elemente 4 i 6 (spec 8.1). |
| — | Dugme „Osveži“ (FR-15) | `Button` + `action.event` | **da** | ✅ | Proba: `osvezi_a2ui` vraća samo `updateDataModel`. |

**Zbir:** 5 od 7 elemenata „da“, 1 „delimično“ (boja kategorije), 1 „ne“ (grafikon).
Oba nedostatka spec je predvideo (8.3) i rešavaju se sopstvenim komponentama u katalogu (T13).

---

## 3. Šta je Stitch izmislio (ne prenosi se u aplikaciju)

_Popuniti posle pravljenja skica._

| Šta je Stitch dodao | Zašto se ne prenosi |
|---|---|
| | |

Primeri na koje treba paziti: skala 0–100 ili „AQI 156“, sopstveni pragovi, ikonice vremena
ili temperature, izvori podataka („Izvor: …“), zdravstveni saveti za rizične grupe.

---

## 4. Zaključak

_Konačno posle skica. Radna verzija:_

- **Vizuelni predložak – da.** Stitch brzo daje raspored i izgled kartica koji možemo
  preneti u verziju A (HTML/TS) i u raspored A2UI komponenti za verziju B.
- **Generisanje A2UI komponenti – za sada ne.** Po specifikaciji (8.3) server A2UI poruke
  pravi **deterministički, bez LLM-a**, iz istog `Rezultat`-a. Izlaz Stitch-a bi i dalje morao
  ručno da se prevede u A2UI i očisti od izmišljenog sadržaja (odeljak 3).
  TODO: proveriti u Stitch-u koje formate izvoza nudi i da li neki od njih može direktno u A2UI.
- **Ograničenje A2UI-ja nije u Stitch-u nego u katalogu:** boja kategorije i grafikon
  zahtevaju sopstvene komponente bez obzira na to kako je skica napravljena.
