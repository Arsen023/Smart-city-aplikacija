# T11 – Verzija A: grafikon 24 h i „pre X min“

- **Vlasnik:** Sara
- **Grana:** `sara/ui-a` (nastavak T10, isti PR)
- **Datum:** 2026-11-18

## Šta je urađeno

| Element (spec 8.1) | Kako |
|---|---|
| 3 – „pre X min“ | `protekloVreme()` premeštena iz `src/server/a2ui.ts` u `src/zajednicko/format.ts`. Server u `_meta["smartcity/sada"]` rezultata `assess_air_quality` šalje svoje „sada“ (u demo režimu vreme scenarija). Ekran A iz toga piše `Merenje: 16.11.2026. 09:00 · pre 20 min`, isto kao verzija B. Bez „sada“ se prikazuje samo vreme merenja. |
| 5 – grafikon 24 h | `geometrija.ts` premeštena iz `src/ui-b/komponente/` u `src/zajednicko/`, zajedno sa bojama linija (`BOJA_PM25`, `BOJA_PM10`). Ekran A crta SVG u `crtaj.ts` (`createElementNS`, bez `innerHTML`), iste ose, oznake, boje i isprekidanu liniju za PM10 kao komponenta u verziji B. |

Grafikon se vidi za `ok` (i S5 bez saveta) i `stale`; ne vidi se za `no_data`, `error`, učitavanje i kad istorija nema nijednu vrednost.
Nedostajuća vrednost prekida liniju, ne crta se kao 0 (S4).

## Izmene u Lukinim fajlovima (za pregled)

- `src/server/a2ui.ts`: `protekloVreme` se uvozi iz `src/zajednicko/format.ts` i izvozi dalje pod istim imenom; ponašanje isto.
- `src/ui-b/komponente/grafikon.ts`: uvoz geometrije i boja iz `src/zajednicko/geometrija.ts` umesto lokalnih konstanti.
- `src/ui-b/komponente/geometrija.ts` i `geometrija.test.ts` obrisani (test premešten u `src/zajednicko/geometrija.test.ts`).

## Zašto `_meta`, a ne polje u `Rezultat`-u

`Rezultat` je zajednički tip (`src/core/tipovi.ts`) i menja se samo uz dogovor. „Sada“ nije deo procene, nego podatak za prikaz, pa ide u `_meta` rezultata alata. Ako Luka više voli polje u `Rezultat`-u, lako se prebaci.

## Testovi

- `src/ui-a/prikaz.test.ts`: „pre X min“ (ok, stale, bez „sada“, no_data) i grafikon (ok, S5, stale, S4, prazna istorija, no_data/greška/učitavanje).
- `src/zajednicko/format.test.ts`: `protekloVreme`.
- `src/server/alati.test.ts`: `_meta["smartcity/sada"]` je ispravno ISO vreme.
