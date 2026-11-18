# Snimci ekrana verzije A (T10, T11)

Snimci za proveru scenarija S1–S6 (spec 10) i za prezentaciju / D6.

## Kako se pravi snimak

1. U `.env` postavi `EKONET_IZVOR=demo` i `EKONET_SCENARIO=<scenario>` (vidi tabelu).
2. `npm run build`, pa `npm start` (server na portu 3001).
3. U drugom terminalu pokreni basic-host (`ext-apps/examples/basic-host`), otvori http://localhost:8080.
4. Pozovi alat `assess_air_quality`, sačekaj ekran i napravi snimak (Win + Shift + S).
5. Sačuvaj kao `docs/snimci/a-<scenario>.png`.
6. Posle svih snimaka vrati `.env` na `EKONET_SCENARIO=s1-dobar`.

## Šta se proverava

| Fajl | Scenario | Na ekranu mora da se vidi |
|---|---|---|
| `a-s1-dobar.png` | S1 dobar vazduh | PM2.5 i PM10 sa µg/m³, „Merenje: … · pre X min“, kategorija „Dobar“ u boji, grafikon, savet, osnov |
| `a-s2-los.png` | S2 loš vazduh | kategorija „Loš“ (ili lošija), savet za manji napor, grafikon |
| `a-s3-zastareo.png` | S3 zastareli podaci | poruka sa vremenom poslednjeg merenja, „pre X h“, grafikon; **nema** kategorije ni saveta |
| `a-s4-bez-pm25.png` | S4 bez PM2.5 | „PM2.5 nije dostupno“ (nikad 0), napomena, samo linija PM10 na grafikonu |
| `a-s5-llm-greska.png` | S5 LLM ne radi | vrednosti, kategorija i grafikon, poruka da savet nije dostupan; **nema** saveta |
| `a-s6-bez-podataka.png` | S6 nema podataka | „Merenje: nema podataka“, poruka; **nema** kategorije, grafikona ni saveta |
