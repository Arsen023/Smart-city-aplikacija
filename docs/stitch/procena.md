# T05 – Google Stitch skica i procena prevoda u A2UI (D5)

Zadatak iz specifikacije, poglavlje 8.4:

- U Stitch-u napraviti skicu istog ekrana, **sa podacima i bez njih**.
- Za svaki element proveriti postoji li A2UI komponenta i upisati rezultat u tabelu.
- Sadržaj koji Stitch izmisli (skala 0–100, pragovi, izvori…) **ne prenosi se** u aplikaciju.
- Zaključak: da li Stitch koristimo za generisanje A2UI komponenti ili samo kao vizuelni predložak.

**Prihvaćeno kada (spec 10, D5):** za svaki element ekrana postoji ocena: da, delimično ili ne.

Status: ✅ tabela (odeljak 2), tri skice analizirane (odeljak 3), zaključak (odeljak 4).
Jedino otvoreno: koje formate izvoza nudi Stitch (TODO u odeljku 4).

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

### 1c. Prompt koji je korišćen za konačne skice

Na kraju je korišćen jedan prompt za oba ekrana (sadržaj kao 1a i 1b, scenariji S2 i S3),
uz **prvu skicu tima priloženu kao vizuelni uzor** i izričitu listu zabrana:
bez skale 0–100, pragova, oznaka po veličini, tooltipa, „Uživo“, navigacije, izvora i
saveta za osetljive grupe; bez izmišljenih brojeva; kategorija čitljiva i bez boje.

Snimke ekrana:

| Fajl | Šta je | Kako je nastala |
|---|---|---|
| `stitch-prva-skica.png` | prva skica tima, sa podacima | slobodan opis, pre ovih promptova |
| `stitch-sa-podacima.png` | konačna skica, scenario S2 (Loš) | prompt 1c |
| `stitch-bez-preporuke.png` | konačna skica, scenario S3 (zastareli podaci) | prompt 1c |

---

## 2. Tabela mapiranja na A2UI

Katalog: **A2UI v0.9, osnovni katalog** (`@a2ui/web_core` 0.15) – komponente:
Text, Image, Icon, Video, AudioPlayer, Row, Column, List, Card, Tabs, Modal, Divider,
Button, TextField, CheckBox, ChoicePicker, Slider, DateTimeInput.

Ocena se odnosi na **osnovni katalog**. Kolona „U verziji B“ kaže kako je element
napravljen u T12/T13 (`src/server/a2ui.ts`, `src/ui-b/`, PR #10).

| # | Element ekrana (spec 8.1) | Osnovni katalog | Ocena | U verziji B | Napomena |
|---|---|---|---|---|---|
| 1 | Izbor stanice (naziv i lokacija) | `ChoicePicker` | **da** | ✅ `ChoicePicker` + `Button` „Prikaži“ | `ChoicePicker` nema akciju na promenu, pa izbor šalje dugme (`callServerTool`). |
| 2 | Poslednje vrednosti PM2.5 i PM10 sa jedinicama | `Row` + `Text` | **da** | ✅ | „nije dostupno“ dolazi kao tekst sa servera (FR-04). Stitch ih prikazuje kao dve kartice – u A2UI dve `Card` u `Row`. |
| 3 | Vreme merenja i koliko je prošlo | `Text` | **da** | ✅ | „16.11.2026. 09:00 · pre 20 min“ računa server. |
| 4 | EAQI kategorija sa bojom i nazivom | `Text` | **delimično** | ✅ sopstvena `KategorijaBadge` | `Text` nema boju. Značka: EAQI boja + naziv + nivo, kontrast ≥ 4,5:1 (NFR-07). |
| 5 | Grafikon za poslednja 24 h | — | **ne** | ✅ sopstveni `Grafikon24h` | Sopstveni SVG, bez biblioteke. Rezerva bez sopstvene komponente: tabela preko `List` + `Row` + `Text`. |
| 6 | Savet LLM-a | `Text` | **da** | ✅ | Isti savet kao verzija A za isti Rezultat (FR-13). |
| 7 | Osnov saveta | `Text` (`caption`) | **da** | ✅ | |
| — | Poruka „bez preporuke“ (stale / no_data) | `Text` | **da** | ✅ | Zamenjuje elemente 4 i 6 (spec 8.1). |
| — | Dugme „Osveži“ (FR-15) | `Button` + `action.event` | **da** | ✅ | `osvezi_a2ui` vraća nove komponente i podatke. |
| — | Ikonice (savet, PM kartice) iz Stitch skice | `Icon` | **delimično** | ne | `Icon` postoji, ali sa ograničenim skupom ikonica; ukras, nije obavezan. |

**Zbir za 7 elemenata:** 5 „da“, 1 „delimično“ (boja kategorije), 1 „ne“ (grafikon).
Oba nedostatka spec je predvideo (8.3) i rešena su sopstvenim komponentama u našem katalogu (T13).

---

## 3. Šta je Stitch izmislio (ne prenosi se u aplikaciju)

### 3a. Prva skica tima (`stitch-prva-skica.png`, bez naših ograničenja)

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

### 3b. Konačna skica sa podacima (`stitch-sa-podacima.png`, S2)

Stitch je ispoštovao sve elemente i zabrane: tačne vrednosti (82.9 / 149.3 µg/m³), vreme
„16.11.2026. 09:00 · pre 20 min“, značka „Loš · nivo 4/6“ (boja + naziv), savet, osnov i „Osveži“.
Nema skale 0–100, pragova, izvora ni navigacije.

| Šta je Stitch ipak dodao ili promenio | Zašto se ne prenosi |
|---|---|
| Oblik krivih na grafikonu (rast od 00:00 do 09:00) | Ilustracija – grafikon crta samo naše satne vrednosti. |
| Osa X 00:00–09:00 pod naslovom „Poslednja 24 h“ | Nedosledno: to je 9 h, ne 24 h. U aplikaciji osa ide 24 h unazad. |
| Osa Y bez brojeva (samo „µg/m³“) | U aplikaciji osa Y ima vrednosti (0, polovina, maksimum). |
| Pitanje ispod naziva stanice | Iz prompta; dobra ideja, može kao naslov ekrana. |
| Ikonica munje uz savet | Ukras; u A2UI `Icon` (delimično), nije obavezno. |

### 3c. Konačna skica bez preporuke (`stitch-bez-preporuke.png`, S3)

Ispravno: nema značke ni saveta, umesto njih poruka „Poslednje merenje je od 16.11. u 05:00.
Ne dajemo preporuku.“, vreme „pre 4 h“, grafikon se završava u 05:00, osa 05:00–05:00 (24 h),
dugme „Osveži“.

| Šta je Stitch ipak dodao ili promenio | Zašto se ne prenosi |
|---|---|
| Oblik krivih na grafikonu | Ilustracija, kao u 3b. |
| Dekorativne ikonice u PM karticama | Ukras, nije obavezno. |
| Osa Y bez brojeva | Kao u 3b. |

### 3d. Šta pokazuje poređenje

- **Bez ograničenja** (3a) Stitch izmišlja mnogo: skalu, pragove, nazive kategorija, izvore,
  medicinske savete i ekrane van opsega – i to deluje uverljivo.
- **Sa strogim promptom** (3b, 3c) drži se teksta i brojeva, a izmišlja samo ono što prompt
  ne može da zada: oblik grafikona i ukrase.
- Zato je za nas presudno da **brojevi i tekstovi nikad ne dolaze iz skice**, nego iz `Rezultat`-a.

---

## 4. Zaključak

**Stitch koristimo kao vizuelni predložak, ne kao generator A2UI komponenti.**

- **Vizuelni predložak – da.** Konačne skice (3b, 3c) imaju tačno naših 7 elemenata i oba stanja.
  Mogu da služe kao predložak za izgled verzije A (T10) i kao provera rasporeda verzije B.
- **Generisanje A2UI – ne.** Po specifikaciji (8.3) A2UI poruke pravi server **deterministički,
  bez LLM-a**, iz istog `Rezultat`-a – to je i urađeno u T12. Izlaz Stitch-a bi i dalje morao ručno
  da se prevede u A2UI i očisti od izmišljenog sadržaja (3a, 3d). Mapiranje elemenata na komponente
  (odeljak 2) je jednostavno i već napravljeno ručno.
- **Ograničenje nije u Stitch-u nego u A2UI katalogu:** boja kategorije i grafikon traže sopstvene
  komponente bez obzira na to kako je skica napravljena (T13).
- **Pouka za rad sa Stitch-om:** prompt mora da sadrži prave vrednosti i izričite zabrane, inače
  skica uvodi pojmove koji nisu iz EAQI-ja (3a).

TODO (Luka): u Stitch-u proveriti meni za izvoz (HTML/CSS, Figma, kod…) i dopisati da li bilo
koji format može direktno u A2UI JSON. Ne očekuje se da menja zaključak.
