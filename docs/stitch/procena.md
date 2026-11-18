# T05 – Google Stitch skica i procena prevoda u A2UI (D5)

Zadatak iz specifikacije, poglavlje 8.4:

- U Stitch-u napraviti skicu istog ekrana, **sa podacima i bez njih**.
- Za svaki element proveriti postoji li A2UI komponenta i upisati rezultat u tabelu.
- Sadržaj koji Stitch izmisli (skala 0–100, pragovi, izvori…) **ne prenosi se** u aplikaciju.
- Zaključak: da li Stitch koristimo za generisanje A2UI komponenti ili samo kao vizuelni predložak.

**Prihvaćeno kada (spec 10, D5):** za svaki element ekrana postoji ocena: da, delimično ili ne.

Status: 🟡 tabela popunjena (T03, T13); skica sa podacima analizirana (odeljak 3);
čeka se skica stanja bez preporuke i konačan zaključak.

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

Snimke ekrana:

- `docs/stitch/stitch-sa-podacima.png` – ✅ napravljena (skica tima, pre ovog prompta)
- `docs/stitch/stitch-bez-preporuke.png` – ⏳ čeka

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

### 3a. Skica sa podacima (`stitch-sa-podacima.png`)

| Šta je Stitch dodao | Zašto se ne prenosi |
|---|---|
| Indeks „34 / 100“ i traka sa 5 podeoka | EAQI nema skalu 0–100 i ima **6** kategorija, ne 5. Prikazujemo samo kategoriju i nivo (npr. „nivo 2/6“). |
| „Vrlo dobar … Kritičan“, „Dobar (Klasa 2)“ | Nisu EAQI nazivi. Uz to je „Dobar“ nivo 1, a ne 2 – skica je nedosledna sama sa sobom. |
| „Prag: < 20 µg/m³“ (PM2.5), „Prag: < 40 µg/m³“ (PM10) | Izmišljeni pragovi; naši su iz EEA tabele (PM2.5 „Dobar“ je 0–5). Pravilo 6: pragove ne izmišljamo. |
| Oznake „Nizak nivo“, „U granicama“ po veličini | Podindeks po veličini ne prikazujemo; kategoriju određuje najlošiji podindeks. |
| Tekst saveta („…duž Dunavskog keja“, „Osetljive grupe mogu…“, „Provetravanje prostorija preporučeno“) | Savet piše K3 iz naših podataka i prolazi proveru; pominjanje osetljivih grupa je blizu medicinskog saveta (van opsega). |
| „Kalibrisan po SRPS EN standardu“, „usklađeni sa … SZO“ | Neprovereni izvori i tvrdnje. Kao osnov prikazujemo samo pravilo (EAQI, EEA 2024). |
| Tooltip „18.2 µg/m³ u 08h“, PM10 linija ispod PM2.5 na mestu gde je PM10 veći | Izmišljena vrednost; grafikon crta samo naše satne vrednosti. |
| „Uživo“, navigacija Mapa / Istorija / Podešavanja, profil, lokacija | Van opsega (spec 2: jedan ekran, bez mape i naloga). |

**Šta skica nema, a spec traži:** osnov saveta (element 7: stanica, vrednosti, vreme, pravilo),
tačno vreme merenja (ima samo „pre 12 min“) i dugme „Osveži“ (FR-15).

**Šta je dobro i prenosi se:** raspored (izbor stanice gore, kategorija, dve kartice PM2.5/PM10,
grafikon 24 h, savet sa ikonicom), značka kategorije sa bojom **i** nazivom, „pre X min“,
legenda grafikona sa nazivima veličina.

### 3b. Skica bez preporuke

_Popuniti posle pravljenja skice._

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
